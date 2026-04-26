import { Logger } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext } from '../../types';
import {
  buildGenerateInvoicesPdfTool,
  GenerateInvoicesPdfArgs,
  GenerateInvoicesPdfResult,
} from './generate-invoices-pdf.tool';
import {
  buildGeneratePeriodReportTool,
  GeneratePeriodReportArgs,
  GeneratePeriodReportResult,
  resolveReportPeriod,
} from './generate-period-report.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['analytics', 'invoicing'],
  locale: 'en',
};

interface PrismaMock {
  invoice: {
    findMany: jest.Mock;
  };
}

function makePrismaMock(ownedIds: string[]): PrismaMock {
  return {
    invoice: {
      findMany: jest.fn(async ({ where }: any) => {
        const requested: string[] = where.id.in;
        const garageId: string = where.garageId;
        // Only return rows where the id is in `ownedIds` AND the garage matches.
        if (garageId !== ownerCtx.garageId) return [];
        return requested.filter((id) => ownedIds.includes(id)).map((id) => ({ id }));
      }),
    },
  };
}

describe('reports tools', () => {
  describe('generate_invoices_pdf', () => {
    it('returns a placeholder url, expiresAt, and invoiceCount on the happy path', async () => {
      const prisma = makePrismaMock(['inv-1', 'inv-2']);
      const tool = buildGenerateInvoicesPdfTool(
        prisma as unknown as PrismaService,
        new Logger('test'),
      );

      const result: GenerateInvoicesPdfResult = await tool.handler(
        { invoiceIds: ['inv-1', 'inv-2'] } as GenerateInvoicesPdfArgs,
        ownerCtx,
      );

      expect(result.url).toMatch(/^\/api\/assistant\/downloads\/[0-9a-f-]+\.pdf$/);
      expect(result.invoiceCount).toBe(2);
      expect(typeof result.expiresAt).toBe('string');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['inv-1', 'inv-2'] }, garageId: 'garage-1' },
        select: { id: true },
      });
    });

    it('throws when any invoiceId does not belong to the caller garage', async () => {
      // Only inv-1 is owned; inv-FOREIGN is a different tenant.
      const prisma = makePrismaMock(['inv-1']);
      const tool = buildGenerateInvoicesPdfTool(
        prisma as unknown as PrismaService,
        new Logger('test'),
      );

      await expect(
        tool.handler(
          { invoiceIds: ['inv-1', 'inv-FOREIGN'] } as GenerateInvoicesPdfArgs,
          ownerCtx,
        ),
      ).rejects.toThrow(/do not belong to this garage/i);
    });

    it('fails arg validation when invoiceIds is empty', () => {
      const prisma = makePrismaMock([]);
      const tool = buildGenerateInvoicesPdfTool(
        prisma as unknown as PrismaService,
        new Logger('test'),
      );

      const registry = new ToolRegistryService();
      registry.register(tool as any);

      const result = registry.validateArgs('generate_invoices_pdf', { invoiceIds: [] });
      expect(result.valid).toBe(false);
      expect(result.errors!.join(' ')).toMatch(/invoiceIds|minItems|fewer/i);
    });

    it('declares READ blast tier and OWNER-only role', () => {
      const tool = buildGenerateInvoicesPdfTool(
        makePrismaMock([]) as unknown as PrismaService,
        new Logger('test'),
      );
      expect(tool.blastTier).toBe(AssistantBlastTier.READ);
      expect(tool.requiredRole).toBe('OWNER');
    });
  });

  describe('generate_period_report', () => {
    it('returns a placeholder url, expiresAt, period, format, and bounds on the happy path', async () => {
      const tool = buildGeneratePeriodReportTool(new Logger('test'));

      const result: GeneratePeriodReportResult = await tool.handler(
        { period: 'month', format: 'csv' } as GeneratePeriodReportArgs,
        ownerCtx,
      );

      expect(result.url).toMatch(/^\/api\/assistant\/downloads\/[0-9a-f-]+\.csv$/);
      expect(result.period).toBe('month');
      expect(result.format).toBe('csv');
      expect(typeof result.from).toBe('string');
      expect(typeof result.to).toBe('string');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('fails arg validation for an unsupported period enum', () => {
      const tool = buildGeneratePeriodReportTool(new Logger('test'));
      const registry = new ToolRegistryService();
      registry.register(tool as any);

      const result = registry.validateArgs('generate_period_report', {
        period: 'decade',
        format: 'pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.errors!.join(' ')).toMatch(/period|enum|allowed/i);
    });

    it('fails arg validation for an unsupported format enum', () => {
      const tool = buildGeneratePeriodReportTool(new Logger('test'));
      const registry = new ToolRegistryService();
      registry.register(tool as any);

      const result = registry.validateArgs('generate_period_report', {
        period: 'today',
        format: 'docx',
      });
      expect(result.valid).toBe(false);
      expect(result.errors!.join(' ')).toMatch(/format|enum|allowed/i);
    });

    describe('resolveReportPeriod', () => {
      // Anchor "now" mid-day on a known date so we can assert precise bounds.
      const NOW = new Date('2026-04-15T14:30:00.000Z');

      it('today: from = local midnight, to = now', () => {
        const { from, to } = resolveReportPeriod('today', NOW);
        expect(to.getTime()).toBe(NOW.getTime());
        expect(from.getHours()).toBe(0);
        expect(from.getMinutes()).toBe(0);
        expect(from.getSeconds()).toBe(0);
        expect(from.getMilliseconds()).toBe(0);
        // Same calendar day in local tz.
        expect(from.getFullYear()).toBe(NOW.getFullYear());
        expect(from.getMonth()).toBe(NOW.getMonth());
        expect(from.getDate()).toBe(NOW.getDate());
      });

      it('week: from = exactly 7 days before now', () => {
        const { from, to } = resolveReportPeriod('week', NOW);
        expect(to.getTime()).toBe(NOW.getTime());
        expect(NOW.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
      });

      it('month: from = first day of the current calendar month at midnight', () => {
        const { from, to } = resolveReportPeriod('month', NOW);
        expect(to.getTime()).toBe(NOW.getTime());
        expect(from.getDate()).toBe(1);
        expect(from.getHours()).toBe(0);
        expect(from.getMinutes()).toBe(0);
        expect(from.getMonth()).toBe(NOW.getMonth());
        expect(from.getFullYear()).toBe(NOW.getFullYear());
      });

      it('ytd: from = January 1 of the current year at midnight', () => {
        const { from, to } = resolveReportPeriod('ytd', NOW);
        expect(to.getTime()).toBe(NOW.getTime());
        expect(from.getMonth()).toBe(0);
        expect(from.getDate()).toBe(1);
        expect(from.getHours()).toBe(0);
        expect(from.getFullYear()).toBe(NOW.getFullYear());
      });
    });
  });
});
