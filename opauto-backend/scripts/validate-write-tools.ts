/**
 * Direct-call validator for every WRITE-tier assistant tool.
 *
 * Bypasses the LLM and the orchestrator's approval gate (CONFIRM_WRITE /
 * TYPED_CONFIRM_WRITE handlers can be invoked directly here — we are
 * testing handler correctness, NOT the approval flow). For each tool we
 * exercise at least one happy path + one negative path against the real
 * local Postgres test DB, then tear down anything we created so repeated
 * runs stay idempotent.
 *
 *   npx ts-node scripts/validate-write-tools.ts
 */

import 'dotenv/config';
import { PrismaClient, AppointmentStatus, InvoiceStatus } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AssistantUserContext } from '../src/assistant/types';
import type { SmsProvider, SmsSendResult } from '../src/sms/providers/sms-provider.interface';

import { CustomersService } from '../src/customers/customers.service';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { InvoicingService } from '../src/invoicing/invoicing.service';
import { NumberingService } from '../src/invoicing/numbering.service';
import { TaxCalculatorService } from '../src/invoicing/tax-calculator.service';
import { SmsService } from '../src/sms/sms.service';

import { buildCreateAppointmentTool } from '../src/assistant/tools/appointments/create-appointment.tool';
import { buildCancelAppointmentTool } from '../src/assistant/tools/appointments/cancel-appointment.tool';
import { buildRecordPaymentTool } from '../src/assistant/tools/invoicing-inventory/record-payment.tool';
import { createSendSmsTool } from '../src/assistant/tools/communications/send-sms.tool';

// ── infra wiring ─────────────────────────────────────────────────────────

const prismaClient = new PrismaClient();
const prisma = prismaClient as unknown as PrismaService;

const customersService = new CustomersService(prisma);
const appointmentsService = new AppointmentsService(prisma);
const numberingService = new NumberingService(prisma);
const taxCalculator = new TaxCalculatorService();
const invoicingService = new InvoicingService(prisma, numberingService, taxCalculator);

class CapturingSmsProvider implements SmsProvider {
  public lastTo: string | null = null;
  public lastBody: string | null = null;
  public callCount = 0;
  async send(to: string, body: string): Promise<SmsSendResult> {
    this.callCount++;
    this.lastTo = to;
    this.lastBody = body;
    return { providerMessageId: `mock-sms-${Date.now()}`, status: 'queued' };
  }
}

const capturingSmsProvider = new CapturingSmsProvider();
const smsService = new SmsService(capturingSmsProvider);

// ── result tracking ──────────────────────────────────────────────────────

type Result = { tool: string; status: 'PASS' | 'FAIL'; detail: string };
const results: Result[] = [];
const pass = (tool: string, detail: string) => {
  results.push({ tool, status: 'PASS', detail });
  console.log(`[PASS] ${tool} — ${detail}`);
};
const fail = (tool: string, detail: string, reason?: string) => {
  const full = reason ? `${detail} — ${reason}` : detail;
  results.push({ tool, status: 'FAIL', detail: full });
  console.log(`[FAIL] ${tool} — ${full}`);
};

// ── tear-down tracker ────────────────────────────────────────────────────

const cleanup: {
  appointmentIds: string[];
  paymentIds: string[];
  invoiceIds: string[];
  customerIds: string[];
  carIds: string[];
  garageIds: string[];
  userIds: string[];
} = {
  appointmentIds: [],
  paymentIds: [],
  invoiceIds: [],
  customerIds: [],
  carIds: [],
  garageIds: [],
  userIds: [],
};

// ── context builder ──────────────────────────────────────────────────────

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

// Build a transient secondary garage + customer + car + user for the
// tenant-isolation negative tests. Tracked for tear-down.
async function buildForeignTenant(): Promise<{
  garageId: string;
  customerId: string;
  carId: string;
  userId: string;
}> {
  const suffix = Date.now().toString(36).slice(-6);
  const garage = await prismaClient.garage.create({
    data: {
      name: `__validate-write-tools-${suffix}__`,
      currency: 'TND',
    },
  });
  cleanup.garageIds.push(garage.id);

  const user = await prismaClient.user.create({
    data: {
      garageId: garage.id,
      email: `_vwt-${suffix}@example.invalid`,
      role: 'OWNER',
      password: 'NOT-A-REAL-HASH',
      firstName: 'Foreign',
      lastName: `User-${suffix}`,
    },
  });
  cleanup.userIds.push(user.id);

  const customer = await prismaClient.customer.create({
    data: {
      garageId: garage.id,
      firstName: 'Foreign',
      lastName: `Tenant-${suffix}`,
      phone: '+21699999999',
    },
  });
  cleanup.customerIds.push(customer.id);

  const car = await prismaClient.car.create({
    data: {
      garageId: garage.id,
      customerId: customer.id,
      make: 'TestMake',
      model: 'TestModel',
      year: 2020,
      licensePlate: `TST-${suffix}`,
    },
  });
  cleanup.carIds.push(car.id);

  return { garageId: garage.id, customerId: customer.id, carId: car.id, userId: user.id };
}

// Pick (or fabricate) a customer/car pair within the primary garage.
async function pickPrimaryCustomerAndCar(garageId: string): Promise<{ customerId: string; carId: string; phone: string }> {
  const car = await prismaClient.car.findFirst({
    where: { garageId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!car) throw new Error('No car in primary garage — seed first');
  return {
    customerId: car.customerId,
    carId: car.id,
    phone: car.customer.phone,
  };
}

// ── tests ────────────────────────────────────────────────────────────────

async function testCreateAppointment(ctx: AssistantUserContext) {
  const tool = buildCreateAppointmentTool(appointmentsService, prisma);

  // Sanity: the tool must declare CONFIRM_WRITE. We bypass the gate.
  if (tool.blastTier !== 'CONFIRM_WRITE') {
    fail(tool.name, 'tier mismatch', `expected CONFIRM_WRITE got ${tool.blastTier}`);
  }

  const { customerId, carId } = await pickPrimaryCustomerAndCar(ctx.garageId);

  // Happy path: future-dated 30-min slot.
  const start = new Date(Date.now() + 7 * 86400000);
  start.setMinutes(0, 0, 0);
  try {
    const r = await tool.handler(
      {
        customerId,
        carId,
        scheduledAt: start.toISOString(),
        durationMinutes: 30,
        title: '__vwt-happy-path__',
        type: 'inspection',
      },
      ctx,
    );
    cleanup.appointmentIds.push(r.appointmentId);

    const persisted = await prismaClient.appointment.findUnique({ where: { id: r.appointmentId } });
    if (!persisted || persisted.garageId !== ctx.garageId || persisted.title !== '__vwt-happy-path__') {
      fail(tool.name, 'happy path: row not found or wrong garage', JSON.stringify(persisted));
    } else {
      const expectedEnd = new Date(start.getTime() + 30 * 60_000).toISOString();
      const okEnd = new Date(persisted.endTime).toISOString() === expectedEnd;
      if (!okEnd) fail(tool.name, 'happy path: endTime mismatch', `${persisted.endTime} vs ${expectedEnd}`);
      else pass(tool.name, `happy path inserted appointment ${r.appointmentId.slice(0, 8)} (endTime computed correctly)`);
    }
  } catch (e: any) {
    fail(tool.name, 'happy path threw', e.message);
  }

  // Negative: bogus customerId.
  try {
    await tool.handler(
      {
        customerId: '00000000-0000-0000-0000-000000000000',
        carId,
        scheduledAt: start.toISOString(),
        durationMinutes: 30,
      },
      ctx,
    );
    fail(tool.name, 'negative path: bogus customerId was accepted');
  } catch (e: any) {
    if (/not found/i.test(e.message)) {
      pass(tool.name, `negative path rejects unknown customerId (${e.message.slice(0, 60)})`);
    } else {
      fail(tool.name, 'negative path threw wrong error', e.message);
    }
  }
}

async function testCancelAppointment(ctx: AssistantUserContext) {
  const tool = buildCancelAppointmentTool(appointmentsService);
  if (tool.blastTier !== 'CONFIRM_WRITE') {
    fail(tool.name, 'tier mismatch', `expected CONFIRM_WRITE got ${tool.blastTier}`);
  }

  const { customerId, carId } = await pickPrimaryCustomerAndCar(ctx.garageId);

  // Set up a fresh appointment to cancel (happy path).
  const start = new Date(Date.now() + 8 * 86400000);
  start.setMinutes(0, 0, 0);
  const appt = await prismaClient.appointment.create({
    data: {
      garageId: ctx.garageId,
      customerId,
      carId,
      title: '__vwt-cancel-target__',
      startTime: start,
      endTime: new Date(start.getTime() + 30 * 60_000),
      status: AppointmentStatus.SCHEDULED,
    },
  });
  cleanup.appointmentIds.push(appt.id);

  try {
    const r = await tool.handler({ appointmentId: appt.id, reason: 'validate-write-tools' }, ctx);
    if (!r.cancelled) fail(tool.name, 'happy path: returned cancelled=false');
    else {
      const after = await prismaClient.appointment.findUnique({ where: { id: appt.id } });
      if (after?.status !== AppointmentStatus.CANCELLED) {
        fail(tool.name, 'happy path: status not flipped', `actual=${after?.status}`);
      } else if (!after.notes || !after.notes.includes('validate-write-tools')) {
        fail(tool.name, 'happy path: reason not appended to notes', `notes=${after.notes}`);
      } else {
        pass(tool.name, `happy path: status=CANCELLED, reason appended to notes`);
      }
    }
  } catch (e: any) {
    fail(tool.name, 'happy path threw', e.message);
  }

  // Negative: appointment from another garage.
  const foreign = await buildForeignTenant();
  const foreignAppt = await prismaClient.appointment.create({
    data: {
      garageId: foreign.garageId,
      customerId: foreign.customerId,
      carId: foreign.carId,
      title: '__vwt-foreign-appt__',
      startTime: new Date(start.getTime() + 86400000),
      endTime: new Date(start.getTime() + 86400000 + 30 * 60_000),
      status: AppointmentStatus.SCHEDULED,
    },
  });
  cleanup.appointmentIds.push(foreignAppt.id);

  try {
    await tool.handler({ appointmentId: foreignAppt.id }, ctx);
    fail(tool.name, 'negative path: foreign-garage appointment was cancelled (cross-tenant leak!)');
  } catch (e: any) {
    if (/not found/i.test(e.message)) {
      pass(tool.name, `negative path rejects foreign-garage appointment (${e.message.slice(0, 60)})`);
    } else {
      fail(tool.name, 'negative path threw wrong error', e.message);
    }
  }
}

async function testRecordPayment(ctx: AssistantUserContext) {
  const tool = buildRecordPaymentTool(prisma, invoicingService);

  // record_payment is documented in code comments as TYPED_CONFIRM_WRITE.
  if (tool.blastTier !== 'TYPED_CONFIRM_WRITE') {
    fail(tool.name, 'tier mismatch', `expected TYPED_CONFIRM_WRITE got ${tool.blastTier}`);
  }

  // Happy path — find an unpaid SENT invoice; if none exist, create a
  // fresh DRAFT and issue it so we have something to pay.
  let invoice = await prismaClient.invoice.findFirst({
    where: {
      garageId: ctx.garageId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.VIEWED] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!invoice) {
    const { customerId, carId } = await pickPrimaryCustomerAndCar(ctx.garageId);
    const draft = await invoicingService.create(ctx.garageId, {
      customerId,
      carId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      lineItems: [
        { description: '__vwt-record-payment-line__', quantity: 1, unitPrice: 100, type: 'service' },
      ],
    });
    cleanup.invoiceIds.push(draft.id);
    invoice = await invoicingService.issue(draft.id, ctx.garageId, ctx.userId);
  }

  try {
    const r = await tool.handler(
      {
        invoiceId: invoice.id,
        amount: invoice.total,
        method: 'CASH',
        _expectedConfirmation: invoice.invoiceNumber,
      },
      ctx,
    );
    cleanup.paymentIds.push(r.paymentId);

    const after = await prismaClient.invoice.findUnique({
      where: { id: invoice.id },
      include: { payments: true },
    });
    const paidOk = after?.status === InvoiceStatus.PAID;
    const paymentRowOk = after?.payments.some((p) => p.id === r.paymentId);
    const balanceOk = Math.abs(r.newBalance) < 0.01;
    if (paidOk && paymentRowOk && balanceOk) {
      pass(tool.name, `happy path: invoice → PAID, Payment row inserted, newBalance=${r.newBalance.toFixed(2)}`);
    } else {
      fail(tool.name, 'happy path: post-conditions not met', `paid=${paidOk} payment=${paymentRowOk} bal=${r.newBalance}`);
    }
  } catch (e: any) {
    fail(tool.name, 'happy path threw', e.message);
  }

  // Negative: pay an already-PAID invoice. The service flips it to PAID
  // again (no demote happens) — but we expect the handler / service NOT
  // to silently double-charge. The actual current behavior: the
  // InvoicingService.addPayment path inserts another Payment row and
  // re-runs the recompute, leaving status=PAID. That is arguably
  // permissive — record this in the report rather than fixing it.
  const paidInvoice = await prismaClient.invoice.findFirst({
    where: { garageId: ctx.garageId, status: InvoiceStatus.PAID },
    orderBy: { paidAt: 'desc' },
  });
  if (!paidInvoice) {
    fail(tool.name, 'negative path: no PAID invoice available to attempt double-pay');
  } else {
    const beforeCount = await prismaClient.payment.count({ where: { invoiceId: paidInvoice.id } });
    let threw = false;
    let extraPaymentId: string | null = null;
    try {
      const r = await tool.handler(
        {
          invoiceId: paidInvoice.id,
          amount: 1,
          method: 'CASH',
          _expectedConfirmation: paidInvoice.invoiceNumber,
        },
        ctx,
      );
      extraPaymentId = r.paymentId;
      if (extraPaymentId) cleanup.paymentIds.push(extraPaymentId);
    } catch {
      threw = true;
    }
    const afterCount = await prismaClient.payment.count({ where: { invoiceId: paidInvoice.id } });
    if (threw) {
      pass(tool.name, `negative path: paying an already-PAID invoice was rejected`);
    } else if (afterCount > beforeCount) {
      fail(tool.name, 'negative path: handler accepted a payment against an already-PAID invoice (extra Payment row created)', `bug: silent double-charge possible`);
    } else {
      pass(tool.name, `negative path: handler did not insert a duplicate payment row (count unchanged: ${afterCount})`);
    }
  }
}

async function testCreateInvoice(ctx: AssistantUserContext) {
  // NOTE: there is no `create_invoice` assistant tool registered today
  // (`src/assistant/tools/invoicing-inventory/` has list/get/overdue/low-stock/
  // record-payment but no create-invoice.tool.ts). The user task assumes
  // it exists. We test the underlying InvoicingService.create + issue flow
  // — which is what such a tool would wrap — so a future tool author has
  // a regression net for the gapless-numbering + per-line TVA + fiscal
  // stamp invariants.
  const toolName = 'create_invoice (synthetic — InvoicingService.create + issue)';

  const { customerId, carId } = await pickPrimaryCustomerAndCar(ctx.garageId);

  // Happy path: 2-line invoice, mixed TVA (19% + 7%).
  try {
    const draft = await invoicingService.create(ctx.garageId, {
      customerId,
      carId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      lineItems: [
        { description: '__vwt-create-invoice-labor__', quantity: 1, unitPrice: 200, tvaRate: 19, type: 'labor' },
        { description: '__vwt-create-invoice-part__', quantity: 2, unitPrice: 50, tvaRate: 7, type: 'part' },
      ],
    });
    cleanup.invoiceIds.push(draft.id);
    if (!draft.invoiceNumber.startsWith('DRAFT-')) {
      fail(toolName, 'happy path: DRAFT had a fiscal number assigned', `invoiceNumber=${draft.invoiceNumber}`);
    }

    // Capture the next-expected fiscal seq BEFORE issuing so we can
    // assert gapless allocation.
    const garage = await prismaClient.garage.findUniqueOrThrow({
      where: { id: ctx.garageId },
      select: { numberingResetPolicy: true, numberingPrefix: true, numberingDigitCount: true },
    });
    const now = new Date();
    const yearKey =
      garage.numberingResetPolicy === 'NEVER' ? 0 :
      garage.numberingResetPolicy === 'YEARLY' ? now.getFullYear() :
      now.getFullYear() * 100 + (now.getMonth() + 1);
    const before = await prismaClient.invoiceCounter.findUnique({
      where: { garageId_kind_year: { garageId: ctx.garageId, kind: 'INVOICE', year: yearKey } },
      select: { lastIssued: true },
    });
    const expectedSeq = (before?.lastIssued ?? 0) + 1;

    const issued = await invoicingService.issue(draft.id, ctx.garageId, ctx.userId);

    // Fiscal number checks.
    const seqMatch = issued.invoiceNumber.match(/(\d+)$/);
    const actualSeq = seqMatch ? parseInt(seqMatch[1], 10) : -1;
    if (actualSeq !== expectedSeq) {
      fail(toolName, 'happy path: gapless numbering mismatch', `expected seq=${expectedSeq} got ${actualSeq} (number=${issued.invoiceNumber})`);
    } else if (issued.issuedNumber !== expectedSeq) {
      fail(toolName, 'happy path: issuedNumber mismatch', `expected ${expectedSeq} got ${issued.issuedNumber}`);
    } else {
      pass(toolName, `happy path: fiscal number=${issued.invoiceNumber}, gapless seq=${actualSeq}`);
    }

    // Per-line TVA recompute.
    // Line 1: 1 × 200 × 19% = 38; Line 2: 2 × 50 × 7% = 7.
    // Subtotal HT = 200 + 100 = 300; TVA total = 45; fiscal stamp = 1; total TTC = 346.
    const expectedSubtotal = 300;
    const expectedTva = 45;
    const stampOk = issued.fiscalStamp >= 0.5; // garage default is enabled (1.0).
    const subtotalOk = Math.abs(issued.subtotal - expectedSubtotal) < 0.5;
    const tvaOk = Math.abs(issued.taxAmount - expectedTva) < 0.5;
    const expectedTotal = expectedSubtotal + expectedTva + (issued.fiscalStamp ?? 0);
    const totalOk = Math.abs(issued.total - expectedTotal) < 0.5;
    if (subtotalOk && tvaOk && stampOk && totalOk) {
      pass(toolName, `per-line TVA: subtotal=${issued.subtotal} TVA=${issued.taxAmount} stamp=${issued.fiscalStamp} total=${issued.total}`);
    } else {
      fail(toolName, 'per-line TVA / stamp / total mismatch',
        `subtotal=${issued.subtotal} (exp ${expectedSubtotal}) TVA=${issued.taxAmount} (exp ${expectedTva}) stamp=${issued.fiscalStamp} total=${issued.total} (exp ~${expectedTotal})`);
    }
  } catch (e: any) {
    fail(toolName, 'happy path threw', e.message);
  }

  // Negative: missing line items. The DTO declares `lineItems` required
  // — the service-level call should reject (or at minimum produce an
  // unusable invoice). We pass an empty array directly to the service
  // (DTO validation is normally done at the controller layer).
  try {
    const draft = await invoicingService.create(ctx.garageId, {
      customerId,
      carId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      lineItems: [],
    });
    cleanup.invoiceIds.push(draft.id);
    // The service did not reject. Now try to issue — issue() must reject
    // an invoice with no line items (it explicitly checks).
    try {
      await invoicingService.issue(draft.id, ctx.garageId, ctx.userId);
      fail(toolName, 'negative path: issue() accepted an invoice with no line items');
    } catch (e: any) {
      if (/at least one line item/i.test(e.message)) {
        pass(toolName, `negative path: issue() rejects empty-line-items invoice (${e.message.slice(0, 60)})`);
      } else {
        fail(toolName, 'negative path: issue() threw wrong error', e.message);
      }
    }
  } catch (e: any) {
    pass(toolName, `negative path: create() rejected empty line-items at DTO layer (${e.message.slice(0, 60)})`);
  }
}

async function testSendSms(ctx: AssistantUserContext) {
  const tool = createSendSmsTool({ smsService, customersService });

  if (tool.blastTier !== 'CONFIRM_WRITE') {
    fail(tool.name, 'tier mismatch', `expected CONFIRM_WRITE got ${tool.blastTier}`);
  }

  // Happy path: pick a customer with a phone, send SMS, assert provider
  // captured the exact payload.
  const customer = await prismaClient.customer.findFirstOrThrow({
    where: { garageId: ctx.garageId },
  });
  const beforeCount = capturingSmsProvider.callCount;
  const body = `__vwt-sms-${Date.now()}__`;

  try {
    const r = await tool.handler(
      {
        to: customer.phone,
        body,
        customerId: customer.id,
      },
      ctx,
    );
    if ('error' in (r as any)) {
      fail(tool.name, 'happy path returned error', JSON.stringify(r));
    } else {
      const incremented = capturingSmsProvider.callCount === beforeCount + 1;
      const phoneOk = capturingSmsProvider.lastTo === customer.phone;
      const bodyOk = capturingSmsProvider.lastBody === body;
      if (incremented && phoneOk && bodyOk) {
        pass(tool.name, `happy path: provider called with to=${customer.phone.slice(0, 5)}…, exact body match`);
      } else {
        fail(tool.name, 'happy path: provider received wrong payload',
          `incr=${incremented} phoneOk=${phoneOk} bodyOk=${bodyOk}`);
      }
    }
  } catch (e: any) {
    fail(tool.name, 'happy path threw', e.message);
  }

  // Negative: missing phone (empty string). The JSON-schema declares
  // `to` as minLength: 8 — but the handler doesn't re-validate, so we
  // expect either a schema-layer rejection or a provider-layer error.
  // Since we bypass schema validation, the handler accepts whatever we
  // pass. Pass an empty string and check that it fails out cleanly.
  const before2 = capturingSmsProvider.callCount;
  let result: any;
  let threw = false;
  try {
    result = await tool.handler({ to: '', body: 'hi' }, ctx);
  } catch {
    threw = true;
  }
  const callsIncremented = capturingSmsProvider.callCount > before2;
  if (threw) {
    pass(tool.name, `negative path: empty phone rejected via thrown error (provider not called)`);
  } else if (result && 'error' in result) {
    pass(tool.name, `negative path: empty phone returned error=${result.error} (provider not called: ${!callsIncremented})`);
  } else if (callsIncremented) {
    fail(tool.name, 'negative path: empty phone reached the provider (handler does not pre-validate `to`)',
      `bug: orchestrator JSON-schema is the only guard`);
  } else {
    pass(tool.name, `negative path: empty phone accepted by handler but provider not called`);
  }
}

// ── tear-down ────────────────────────────────────────────────────────────

async function teardown() {
  // Delete in dependency order. Catch + log per row so a stale id never
  // blocks the rest of the cleanup.
  const safe = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e: any) { console.warn(`  ! teardown ${label}: ${e.message?.slice(0, 100)}`); }
  };

  console.log('\nTearing down test fixtures…');

  for (const id of cleanup.paymentIds) {
    await safe(`payment ${id}`, () => prismaClient.payment.delete({ where: { id } }));
  }
  for (const id of cleanup.appointmentIds) {
    await safe(`appointment ${id}`, () => prismaClient.appointment.delete({ where: { id } }));
  }
  // Synthetic invoices created by validate-write-tools all have a marker
  // line item or are still DRAFT. Force-delete via raw cascade by
  // removing dependent rows first.
  for (const id of cleanup.invoiceIds) {
    await safe(`invoice deps ${id}`, async () => {
      await prismaClient.payment.deleteMany({ where: { invoiceId: id } });
      await prismaClient.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await prismaClient.discountAuditLog.deleteMany({ where: { invoiceId: id } });
      await prismaClient.deliveryLog.deleteMany({ where: { invoiceId: id } });
    });
    await safe(`invoice ${id}`, () => prismaClient.invoice.delete({ where: { id } }));
  }
  // Foreign-tenant fixtures: cars → customers → users → garage.
  for (const id of cleanup.carIds) {
    await safe(`car ${id}`, () => prismaClient.car.delete({ where: { id } }));
  }
  for (const id of cleanup.customerIds) {
    await safe(`customer ${id}`, () => prismaClient.customer.delete({ where: { id } }));
  }
  for (const id of cleanup.userIds) {
    await safe(`user ${id}`, () => prismaClient.user.delete({ where: { id } }));
  }
  for (const id of cleanup.garageIds) {
    await safe(`garage ${id}`, () => prismaClient.garage.delete({ where: { id } }));
  }
}

// ── runner ───────────────────────────────────────────────────────────────

(async () => {
  console.log('Validating WRITE-tier assistant tools against the database…');
  console.log('(handlers invoked directly — orchestrator approval gate is bypassed by design)\n');

  const ctx = await buildContext();
  console.log(`   garage=${ctx.garageId.slice(0, 8)} owner=${ctx.email}\n`);

  const tests: { fn: (c: AssistantUserContext) => Promise<void>; label: string }[] = [
    { fn: testCreateAppointment, label: 'create_appointment' },
    { fn: testCancelAppointment, label: 'cancel_appointment' },
    { fn: testRecordPayment,     label: 'record_payment' },
    { fn: testCreateInvoice,     label: 'create_invoice (synthetic)' },
    { fn: testSendSms,           label: 'send_sms' },
  ];

  for (const t of tests) {
    try { await t.fn(ctx); }
    catch (e: any) { fail(t.label, `EXCEPTION ${e.message?.slice(0, 200)}`); }
  }

  await teardown();

  const counts = { PASS: 0, FAIL: 0 };
  for (const r of results) counts[r.status]++;
  console.log(`\n${counts.PASS} pass · ${counts.FAIL} fail (${results.length} assertions)`);

  await prismaClient.$disconnect();
  process.exit(counts.FAIL > 0 ? 1 : 0);
})();
