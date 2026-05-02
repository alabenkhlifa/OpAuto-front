import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext } from '../../types';
import { buildListInvoicesTool } from './list-invoices.tool';
import { buildGetInvoiceTool } from './get-invoice.tool';
import { buildListOverdueInvoicesTool } from './list-overdue-invoices.tool';
import { buildRecordPaymentTool } from './record-payment.tool';
import { buildListLowStockPartsTool } from './list-low-stock-parts.tool';
import { buildGetInventoryValueTool } from './get-inventory-value.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['invoicing', 'inventory'],
  locale: 'en',
};

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      ...((overrides.invoice as object) ?? {}),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      ...((overrides.payment as object) ?? {}),
    },
    part: {
      findMany: jest.fn().mockResolvedValue([]),
      ...((overrides.part as object) ?? {}),
    },
  } as unknown as Parameters<typeof buildListInvoicesTool>[0] & Record<string, any>;
}

describe('Invoicing + Inventory Tools', () => {
  describe('list_invoices', () => {
    it('returns the projected shape and forwards filters to prisma', async () => {
      const prisma = makePrismaMock({
        invoice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'inv-1',
              invoiceNumber: 'INV-001',
              customerId: 'cust-1',
              status: 'PAID',
              total: 250,
              dueDate: new Date('2026-04-01T00:00:00Z'),
              paidAt: new Date('2026-04-02T00:00:00Z'),
              createdAt: new Date('2026-03-25T00:00:00Z'),
            },
          ]),
        },
      });
      const tool = buildListInvoicesTool(prisma as never);

      const result = await tool.handler(
        { status: 'PAID', from: '2026-03-01T00:00:00Z' },
        ownerCtx,
      );

      expect(result.count).toBe(1);
      expect(result.invoices[0]).toMatchObject({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        status: 'PAID',
        total: 250,
      });
      const where = (prisma as any).invoice.findMany.mock.calls[0][0].where;
      expect(where.garageId).toBe('garage-1');
      expect(where.status).toBe('PAID');
      expect(where.createdAt.gte).toEqual(new Date('2026-03-01T00:00:00Z'));
    });

    it('rejects an invalid status enum at schema level', () => {
      const tool = buildListInvoicesTool(makePrismaMock() as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      const result = registry.validateArgs('list_invoices', { status: 'BOGUS' });
      expect(result.valid).toBe(false);
    });

    it('defaults to descending createdAt when orderBy is omitted', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListInvoicesTool(prisma as never);

      await tool.handler({}, ownerCtx);

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
      expect(call.take).toBeUndefined();
    });

    it('honors orderBy="oldest" so "first N" requests return earliest invoices', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListInvoicesTool(prisma as never);

      await tool.handler(
        { from: '2026-01-01', orderBy: 'oldest', limit: 3 },
        ownerCtx,
      );

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'asc' });
      expect(call.take).toBe(3);
      expect(call.where.createdAt.gte).toEqual(new Date('2026-01-01'));
    });

    it('honors orderBy="newest" + limit for "latest N" requests', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListInvoicesTool(prisma as never);

      await tool.handler({ orderBy: 'newest', limit: 5 }, ownerCtx);

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
      expect(call.take).toBe(5);
    });

    it('rejects an invalid orderBy at schema level', () => {
      const tool = buildListInvoicesTool(makePrismaMock() as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      const result = registry.validateArgs('list_invoices', { orderBy: 'random' });
      expect(result.valid).toBe(false);
    });

    it('rejects a limit outside the allowed range', () => {
      const tool = buildListInvoicesTool(makePrismaMock() as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      expect(registry.validateArgs('list_invoices', { limit: 0 }).valid).toBe(false);
      expect(registry.validateArgs('list_invoices', { limit: 101 }).valid).toBe(false);
      expect(registry.validateArgs('list_invoices', { limit: 50 }).valid).toBe(true);
    });
  });

  describe('get_invoice', () => {
    it('delegates to InvoicingService.findOne with garage scope', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'inv-1' });
      const tool = buildGetInvoiceTool({ findOne } as never);

      const out = await tool.handler({ invoiceId: 'inv-1' }, ownerCtx);

      expect(findOne).toHaveBeenCalledWith('inv-1', 'garage-1');
      expect(out).toEqual({ id: 'inv-1' });
    });
  });

  describe('list_overdue_invoices', () => {
    it('computes daysOverdue and totalOutstanding', async () => {
      const now = Date.now();
      const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
      const prisma = makePrismaMock({
        invoice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'inv-1',
              invoiceNumber: 'INV-001',
              customerId: 'cust-1',
              status: 'SENT',
              total: 100,
              dueDate: new Date(now - TEN_DAYS),
            },
            {
              id: 'inv-2',
              invoiceNumber: 'INV-002',
              customerId: 'cust-2',
              status: 'PARTIALLY_PAID',
              total: 200,
              dueDate: new Date(now - 2 * TEN_DAYS),
            },
          ]),
        },
      });
      const tool = buildListOverdueInvoicesTool(prisma as never);

      const result = await tool.handler({}, ownerCtx);

      expect(result.count).toBe(2);
      expect(result.totalOutstanding).toBe(300);
      expect(result.invoices[0].daysOverdue).toBeGreaterThanOrEqual(9);
      expect(result.invoices[0].daysOverdue).toBeLessThanOrEqual(10);
      expect(result.invoices[1].daysOverdue).toBeGreaterThanOrEqual(19);

      const where = (prisma as any).invoice.findMany.mock.calls[0][0].where;
      expect(where.garageId).toBe('garage-1');
      expect(where.status).toEqual({ notIn: ['PAID', 'CANCELLED'] });
      expect(where.dueDate.lt).toBeInstanceOf(Date);
    });

    it('defaults to dueDate ascending (most_overdue) without limit', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListOverdueInvoicesTool(prisma as never);

      await tool.handler({}, ownerCtx);

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ dueDate: 'asc' });
      expect(call.take).toBeUndefined();
    });

    it('honors orderBy="highest_amount" + limit', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListOverdueInvoicesTool(prisma as never);

      await tool.handler({ orderBy: 'highest_amount', limit: 5 }, ownerCtx);

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ total: 'desc' });
      expect(call.take).toBe(5);
    });

    it('honors orderBy="least_overdue" → dueDate desc', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrismaMock({ invoice: { findMany } });
      const tool = buildListOverdueInvoicesTool(prisma as never);

      await tool.handler({ orderBy: 'least_overdue' }, ownerCtx);

      const call = findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ dueDate: 'desc' });
    });

    it('rejects an invalid orderBy at schema level', () => {
      const tool = buildListOverdueInvoicesTool(makePrismaMock() as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      const result = registry.validateArgs('list_overdue_invoices', {
        orderBy: 'whatever',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('record_payment', () => {
    it('refuses to record a payment against a foreign-garage invoice', async () => {
      const prisma = makePrismaMock({
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-foreign',
            garageId: 'other-garage',
            total: 500,
          }),
        },
      });
      const invoicing = { addPayment: jest.fn() };
      const tool = buildRecordPaymentTool(prisma as never, invoicing as never);

      await expect(
        tool.handler(
          {
            invoiceId: 'inv-foreign',
            amount: 100,
            method: 'CASH',
            _expectedConfirmation: 'INV-FOREIGN',
          },
          ownerCtx,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(invoicing.addPayment).not.toHaveBeenCalled();
    });

    it('throws NotFound when the invoice does not exist', async () => {
      const prisma = makePrismaMock({
        invoice: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      });
      const invoicing = { addPayment: jest.fn() };
      const tool = buildRecordPaymentTool(prisma as never, invoicing as never);

      await expect(
        tool.handler(
          {
            invoiceId: 'missing',
            amount: 50,
            method: 'CASH',
            _expectedConfirmation: 'INV-MISSING',
          },
          ownerCtx,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('records a payment and returns the new balance', async () => {
      const prisma = makePrismaMock({
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            garageId: 'garage-1',
            total: 200,
            status: 'SENT',
          }),
        },
        payment: {
          findMany: jest.fn().mockResolvedValue([{ amount: 150 }]),
        },
      });
      const invoicing = {
        addPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      };
      const tool = buildRecordPaymentTool(prisma as never, invoicing as never);

      const result = await tool.handler(
        {
          invoiceId: 'inv-1',
          amount: 150,
          method: 'CASH',
          _expectedConfirmation: 'INV-001',
        },
        ownerCtx,
      );

      expect(result).toEqual({
        paymentId: 'pay-1',
        invoiceId: 'inv-1',
        newBalance: 50,
      });
      expect(invoicing.addPayment).toHaveBeenCalledWith(
        'inv-1',
        'garage-1',
        expect.objectContaining({ amount: 150, method: 'CASH', processedBy: 'user-1' }),
      );
    });

    it('refuses to record a second payment against an already-PAID invoice (assistant double-charge guard)', async () => {
      const prisma = makePrismaMock({
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-paid',
            garageId: 'garage-1',
            total: 200,
            status: 'PAID',
          }),
        },
      });
      const invoicing = { addPayment: jest.fn() };
      const tool = buildRecordPaymentTool(prisma as never, invoicing as never);

      await expect(
        tool.handler(
          {
            invoiceId: 'inv-paid',
            amount: 50,
            method: 'CASH',
            _expectedConfirmation: 'INV-PAID',
          },
          ownerCtx,
        ),
      ).rejects.toThrow(/already PAID/);
      expect(invoicing.addPayment).not.toHaveBeenCalled();
    });

    it('marks the tool as TYPED_CONFIRM_WRITE and requires _expectedConfirmation in args', () => {
      const tool = buildRecordPaymentTool(makePrismaMock() as never, {} as never);
      expect(tool.blastTier).toBe(AssistantBlastTier.TYPED_CONFIRM_WRITE);

      const registry = new ToolRegistryService();
      registry.register(tool);
      const missing = registry.validateArgs('record_payment', {
        invoiceId: 'i',
        amount: 1,
        method: 'CASH',
      });
      expect(missing.valid).toBe(false);
      expect(missing.errors!.join(' ')).toMatch(/_expectedConfirmation/);
    });

    it('rejects negative or zero amount at schema level', () => {
      const tool = buildRecordPaymentTool(makePrismaMock() as never, {} as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      const negative = registry.validateArgs('record_payment', {
        invoiceId: 'i',
        amount: -5,
        method: 'CASH',
        _expectedConfirmation: 'INV-1',
      });
      expect(negative.valid).toBe(false);

      const zero = registry.validateArgs('record_payment', {
        invoiceId: 'i',
        amount: 0,
        method: 'CASH',
        _expectedConfirmation: 'INV-1',
      });
      expect(zero.valid).toBe(false);
    });
  });

  describe('list_low_stock_parts', () => {
    const partsFixture = [
      { id: 'p1', name: 'Brake Pad', quantity: 2, minQuantity: 5, unitPrice: 40 },
      { id: 'p2', name: 'Oil Filter', quantity: 10, minQuantity: 5, unitPrice: 12 },
      { id: 'p3', name: 'Spark Plug', quantity: 4, minQuantity: 4, unitPrice: 6 },
    ];

    it('defaults to per-part minQuantity comparison', async () => {
      const prisma = makePrismaMock({
        part: { findMany: jest.fn().mockResolvedValue(partsFixture) },
      });
      const tool = buildListLowStockPartsTool(prisma as never);

      const result = await tool.handler({}, ownerCtx);

      expect(result.thresholdMode).toBe('per-part-min');
      expect(result.parts.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    });

    it('uses an explicit threshold when provided', async () => {
      const prisma = makePrismaMock({
        part: { findMany: jest.fn().mockResolvedValue(partsFixture) },
      });
      const tool = buildListLowStockPartsTool(prisma as never);

      const result = await tool.handler({ threshold: 3 }, ownerCtx);

      expect(result.thresholdMode).toBe('explicit');
      expect(result.parts.map((p) => p.id)).toEqual(['p1']);
    });

    it('is gated by the inventory module flag', () => {
      const tool = buildListLowStockPartsTool(makePrismaMock() as never);
      expect(tool.requiredModule).toBe('inventory');
    });

    it('orders by largest deficit when orderBy="most_critical" and respects limit', async () => {
      const prisma = makePrismaMock({
        part: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'p1', name: 'Brake Pad', quantity: 2, minQuantity: 5, unitPrice: 40 }, // deficit 3
            { id: 'p3', name: 'Spark Plug', quantity: 4, minQuantity: 4, unitPrice: 6 }, // deficit 0
            { id: 'p4', name: 'Oil', quantity: 0, minQuantity: 10, unitPrice: 8 }, // deficit 10
          ]),
        },
      });
      const tool = buildListLowStockPartsTool(prisma as never);

      const result = await tool.handler({ orderBy: 'most_critical', limit: 2 }, ownerCtx);

      expect(result.parts.map((p) => p.id)).toEqual(['p4', 'p1']);
    });

    it('rejects an invalid orderBy at schema level', () => {
      const tool = buildListLowStockPartsTool(makePrismaMock() as never);
      const registry = new ToolRegistryService();
      registry.register(tool);
      expect(
        registry.validateArgs('list_low_stock_parts', { orderBy: 'random' }).valid,
      ).toBe(false);
    });
  });

  describe('get_inventory_value', () => {
    it('computes total count and value as sum(quantity * costPrice)', async () => {
      const prisma = makePrismaMock({
        part: {
          findMany: jest.fn().mockResolvedValue([
            { quantity: 10, costPrice: 5 },
            { quantity: 3, costPrice: 20 },
            { quantity: 0, costPrice: 99 },
          ]),
        },
      });
      const tool = buildGetInventoryValueTool(prisma as never);

      const result = await tool.handler({}, ownerCtx);

      expect(result.totalCount).toBe(13);
      expect(result.totalValue).toBe(50 + 60 + 0);
      expect(result.currency).toBe('TND');
    });

    it('is gated by the inventory module flag', () => {
      const tool = buildGetInventoryValueTool(makePrismaMock() as never);
      expect(tool.requiredModule).toBe('inventory');
    });
  });
});
