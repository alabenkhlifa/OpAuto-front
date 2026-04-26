import { AssistantBlastTier, MaintenanceStatus } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { buildGetDashboardKpisTool } from './dashboard-kpis.tool';
import {
  buildGetRevenueSummaryTool,
  resolveRevenuePeriod,
} from './revenue-summary.tool';
import { buildGetCustomerCountTool } from './customer-count.tool';
import { buildListActiveJobsTool } from './active-jobs.tool';
import { buildGetInvoicesSummaryTool } from './invoices-summary.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: [],
  locale: 'en',
};

function registerAndValidate(tool: ToolDefinition, args: unknown) {
  const registry = new ToolRegistryService();
  registry.register(tool);
  return registry.validateArgs(tool.name, args);
}

describe('analytics tools', () => {
  describe('get_dashboard_kpis', () => {
    it('returns the stats from ReportsService scoped to the caller garage', async () => {
      const stats = {
        totalAppointments: 42,
        activeJobs: 5,
        totalRevenue: 12345,
        paidInvoices: 30,
        totalCustomers: 99,
      };
      const reports = { getDashboardStats: jest.fn().mockResolvedValue(stats) } as any;
      const tool = buildGetDashboardKpisTool(reports);

      const result = await tool.handler({}, ownerCtx);

      expect(result).toEqual(stats);
      expect(reports.getDashboardStats).toHaveBeenCalledTimes(1);
      expect(reports.getDashboardStats).toHaveBeenCalledWith(ownerCtx.garageId);
    });

    it('is registered as READ tier and OWNER-only', () => {
      const tool = buildGetDashboardKpisTool({ getDashboardStats: jest.fn() } as any);
      expect(tool.blastTier).toBe(AssistantBlastTier.READ);
      expect(tool.requiredRole).toBe('OWNER');
    });

    it('rejects extra arguments via the empty schema', () => {
      const tool = buildGetDashboardKpisTool({ getDashboardStats: jest.fn() } as any);
      const result = registerAndValidate(tool, { stray: 'not allowed' });
      expect(result.valid).toBe(false);
    });
  });

  describe('get_revenue_summary', () => {
    it('aggregates paid invoices for the requested period scoped by garage', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValue({ _sum: { total: 540 }, _count: 4 });
      const prisma = { invoice: { aggregate } } as any;
      const tool = buildGetRevenueSummaryTool(prisma);

      const result = await tool.handler({ period: 'month' }, ownerCtx);

      expect(result.totalRevenue).toBe(540);
      expect(result.paidInvoiceCount).toBe(4);
      expect(result.currency).toBe('TND');
      expect(result.period).toBe('month');
      expect(typeof result.from).toBe('string');
      expect(typeof result.to).toBe('string');

      expect(aggregate).toHaveBeenCalledTimes(1);
      const call = aggregate.mock.calls[0][0];
      expect(call.where.garageId).toBe(ownerCtx.garageId);
      expect(call.where.status).toBe('PAID');
      expect(call.where.paidAt.gte).toBeInstanceOf(Date);
      expect(call.where.paidAt.lt).toBeInstanceOf(Date);
    });

    it('rejects periods outside the enum', () => {
      const tool = buildGetRevenueSummaryTool({ invoice: { aggregate: jest.fn() } } as any);
      const result = registerAndValidate(tool, { period: 'forever' });
      expect(result.valid).toBe(false);
    });

    it('returns a sensible window for "today"', () => {
      const now = new Date('2026-04-26T15:30:00Z');
      const { from, to } = resolveRevenuePeriod('today', now);
      expect(to.getTime()).toBe(now.getTime());
      // "from" is local midnight on the same calendar day as "now".
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(from.getTime()).toBeLessThan(to.getTime());
    });

    it('treats null _sum.total as 0 revenue', async () => {
      const prisma = {
        invoice: {
          aggregate: jest
            .fn()
            .mockResolvedValue({ _sum: { total: null }, _count: 0 }),
        },
      } as any;
      const tool = buildGetRevenueSummaryTool(prisma);
      const result = await tool.handler({ period: 'today' }, ownerCtx);
      expect(result.totalRevenue).toBe(0);
      expect(result.paidInvoiceCount).toBe(0);
    });
  });

  describe('get_customer_count', () => {
    it('returns total only when newSince is omitted', async () => {
      const count = jest.fn().mockResolvedValue(17);
      const prisma = { customer: { count } } as any;
      const tool = buildGetCustomerCountTool(prisma);

      const result = await tool.handler({}, ownerCtx);

      expect(result).toEqual({ total: 17 });
      expect(count).toHaveBeenCalledTimes(1);
      expect(count).toHaveBeenCalledWith({ where: { garageId: ownerCtx.garageId } });
    });

    it('returns total + new when newSince is provided, garage-scoped', async () => {
      const count = jest.fn().mockResolvedValueOnce(50).mockResolvedValueOnce(8);
      const prisma = { customer: { count } } as any;
      const tool = buildGetCustomerCountTool(prisma);

      const result = await tool.handler({ newSince: '2026-04-01' }, ownerCtx);

      expect(result).toEqual({ total: 50, new: 8 });
      expect(count).toHaveBeenCalledTimes(2);
      const secondCall = count.mock.calls[1][0];
      expect(secondCall.where.garageId).toBe(ownerCtx.garageId);
      expect(secondCall.where.createdAt.gte).toBeInstanceOf(Date);
    });

    it('rejects malformed newSince via Ajv format check or runtime guard', async () => {
      const tool = buildGetCustomerCountTool({ customer: { count: jest.fn() } } as any);
      // Schema is permissive on string format — ensure the handler still
      // throws on garbage values rather than calling Prisma with NaN.
      await expect(tool.handler({ newSince: 'not-a-date' }, ownerCtx)).rejects.toThrow(
        /Invalid newSince/,
      );
    });
  });

  describe('list_active_jobs', () => {
    const sampleRow = {
      id: 'job-1',
      title: 'Brake pad replacement',
      status: MaintenanceStatus.IN_PROGRESS,
      carId: 'car-1',
      startDate: new Date('2026-04-25T09:00:00Z'),
      car: { customerId: 'customer-1' },
    };

    it('uses default limit of 10 when none provided', async () => {
      const findMany = jest.fn().mockResolvedValue([sampleRow]);
      const prisma = { maintenanceJob: { findMany } } as any;
      const tool = buildListActiveJobsTool(prisma);

      const result = await tool.handler({}, ownerCtx);

      expect(result.jobs).toHaveLength(1);
      const call = findMany.mock.calls[0][0];
      expect(call.take).toBe(10);
      expect(call.where.garageId).toBe(ownerCtx.garageId);
      expect(call.where.status.notIn).toEqual(
        expect.arrayContaining([MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED]),
      );
    });

    it('projects rows to the public summary shape with customerId via car relation', async () => {
      const findMany = jest.fn().mockResolvedValue([sampleRow]);
      const prisma = { maintenanceJob: { findMany } } as any;
      const tool = buildListActiveJobsTool(prisma);

      const result = await tool.handler({ limit: 5 }, ownerCtx);

      expect(result.jobs[0]).toEqual({
        id: 'job-1',
        title: 'Brake pad replacement',
        status: MaintenanceStatus.IN_PROGRESS,
        customerId: 'customer-1',
        carId: 'car-1',
        startDate: '2026-04-25T09:00:00.000Z',
      });
    });

    it('rejects non-integer limit at the schema layer', () => {
      const tool = buildListActiveJobsTool({ maintenanceJob: { findMany: jest.fn() } } as any);
      const result = registerAndValidate(tool, { limit: 'lots' });
      expect(result.valid).toBe(false);
    });
  });

  describe('get_invoices_summary', () => {
    it('aggregates with garage scope, status filter, and date range', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValueOnce({ _sum: { total: 1000 }, _count: 5 })
        .mockResolvedValueOnce({ _sum: { total: 700 } })
        .mockResolvedValueOnce({ _sum: { total: 300 } });
      const prisma = { invoice: { aggregate } } as any;
      const tool = buildGetInvoicesSummaryTool(prisma);

      const result = await tool.handler(
        { status: 'PAID', from: '2026-01-01', to: '2026-04-26' },
        ownerCtx,
      );

      expect(result).toEqual({
        count: 5,
        totalSum: 1000,
        paidSum: 700,
        outstandingSum: 300,
      });
      expect(aggregate).toHaveBeenCalledTimes(3);
      const baseCall = aggregate.mock.calls[0][0];
      expect(baseCall.where.garageId).toBe(ownerCtx.garageId);
      expect(baseCall.where.status).toBe('PAID');
      expect(baseCall.where.createdAt.gte).toBeInstanceOf(Date);
      expect(baseCall.where.createdAt.lt).toBeInstanceOf(Date);
    });

    it('handles missing date filters gracefully', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValue({ _sum: { total: null }, _count: 0 });
      const prisma = { invoice: { aggregate } } as any;
      const tool = buildGetInvoicesSummaryTool(prisma);

      const result = await tool.handler({}, ownerCtx);

      expect(result).toEqual({ count: 0, totalSum: 0, paidSum: 0, outstandingSum: 0 });
      const baseCall = aggregate.mock.calls[0][0];
      expect(baseCall.where.createdAt).toBeUndefined();
    });

    it('rejects an unknown InvoiceStatus enum value', () => {
      const tool = buildGetInvoicesSummaryTool({ invoice: { aggregate: jest.fn() } } as any);
      const result = registerAndValidate(tool, { status: 'NOT_A_REAL_STATUS' });
      expect(result.valid).toBe(false);
    });

    it('rejects a malformed from/to date at runtime', async () => {
      const tool = buildGetInvoicesSummaryTool({ invoice: { aggregate: jest.fn() } } as any);
      await expect(
        tool.handler({ from: 'banana' }, ownerCtx),
      ).rejects.toThrow(/Invalid from/);
    });
  });
});
