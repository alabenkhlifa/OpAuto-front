/**
 * Validate the send_email tool end-to-end without hitting Resend.
 *
 * Stubs in a capturing email driver, runs the tool with attachInvoiceIds,
 * and asserts the captured payload (recipient, subject, body, attachment
 * filename + decoded CSV contents) matches what we'd send for real.
 *
 *   npx ts-node scripts/validate-send-email.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AssistantUserContext } from '../src/assistant/types';
import type { EmailProvider, EmailSendInput, EmailSendResult } from '../src/email/providers/email-provider.interface';
import { EmailService } from '../src/email/email.service';
import { createSendEmailTool } from '../src/assistant/tools/communications/send-email.tool';

const prismaClient = new PrismaClient();
const prisma = prismaClient as unknown as PrismaService;

class CapturingDriver implements EmailProvider {
  public lastInput: EmailSendInput | null = null;
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    this.lastInput = input;
    return { providerMessageId: `mock-${Date.now()}`, status: 'queued' };
  }
}

(async () => {
  const owner = await prismaClient.user.findFirstOrThrow({
    where: { email: 'owner@autotech.tn' },
    select: { id: true, garageId: true, email: true, role: true },
  });
  const ctx: AssistantUserContext = {
    userId: owner.id,
    garageId: owner.garageId,
    email: owner.email,
    role: owner.role as 'OWNER',
    enabledModules: ['ai', 'invoicing'],
    locale: 'en',
  };

  // Pick 5 invoices with mixed statuses for the CSV
  const sampleInvoices = await prismaClient.invoice.findMany({
    where: { garageId: ctx.garageId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, payments: true },
  });
  if (sampleInvoices.length === 0) {
    console.error('✗ no invoices to attach — seed first');
    process.exit(1);
  }
  const ids = sampleInvoices.map((i) => i.id);

  const driver = new CapturingDriver();
  const emailService = new EmailService(driver);
  const tool = createSendEmailTool({ emailService, prisma });

  // ── 1. Tier is AUTO_WRITE (no resolver — always self-send) ───────────
  const tierOk = tool.blastTier === 'AUTO_WRITE' && tool.resolveBlastTier === undefined;
  console.log(`tier:            ${tool.blastTier}  ${tierOk ? '✓ (always self-send, no approval)' : '✗ expected AUTO_WRITE w/o resolver'}`);

  // ── 2. Empty body → friendly error, no driver call ───────────────────
  const empty = await tool.handler(
    { subject: 'Empty', text: '', html: '' },
    ctx,
  );
  const emptyOk =
    empty && 'error' in (empty as any) && (empty as any).error === 'missing_body' && driver.lastInput === null;
  console.log(`empty body guard: ${emptyOk ? '✓ rejected before send' : '✗ ' + JSON.stringify(empty)}`);

  // ── 2b. Missing recipient (ctx.email null) → error, no driver call ───
  driver.lastInput = null;
  const noEmail = await tool.handler(
    { subject: 'Hi', text: 'Body' },
    { ...ctx, email: null },
  );
  const noEmailOk =
    noEmail && 'error' in (noEmail as any) && (noEmail as any).error === 'missing_recipient' && driver.lastInput === null;
  console.log(`no-recipient guard: ${noEmailOk ? '✓ rejected before send' : '✗ ' + JSON.stringify(noEmail)}`);

  // ── 3. With CSV attachment, recipient implicit ──────────────────────
  driver.lastInput = null;
  const result = await tool.handler(
    {
      subject: 'Daily invoice digest',
      text: `Hi ${owner.email?.split('@')[0]}, here are 5 recent invoices.`,
      attachInvoiceIds: ids,
    },
    ctx,
  );

  if (!result || 'error' in (result as any)) {
    console.error('✗ send failed:', JSON.stringify(result));
    process.exit(1);
  }

  const sent = driver.lastInput!;
  console.log('\n--- captured email ---');
  console.log(`  to:          ${sent.to}  (server-resolved from ctx.email, not LLM-supplied)`);
  console.log(`  subject:     ${sent.subject}`);
  console.log(`  text:        ${sent.text?.slice(0, 80)}…`);
  console.log(`  attachments: ${sent.attachments?.length ?? 0}`);

  const att = sent.attachments?.[0];
  if (!att) {
    console.error('✗ no attachment in captured email');
    process.exit(1);
  }

  const csv = Buffer.from(typeof att.content === 'string' ? att.content : '', 'base64').toString('utf8');
  const lines = csv.trim().split('\n');
  console.log(`  attachment.filename:    ${att.filename}`);
  console.log(`  attachment.contentType: ${att.contentType}`);
  console.log(`  decoded CSV (${lines.length} lines):`);
  for (const line of lines) console.log(`     ${line}`);

  // ── 4. Cross-check CSV body against DB ───────────────────────────────
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  const expectedHeader = '"Invoice #","Status","Customer","Total (TND)","Paid (TND)","Outstanding (TND)","Due Date","Created"';
  checks.push({ name: 'CSV header matches contract', ok: lines[0] === expectedHeader, detail: lines[0] });
  checks.push({ name: 'row count matches invoice ids', ok: lines.length - 1 === sampleInvoices.length, detail: `${lines.length - 1} body rows / ${sampleInvoices.length} ids` });
  checks.push({ name: 'every invoiceNumber appears in CSV', ok: sampleInvoices.every(i => csv.includes(`"${i.invoiceNumber}"`)), detail: '' });
  checks.push({ name: 'attachInvoiceCount echo matches', ok: (result as any).attachedInvoiceCount === sampleInvoices.length, detail: `tool returned ${(result as any).attachedInvoiceCount}` });

  // Pick one invoice and verify its row in the CSV is correct
  const sample = sampleInvoices[0];
  const paid = sample.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, sample.total - paid);
  const expectedCells = [
    sample.invoiceNumber,
    sample.status,
    `${sample.customer.firstName} ${sample.customer.lastName}`.trim(),
    sample.total.toFixed(2),
    paid.toFixed(2),
    outstanding.toFixed(2),
  ];
  const sampleLine = lines.find(l => l.includes(`"${sample.invoiceNumber}"`));
  const allCellsPresent = expectedCells.every(cell => sampleLine?.includes(`"${cell}"`));
  checks.push({ name: 'numeric cells match DB for sample invoice', ok: allCellsPresent, detail: `${sample.invoiceNumber}: total=${sample.total} paid=${paid} outstanding=${outstanding}` });

  // ── 5. Foreign-garage invoice ids are silently filtered ──────────────
  driver.lastInput = null;
  const cross = await tool.handler(
    {
      subject: 'Cross-garage probe',
      text: 'should drop fake ids',
      attachInvoiceIds: ['00000000-0000-0000-0000-000000000000', sampleInvoices[0].id],
    },
    ctx,
  );
  const crossSent = driver.lastInput;
  const crossCsv = crossSent?.attachments?.[0]?.content
    ? Buffer.from(crossSent.attachments[0].content as string, 'base64').toString('utf8')
    : '';
  const crossLines = crossCsv.trim().split('\n');
  checks.push({
    name: 'foreign/missing ids dropped, real id retained',
    ok: crossLines.length - 1 === 1 && crossCsv.includes(sampleInvoices[0].invoiceNumber),
    detail: `${crossLines.length - 1} rows · echo=${(cross as any).attachedInvoiceCount}`,
  });

  // ── Report ───────────────────────────────────────────────────────────
  console.log('\n--- assertions ---');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }
  const failed = checks.filter(c => !c.ok).length;
  console.log(`\n${checks.length - failed} pass · ${failed} fail`);
  await prismaClient.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
})();
