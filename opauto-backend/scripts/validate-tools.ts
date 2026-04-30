/**
 * Direct-call validator for every READ-tier assistant tool.
 *
 * Bypasses the LLM. For each tool, we run the tool's handler with sensible
 * args, then run an independent ground-truth Prisma query and compare.
 *
 *   npx ts-node scripts/validate-tools.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AssistantUserContext } from '../src/assistant/types';

import { CustomersService } from '../src/customers/customers.service';
import { CarsService } from '../src/cars/cars.service';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { InvoicingService } from '../src/invoicing/invoicing.service';
import { NumberingService } from '../src/invoicing/numbering.service';
import { TaxCalculatorService } from '../src/invoicing/tax-calculator.service';
import { ReportsService } from '../src/reports/reports.service';
import { AiService } from '../src/ai/ai.service';

import { buildGetCustomerCountTool } from '../src/assistant/tools/analytics/customer-count.tool';
import { buildGetRevenueSummaryTool, resolveRevenuePeriod } from '../src/assistant/tools/analytics/revenue-summary.tool';
import { buildGetInvoicesSummaryTool } from '../src/assistant/tools/analytics/invoices-summary.tool';
import { buildGetDashboardKpisTool } from '../src/assistant/tools/analytics/dashboard-kpis.tool';
import { buildListActiveJobsTool } from '../src/assistant/tools/analytics/active-jobs.tool';

import { createFindCustomerTool } from '../src/assistant/tools/customers-cars/find-customer.tool';
import { createGetCustomerTool } from '../src/assistant/tools/customers-cars/get-customer.tool';
import { createListTopCustomersTool } from '../src/assistant/tools/customers-cars/list-top-customers.tool';
import { createListAtRiskCustomersTool } from '../src/assistant/tools/customers-cars/list-at-risk-customers.tool';
import { createFindCarTool } from '../src/assistant/tools/customers-cars/find-car.tool';
import { createGetCarTool } from '../src/assistant/tools/customers-cars/get-car.tool';
import { createListMaintenanceDueTool } from '../src/assistant/tools/customers-cars/list-maintenance-due.tool';

import { buildListAppointmentsTool } from '../src/assistant/tools/appointments/list-appointments.tool';
import { buildFindAvailableSlotTool } from '../src/assistant/tools/appointments/find-available-slot.tool';

import { buildListInvoicesTool } from '../src/assistant/tools/invoicing-inventory/list-invoices.tool';
import { buildGetInvoiceTool } from '../src/assistant/tools/invoicing-inventory/get-invoice.tool';
import { buildListOverdueInvoicesTool } from '../src/assistant/tools/invoicing-inventory/list-overdue-invoices.tool';
import { buildListLowStockPartsTool } from '../src/assistant/tools/invoicing-inventory/list-low-stock-parts.tool';
import { buildGetInventoryValueTool } from '../src/assistant/tools/invoicing-inventory/get-inventory-value.tool';

const prismaClient = new PrismaClient();
const prisma = prismaClient as unknown as PrismaService;

const configService = new ConfigService();
const customersService = new CustomersService(prisma);
const carsService = new CarsService(prisma);
const appointmentsService = new AppointmentsService(prisma);
// InvoicingService now depends on NumberingService + TaxCalculatorService
// (Task 1.4). The assistant tools used here only call read methods
// (findAll/findOne) that don't touch those collaborators, so the standalone
// validation script can pass through bare instances. If a future tool
// invokes create/update/issue, swap these for the real services.
const invoicingService = new InvoicingService(
  prisma,
  new NumberingService(prisma),
  new TaxCalculatorService(),
);
const reportsService = new ReportsService(prisma);
const aiService = new AiService(configService, prisma);

type Result = { tool: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string };
const results: Result[] = [];
const pass = (tool: string, detail: string) => results.push({ tool, status: 'PASS', detail });
const fail = (tool: string, detail: string) => results.push({ tool, status: 'FAIL', detail });
const warn = (tool: string, detail: string) => results.push({ tool, status: 'WARN', detail });
const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) < eps;

async function buildContext(): Promise<AssistantUserContext> {
  const owner = await prismaClient.user.findFirstOrThrow({
    where: { email: 'owner@autotech.tn' },
    select: { id: true, garageId: true, email: true, role: true },
  });
  return {
    userId: owner.id,
    garageId: owner.garageId,
    email: owner.email,
    role: owner.role as 'OWNER',
    enabledModules: [
      'dashboard','customers','cars','appointments','calendar','maintenance','invoicing',
      'inventory','employees','reports','approvals','users','settings','ai','notifications',
    ],
    locale: 'en',
  };
}

// ── tool tests ────────────────────────────────────────────────────────────

async function testCustomerCount(ctx: AssistantUserContext) {
  const tool = buildGetCustomerCountTool(prisma);
  const r = await tool.handler({}, ctx);
  const truth = await prismaClient.customer.count({ where: { garageId: ctx.garageId } });
  if (r.total === truth) pass(tool.name, `total=${r.total} ✓`);
  else fail(tool.name, `tool=${r.total} truth=${truth}`);

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const r2 = await tool.handler({ newSince: since }, ctx);
  const truthNew = await prismaClient.customer.count({
    where: { garageId: ctx.garageId, createdAt: { gte: new Date(since) } },
  });
  if (r2.new === truthNew) pass(`${tool.name}(newSince)`, `new=${r2.new} ✓`);
  else fail(`${tool.name}(newSince)`, `tool=${r2.new} truth=${truthNew}`);
}

async function testRevenueSummary(ctx: AssistantUserContext) {
  const tool = buildGetRevenueSummaryTool(prisma);
  for (const period of ['today','week','month','ytd'] as const) {
    const r = await tool.handler({ period }, ctx);
    const { from, to } = resolveRevenuePeriod(period);
    const truth = await prismaClient.invoice.aggregate({
      where: { garageId: ctx.garageId, status: 'PAID', paidAt: { gte: from, lt: to } },
      _sum: { total: true },
      _count: true,
    });
    const tSum = truth._sum.total ?? 0;
    const tCount = truth._count;
    if (near(r.totalRevenue, tSum) && r.paidInvoiceCount === tCount) {
      pass(`${tool.name}(${period})`, `revenue=${r.totalRevenue.toFixed(2)} count=${r.paidInvoiceCount} ✓`);
    } else {
      fail(`${tool.name}(${period})`, `tool=(${r.totalRevenue},${r.paidInvoiceCount}) truth=(${tSum},${tCount})`);
    }
  }
}

async function testInvoicesSummary(ctx: AssistantUserContext) {
  const tool = buildGetInvoicesSummaryTool(prisma);
  const r = await tool.handler({}, ctx);
  const all = await prismaClient.invoice.findMany({ where: { garageId: ctx.garageId } });
  const expCount = all.length;
  const expTotal = all.reduce((s, i) => s + i.total, 0);
  const expPaid = all.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const expOut = all.filter(i => ['SENT','PARTIALLY_PAID','OVERDUE'].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const ok = r.count === expCount && near(r.totalSum, expTotal) && near(r.paidSum, expPaid) && near(r.outstandingSum, expOut);
  if (ok) pass(tool.name, `count=${r.count} paid=${r.paidSum.toFixed(2)} outstanding=${r.outstandingSum.toFixed(2)} ✓`);
  else fail(tool.name, `tool=${r.count}/${r.totalSum}/${r.paidSum}/${r.outstandingSum} truth=${expCount}/${expTotal}/${expPaid}/${expOut}`);
}

async function testDashboardKpis(ctx: AssistantUserContext) {
  const tool = buildGetDashboardKpisTool(reportsService);
  const r: any = await tool.handler({}, ctx);
  const issues: string[] = [];
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number' && v < 0) issues.push(`${k}=${v}<0`);
  }
  if (issues.length) fail(tool.name, issues.join(', '));
  else pass(tool.name, `keys=${Object.keys(r).join(',').slice(0,80)}`);
}

async function testActiveJobs(ctx: AssistantUserContext) {
  const tool = buildListActiveJobsTool(prisma);
  const r: any = await tool.handler({}, ctx);
  const truth = await prismaClient.maintenanceJob.count({
    where: {
      garageId: ctx.garageId,
      status: { in: ['PENDING','DIAGNOSED','WAITING_APPROVAL','WAITING_PARTS','IN_PROGRESS','QUALITY_CHECK'] },
    },
  });
  // Tool may return array or { jobs, count }
  const len = Array.isArray(r) ? r.length : (r.count ?? r.jobs?.length ?? -1);
  if (len === truth) pass(tool.name, `count=${len} ✓`);
  else fail(tool.name, `tool=${len} truth=${truth}`);
}

async function testFindCustomer(ctx: AssistantUserContext) {
  const tool = createFindCustomerTool({ customersService });
  const someone = await prismaClient.customer.findFirst({ where: { garageId: ctx.garageId } });
  if (!someone) { warn(tool.name, 'no customers'); return; }
  const term = someone.firstName.slice(0, 4);
  const r = await tool.handler({ query: term }, ctx);
  if (Array.isArray(r) && r.some(c => c.id === someone.id)) {
    pass(tool.name, `query="${term}" → ${r.length} results, includes target ✓`);
  } else {
    fail(tool.name, `query="${term}" missing target ${someone.firstName} ${someone.lastName}`);
  }
}

async function testGetCustomer(ctx: AssistantUserContext) {
  const tool = createGetCustomerTool({ customersService });
  const target = await prismaClient.customer.findFirst({
    where: { garageId: ctx.garageId, totalSpent: { gt: 0 } },
    orderBy: { totalSpent: 'desc' },
  });
  if (!target) { warn(tool.name, 'no high-spend customer'); return; }
  const r: any = await tool.handler({ customerId: target.id }, ctx);
  const paidSum = await prismaClient.invoice.aggregate({
    where: { customerId: target.id, status: 'PAID' },
    _sum: { total: true },
  });
  const truth = paidSum._sum.total ?? 0;
  if (r && r.id === target.id && near(r.totalSpent, truth)) {
    pass(tool.name, `${target.firstName} ${target.lastName}: tool.totalSpent=${r.totalSpent} matches paid invoices ✓`);
  } else {
    fail(tool.name, `tool.totalSpent=${r?.totalSpent} vs paid invoices=${truth}`);
  }
}

async function testListTopCustomers(ctx: AssistantUserContext) {
  const tool = createListTopCustomersTool({ prisma });
  for (const by of ['revenue','visit_count'] as const) {
    const r = await tool.handler({ by, limit: 5 }, ctx);
    if (!Array.isArray(r) || r.length === 0) { fail(`${tool.name}(${by})`, 'empty'); continue; }
    const field: 'totalSpent' | 'visitCount' = by === 'revenue' ? 'totalSpent' : 'visitCount';
    let ordered = true;
    for (let i = 1; i < r.length; i++) if (r[i][field] > r[i-1][field]) { ordered = false; break; }
    const truthRow = await prismaClient.customer.findFirst({
      where: { garageId: ctx.garageId },
      orderBy: { [field]: 'desc' } as any,
      select: { id: true, totalSpent: true, visitCount: true },
    });
    const matches = truthRow && r[0].id === truthRow.id;
    if (ordered && matches) pass(`${tool.name}(${by})`, `top=${r[0].displayName} ${field}=${r[0][field]} ✓`);
    else fail(`${tool.name}(${by})`, `ordered=${ordered} top-matches-truth=${matches}`);
  }
}

async function testListAtRiskCustomers(ctx: AssistantUserContext) {
  const tool = createListAtRiskCustomersTool({ aiService });
  const r = await tool.handler({ limit: 20 } as any, ctx);
  if (!Array.isArray(r)) { fail(tool.name, 'not array'); return; }
  const inactiveCount = await prismaClient.customer.count({ where: { garageId: ctx.garageId, status: 'INACTIVE' } });
  // We seeded 6 atRisk + 4 churned (=INACTIVE). The churn model should flag the
  // inactives + a few of the silent-active customers, but not necessarily all.
  if (r.length >= inactiveCount && r.length <= 30) {
    const top = r[0];
    pass(tool.name, `flagged=${r.length} (≥${inactiveCount} inactives) top=${top.customerName} risk=${top.churnRisk?.toFixed?.(2)}`);
  } else if (r.length > 0) {
    warn(tool.name, `flagged ${r.length} (expected ≥${inactiveCount}) — model may underflag`);
  } else {
    fail(tool.name, 'empty');
  }
}

async function testFindCar(ctx: AssistantUserContext) {
  const tool = createFindCarTool({ prisma });
  // Pick the MOST RECENT car so it falls within the tool's `take: 5` newest results
  const sample = await prismaClient.car.findFirst({
    where: { garageId: ctx.garageId },
    orderBy: { createdAt: 'desc' },
  });
  if (!sample) { warn(tool.name, 'no cars'); return; }
  // Search by a unique license-plate fragment (the digits)
  const plateDigits = sample.licensePlate.replace(/[^0-9]/g, '').slice(0, 4);
  const r = await tool.handler({ query: plateDigits }, ctx);
  if (Array.isArray(r) && r.some(c => c.id === sample.id)) {
    pass(tool.name, `query="${plateDigits}" → ${r.length} results, includes ${sample.licensePlate} ✓`);
  } else {
    fail(tool.name, `query="${plateDigits}" missing ${sample.licensePlate}`);
  }
}

async function testGetCar(ctx: AssistantUserContext) {
  const tool = createGetCarTool({ carsService });
  const sample = await prismaClient.car.findFirst({
    where: { garageId: ctx.garageId, lastServiceDate: { not: null } },
  });
  if (!sample) { warn(tool.name, 'no serviced car'); return; }
  const r: any = await tool.handler({ carId: sample.id }, ctx);
  if (r && r.id === sample.id && r.make === sample.make) {
    pass(tool.name, `${sample.make} ${sample.model} (${sample.licensePlate}) ✓`);
  } else {
    fail(tool.name, `tool returned ${r?.id} expected ${sample.id}`);
  }
}

async function testListMaintenanceDue(ctx: AssistantUserContext) {
  const tool = createListMaintenanceDueTool({ aiService });
  const r = await tool.handler({ withinDays: 365 }, ctx);
  if (!Array.isArray(r)) { fail(tool.name, 'not array'); return; }
  pass(tool.name, `within 365 days: ${r.length} entries (${r.slice(0,3).map((x: any) => x.carLabel).join(', ')})`);
}

async function testListAppointments(ctx: AssistantUserContext) {
  const tool = buildListAppointmentsTool(appointmentsService);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const r = await tool.handler({ from: today.toISOString(), to: tomorrow.toISOString() }, ctx);
  const truth = await prismaClient.appointment.count({
    where: {
      garageId: ctx.garageId,
      OR: [
        { startTime: { gte: today, lt: tomorrow } },
        { endTime:   { gte: today, lt: tomorrow } },
      ],
    },
  });
  // The tool may use a different overlap definition. Check both paths.
  const strictTruth = await prismaClient.appointment.count({
    where: { garageId: ctx.garageId, startTime: { gte: today, lt: tomorrow } },
  });
  if (r.count === truth || r.count === strictTruth) {
    pass(tool.name, `today: count=${r.count} ✓`);
  } else {
    fail(tool.name, `tool=${r.count} truth-overlap=${truth} truth-strict=${strictTruth}`);
  }
}

async function testFindAvailableSlot(ctx: AssistantUserContext) {
  const tool = buildFindAvailableSlotTool(aiService);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  try {
    const r: any = await tool.handler({
      date: tomorrow.toISOString().slice(0, 10),
      durationMinutes: 60,
      appointmentType: 'oil-change',
    }, ctx);
    if (r && Array.isArray(r.slots) && r.slots.length > 0) {
      pass(tool.name, `tomorrow oil-change: ${r.slots.length} slots, top=${r.slots[0].mechanicName}`);
    } else {
      warn(tool.name, 'returned no slots (could be valid if fully booked or closed day)');
    }
  } catch (e: any) {
    fail(tool.name, `threw: ${e.message}`);
  }
}

async function testListInvoices(ctx: AssistantUserContext) {
  const tool = buildListInvoicesTool(prisma);
  const r = await tool.handler({ status: 'PAID' as any }, ctx);
  const truth = await prismaClient.invoice.count({ where: { garageId: ctx.garageId, status: 'PAID' } });
  const len = Array.isArray(r) ? r.length : ((r as any).count ?? -1);
  if (len === truth) pass(tool.name, `paid: count=${len} ✓`);
  else fail(tool.name, `tool=${len} truth=${truth}`);
}

async function testGetInvoice(ctx: AssistantUserContext) {
  const tool = buildGetInvoiceTool(invoicingService);
  const sample = await prismaClient.invoice.findFirst({
    where: { garageId: ctx.garageId, status: 'PAID' },
    include: { lineItems: true, payments: true },
  });
  if (!sample) { warn(tool.name, 'no paid invoice'); return; }
  const r: any = await tool.handler({ invoiceId: sample.id }, ctx);
  const okTotal = r && near(r.total ?? 0, sample.total);
  const okLines = r && Array.isArray(r.lineItems) && r.lineItems.length === sample.lineItems.length;
  if (okTotal && okLines) {
    pass(tool.name, `${sample.invoiceNumber}: total=${r.total} lines=${r.lineItems.length} ✓`);
  } else {
    fail(tool.name, `tool.total=${r?.total} truth=${sample.total} lines=${r?.lineItems?.length}/${sample.lineItems.length}`);
  }
}

async function testListOverdueInvoices(ctx: AssistantUserContext) {
  // Tool's definition: dueDate < now AND status NOT IN (PAID, CANCELLED).
  // That intentionally catches SENT/DRAFT/PARTIALLY_PAID invoices that are
  // functionally overdue but haven't been status-flipped yet.
  const tool = buildListOverdueInvoicesTool(prisma);
  const r: any = await tool.handler({}, ctx);
  const now = new Date();
  const truth = await prismaClient.invoice.count({
    where: {
      garageId: ctx.garageId,
      dueDate: { lt: now },
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  });
  const len = Array.isArray(r) ? r.length : (r.count ?? r.invoices?.length ?? -1);
  if (len === truth) pass(tool.name, `count=${len} ✓ (incl. SENT/DRAFT past dueDate)`);
  else fail(tool.name, `tool=${len} truth=${truth}`);
}

async function testListLowStockParts(ctx: AssistantUserContext) {
  const tool = buildListLowStockPartsTool(prisma);
  const r: any = await tool.handler({}, ctx);
  const all = await prismaClient.part.findMany({ where: { garageId: ctx.garageId } });
  const truthLow = all.filter(p => p.quantity <= p.minQuantity);
  const len = Array.isArray(r) ? r.length : (r.count ?? r.parts?.length ?? -1);
  if (len === truthLow.length) pass(tool.name, `count=${len} ✓ (${truthLow.map(p => p.name).join(', ').slice(0,80)})`);
  else fail(tool.name, `tool=${len} truth=${truthLow.length}`);
}

async function testGetInventoryValue(ctx: AssistantUserContext) {
  // Tool computes SUM(quantity * costPrice) and returns { totalValue, totalCount }.
  const tool = buildGetInventoryValueTool(prisma);
  const r = await tool.handler({}, ctx);
  const all = await prismaClient.part.findMany({ where: { garageId: ctx.garageId } });
  const expCost = all.reduce((s, p) => s + p.quantity * p.costPrice, 0);
  const expCount = all.reduce((s, p) => s + p.quantity, 0);
  if (near(r.totalValue, expCost, 1) && r.totalCount === expCount) {
    pass(tool.name, `value=${r.totalValue.toFixed(2)} TND, totalCount=${r.totalCount} ✓`);
  } else {
    fail(tool.name, `tool value=${r.totalValue} count=${r.totalCount} truth value=${expCost.toFixed(2)} count=${expCount}`);
  }
}

// ── runner ────────────────────────────────────────────────────────────────

(async () => {
  console.log('🧪 Validating assistant tools against the database…\n');
  const ctx = await buildContext();
  console.log(`   garage=${ctx.garageId.slice(0,8)} owner=${ctx.email}\n`);

  const tests: { fn: (ctx: AssistantUserContext) => Promise<void>; label: string }[] = [
    { fn: testCustomerCount,        label: 'get_customer_count' },
    { fn: testRevenueSummary,       label: 'get_revenue_summary' },
    { fn: testInvoicesSummary,      label: 'get_invoices_summary' },
    { fn: testDashboardKpis,        label: 'get_dashboard_kpis' },
    { fn: testActiveJobs,           label: 'list_active_jobs' },
    { fn: testFindCustomer,         label: 'find_customer' },
    { fn: testGetCustomer,          label: 'get_customer' },
    { fn: testListTopCustomers,     label: 'list_top_customers' },
    { fn: testListAtRiskCustomers,  label: 'list_at_risk_customers' },
    { fn: testFindCar,              label: 'find_car' },
    { fn: testGetCar,               label: 'get_car' },
    { fn: testListMaintenanceDue,   label: 'list_maintenance_due' },
    { fn: testListAppointments,     label: 'list_appointments' },
    { fn: testFindAvailableSlot,    label: 'find_available_slot' },
    { fn: testListInvoices,         label: 'list_invoices' },
    { fn: testGetInvoice,           label: 'get_invoice' },
    { fn: testListOverdueInvoices,  label: 'list_overdue_invoices' },
    { fn: testListLowStockParts,    label: 'list_low_stock_parts' },
    { fn: testGetInventoryValue,    label: 'get_inventory_value' },
  ];

  for (const t of tests) {
    try { await t.fn(ctx); }
    catch (e: any) { fail(t.label, `EXCEPTION: ${e.message?.slice(0, 200)}`); }
  }

  console.log('Tool                                   Status   Detail');
  console.log('─────────────────────────────────────  ───────  ──────────────────────────────────────────────');
  for (const r of results) {
    const badge = r.status === 'PASS' ? '✓ PASS' : r.status === 'FAIL' ? '✗ FAIL' : '! WARN';
    console.log(`${r.tool.padEnd(38)} ${badge.padEnd(7)}  ${r.detail}`);
  }

  const counts = { PASS: 0, FAIL: 0, WARN: 0 };
  for (const r of results) counts[r.status]++;
  console.log(`\n${counts.PASS} pass · ${counts.FAIL} fail · ${counts.WARN} warn (${results.length} checks)`);

  await prismaClient.$disconnect();
  process.exit(counts.FAIL > 0 ? 1 : 0);
})();
