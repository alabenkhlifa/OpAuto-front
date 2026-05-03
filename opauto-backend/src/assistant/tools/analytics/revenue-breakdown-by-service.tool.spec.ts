import { AssistantBlastTier } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { buildGetRevenueBreakdownByServiceTool } from './revenue-breakdown-by-service.tool';

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

function makePrisma(opts: {
  invoiceFindMany?: jest.Mock;
  catalogFindMany?: jest.Mock;
}): any {
  return {
    invoice: {
      findMany:
        opts.invoiceFindMany ?? jest.fn().mockResolvedValue([]),
    },
    serviceCatalog: {
      findMany: opts.catalogFindMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

describe('get_revenue_breakdown_by_service', () => {
  it('is a READ tier OWNER-only tool with the right name', () => {
    const tool = buildGetRevenueBreakdownByServiceTool(makePrisma({}));
    expect(tool.name).toBe('get_revenue_breakdown_by_service');
    expect(tool.blastTier).toBe(AssistantBlastTier.READ);
    expect(tool.requiredRole).toBe('OWNER');
  });

  it('returns empty breakdown when no paid invoices match the window', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany }),
    );

    const result = await tool.handler({ period: 'month' }, ownerCtx);

    expect(result.totalRevenue).toBe(0);
    expect(result.breakdown).toEqual([]);
    expect(result.currency).toBe('TND');
    expect(result.period).toBe('month');
    const where = invoiceFindMany.mock.calls[0][0].where;
    expect(where.garageId).toBe(ownerCtx.garageId);
    expect(where.status).toBe('PAID');
    expect(where.paidAt.gte).toBeInstanceOf(Date);
    expect(where.paidAt.lt).toBeInstanceOf(Date);
  });

  it('groups by ServiceCatalog.category when present', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 100, type: 'service', partId: null, serviceCode: 'OIL-CHG' },
          { total: 200, type: 'service', partId: null, serviceCode: 'BRK-PAD' },
        ],
      },
      {
        lineItems: [
          { total: 50, type: 'service', partId: null, serviceCode: 'OIL-CHG' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'OIL-CHG', name: 'Oil change', category: 'Maintenance' },
      { code: 'BRK-PAD', name: 'Brake pads', category: 'Brakes' },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, ownerCtx);

    expect(result.totalRevenue).toBe(350);
    // Sorted desc by totalRevenue — Brakes (200) > Maintenance (150).
    expect(result.breakdown.map((b) => b.category)).toEqual([
      'Brakes',
      'Maintenance',
    ]);
    const maintenance = result.breakdown.find((b) => b.category === 'Maintenance')!;
    expect(maintenance.totalRevenue).toBe(150);
    expect(maintenance.lineItemCount).toBe(2);
    const brakes = result.breakdown.find((b) => b.category === 'Brakes')!;
    expect(brakes.totalRevenue).toBe(200);
    expect(brakes.lineItemCount).toBe(1);
    // Percentages sum exactly to 100 after drift fixup.
    const sumPct = result.breakdown.reduce((acc, b) => acc + b.percentage, 0);
    expect(sumPct).toBeCloseTo(100, 5);
  });

  it('falls back to catalog name when category is null', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 75, type: 'service', partId: null, serviceCode: 'CUSTOM' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'CUSTOM', name: 'Diagnostic check', category: null },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'month' }, ownerCtx);

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].category).toBe('Diagnostic check');
    expect(result.breakdown[0].totalRevenue).toBe(75);
    expect(result.breakdown[0].percentage).toBe(100);
  });

  it('buckets by line type when serviceCode is missing or unknown', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 30, type: 'part', partId: 'part-1', serviceCode: null },
          { total: 70, type: 'labor', partId: null, serviceCode: null },
          // partId set but no type → still Parts.
          { total: 20, type: null, partId: 'part-2', serviceCode: null },
          // unknown type / no partId / no serviceCode → Other.
          { total: 10, type: 'misc', partId: null, serviceCode: null },
          // serviceCode that doesn't resolve in the catalog → falls through to type.
          { total: 5, type: 'labor', partId: null, serviceCode: 'GHOST' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([]); // GHOST not in catalog.
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, ownerCtx);

    expect(result.totalRevenue).toBe(135);
    const parts = result.breakdown.find((b) => b.category === 'Parts')!;
    expect(parts.totalRevenue).toBe(50); // 30 + 20
    expect(parts.lineItemCount).toBe(2);
    const labor = result.breakdown.find((b) => b.category === 'Labor')!;
    expect(labor.totalRevenue).toBe(75); // 70 + 5 (GHOST fell through to labor type)
    expect(labor.lineItemCount).toBe(2);
    const other = result.breakdown.find((b) => b.category === 'Other')!;
    expect(other.totalRevenue).toBe(10);
    expect(other.lineItemCount).toBe(1);
  });

  it('sorts breakdown by totalRevenue descending', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 10, type: 'service', partId: null, serviceCode: 'A' },
          { total: 100, type: 'service', partId: null, serviceCode: 'B' },
          { total: 50, type: 'service', partId: null, serviceCode: 'C' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'A', name: 'Alpha', category: 'Cat-A' },
      { code: 'B', name: 'Beta', category: 'Cat-B' },
      { code: 'C', name: 'Gamma', category: 'Cat-C' },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, ownerCtx);

    expect(result.breakdown.map((b) => b.category)).toEqual([
      'Cat-B',
      'Cat-C',
      'Cat-A',
    ]);
  });

  it('always scopes invoice + catalog queries by garageId (tenant isolation)', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 40, type: 'service', partId: null, serviceCode: 'X' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'X', name: 'X-name', category: 'X-cat' },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    await tool.handler({ period: 'ytd' }, ownerCtx);

    expect(invoiceFindMany.mock.calls[0][0].where.garageId).toBe(
      ownerCtx.garageId,
    );
    expect(catalogFindMany.mock.calls[0][0].where.garageId).toBe(
      ownerCtx.garageId,
    );
  });

  it('returns 0 totalRevenue for a different garage that has no invoices', async () => {
    const otherCtx = { ...ownerCtx, garageId: 'garage-2' };
    const invoiceFindMany = jest.fn().mockImplementation(({ where }) => {
      if (where.garageId === 'garage-1') {
        return Promise.resolve([
          {
            lineItems: [
              { total: 100, type: 'service', partId: null, serviceCode: 'A' },
            ],
          },
        ]);
      }
      return Promise.resolve([]);
    });
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, otherCtx);

    expect(result.totalRevenue).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it('rejects partial range (only from, no to) at handler level', async () => {
    const tool = buildGetRevenueBreakdownByServiceTool(makePrisma({}));
    await expect(
      tool.handler({ from: '2026-02-01' } as any, ownerCtx),
    ).rejects.toThrow(/from.*to.*together/i);
  });

  it('rejects from >= to', async () => {
    const tool = buildGetRevenueBreakdownByServiceTool(makePrisma({}));
    await expect(
      tool.handler({ from: '2026-04-30', to: '2026-04-01' }, ownerCtx),
    ).rejects.toThrow(/Invalid range/);
  });

  it('accepts custom from+to range and labels period as "custom"', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany }),
    );

    const result = await tool.handler(
      { from: '2026-02-01', to: '2026-04-30' },
      ownerCtx,
    );

    expect(result.period).toBe('custom');
    expect(result.totalRevenue).toBe(0);
    const where = invoiceFindMany.mock.calls[0][0].where;
    expect(where.paidAt.gte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    // Date-only `to` advances to next-day midnight.
    expect(where.paidAt.lt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('defaults to ytd when no args are supplied', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany }),
    );

    const result = await tool.handler({}, ownerCtx);

    expect(result.period).toBe('ytd');
  });

  it('schema accepts {period}, {from,to}, and rejects extras', () => {
    const tool = buildGetRevenueBreakdownByServiceTool(makePrisma({}));
    expect(registerAndValidate(tool, { period: 'month' }).valid).toBe(true);
    expect(
      registerAndValidate(tool, { from: '2026-01-01', to: '2026-04-01' }).valid,
    ).toBe(true);
    expect(registerAndValidate(tool, {}).valid).toBe(true);
    expect(
      registerAndValidate(tool, { period: 'forever' } as any).valid,
    ).toBe(false);
    expect(
      registerAndValidate(tool, { period: 'ytd', whatever: 1 } as any).valid,
    ).toBe(false);
  });

  it('handles all-zero line totals without dividing by zero', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 0, type: 'service', partId: null, serviceCode: 'A' },
          { total: 0, type: 'labor', partId: null, serviceCode: null },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'A', name: 'A-name', category: 'A-cat' },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, ownerCtx);

    expect(result.totalRevenue).toBe(0);
    // Both buckets exist with zero revenue and zero percentage.
    expect(result.breakdown.length).toBe(2);
    for (const b of result.breakdown) {
      expect(b.totalRevenue).toBe(0);
      expect(b.percentage).toBe(0);
    }
  });

  it('rounds percentages so they sum to exactly 100 (drift fixup on largest bucket)', async () => {
    // Three thirds — naive rounding gives 33.33 + 33.33 + 33.33 = 99.99.
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        lineItems: [
          { total: 100, type: 'service', partId: null, serviceCode: 'A' },
          { total: 100, type: 'service', partId: null, serviceCode: 'B' },
          { total: 100, type: 'service', partId: null, serviceCode: 'C' },
        ],
      },
    ]);
    const catalogFindMany = jest.fn().mockResolvedValue([
      { code: 'A', name: 'A-name', category: 'Cat-A' },
      { code: 'B', name: 'B-name', category: 'Cat-B' },
      { code: 'C', name: 'C-name', category: 'Cat-C' },
    ]);
    const tool = buildGetRevenueBreakdownByServiceTool(
      makePrisma({ invoiceFindMany, catalogFindMany }),
    );

    const result = await tool.handler({ period: 'ytd' }, ownerCtx);

    const sumPct = result.breakdown.reduce((acc, b) => acc + b.percentage, 0);
    expect(sumPct).toBeCloseTo(100, 5);
  });
});
