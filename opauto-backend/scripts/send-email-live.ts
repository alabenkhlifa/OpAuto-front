/**
 * Live send via the configured email provider to prove the send_email tool delivers an email
 * with the CSV invoice attachment.
 *
 * The recipient is *not* passed in — the tool always sends to the
 * authenticated user (ctx.email). This script overrides ctx.email at
 * the top so you can pick which mailbox to test against.
 *
 *   npx ts-node scripts/send-email-live.ts [override-email]
 *
 *   - With no arg, uses owner@autotech.tn (the seeded owner).
 *   - With an arg, runs the tool *as if* that address were the
 *     authenticated user — useful for testing against your real inbox
 *     in provider sandboxes with recipient restrictions.
 */

import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AssistantUserContext } from '../src/assistant/types';
import { EmailService } from '../src/email/email.service';
import { createEmailProvider } from '../src/email/email.module';
import { MockEmailDriver } from '../src/email/providers/mock-email.driver';
import { createSendEmailTool } from '../src/assistant/tools/communications/send-email.tool';

const overrideEmail = process.argv[2];
const format = (process.argv[3] === 'pdf' ? 'pdf' : 'csv') as 'csv' | 'pdf';
const prismaClient = new PrismaClient();
const prisma = prismaClient as unknown as PrismaService;

(async () => {
  const owner = await prismaClient.user.findFirstOrThrow({
    where: { email: 'owner@autotech.tn' },
    select: { id: true, garageId: true, email: true, role: true },
  });
  const ctx: AssistantUserContext = {
    userId: owner.id,
    garageId: owner.garageId,
    // The tool reads ctx.email and sends there. Override here lets us
    // smoke-test a real inbox without re-seeding the owner row.
    email: overrideEmail || owner.email,
    role: owner.role as 'OWNER',
    enabledModules: ['ai', 'invoicing'],
    locale: 'en',
  };

  const sample = await prismaClient.invoice.findMany({
    where: { garageId: ctx.garageId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, payments: true },
  });
  const ids = sample.map((i) => i.id);

  const config = new ConfigService();
  const provider = buildEmailProvider(config);

  console.log(`provider:    ${providerLabel()}`);
  console.log(
    `from:        ${process.env.MAILTRAP_FROM || process.env.RESEND_FROM || '(configured provider default)'}`,
  );
  console.log(`to:          ${ctx.email}  (server-resolved from session)`);
  console.log(`format:      ${format}`);
  console.log(
    `attachments: invoices.${format} (${sample.length} ${format === 'pdf' ? 'pages' : 'rows'})`,
  );
  console.log(
    `first item:  ${sample[0].invoiceNumber} · ${sample[0].customer.firstName} ${sample[0].customer.lastName} · ${sample[0].total} TND\n`,
  );

  const tool = createSendEmailTool({
    emailService: new EmailService(provider),
    prisma,
  });

  const subject = `OpAuto demo · 5 recent invoices (${format}) · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const text =
    `Hi,\n\nAttached is a ${format.toUpperCase()} of the 5 most recent invoices from the OpAuto demo.\n\n` +
    sample
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.invoiceNumber} — ${i.customer.firstName} ${i.customer.lastName} — ${i.status} — ${i.total.toFixed(2)} TND`,
      )
      .join('\n') +
    `\n\n— sent by send_email tool, recipient resolved from ctx.email server-side.`;

  // Note: no `to` arg — the tool reads ctx.email itself.
  const result = await tool.handler(
    { subject, text, attachInvoiceIds: ids, attachInvoiceFormat: format },
    ctx,
  );

  console.log('---');
  console.log(JSON.stringify(result, null, 2));
  await prismaClient.$disconnect();
  if (result && 'error' in (result as any)) process.exit(1);
})();

function buildEmailProvider(config: ConfigService) {
  const provider = createEmailProvider(config);
  if (provider instanceof MockEmailDriver) {
    throw new Error(
      'No real email provider configured. Set MAILTRAP_* or RESEND_*, or do not use send-email-live.ts.',
    );
  }
  return provider;
}

function providerLabel(): string {
  const driver = (process.env.EMAIL_PROVIDER || 'mailtrap').toLowerCase();
  const mailtrapSandbox = ['1', 'true', 'yes', 'on'].includes(
    (process.env.MAILTRAP_USE_SANDBOX || '').trim().toLowerCase(),
  );
  const mailtrapReady =
    !!process.env.MAILTRAP_API_KEY &&
    !!process.env.MAILTRAP_FROM &&
    (!mailtrapSandbox || !!process.env.MAILTRAP_INBOX_ID);
  const resendReady = !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;
  if (driver === 'mailtrap' && mailtrapReady && resendReady) {
    return mailtrapSandbox
      ? 'mailtrap sandbox -> resend'
      : 'mailtrap -> resend';
  }
  if (driver === 'mailtrap' && !mailtrapReady && resendReady) {
    return 'resend (Mailtrap not configured)';
  }
  return mailtrapSandbox ? 'mailtrap sandbox' : driver;
}
