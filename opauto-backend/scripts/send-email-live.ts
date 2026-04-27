/**
 * Live send via Resend to prove the send_email tool delivers an email
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
 *     in Resend's sandbox.
 */

import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AssistantUserContext } from '../src/assistant/types';
import { EmailService } from '../src/email/email.service';
import { ResendEmailDriver } from '../src/email/providers/resend-email.driver';
import { createSendEmailTool } from '../src/assistant/tools/communications/send-email.tool';

const overrideEmail = process.argv[2];
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

  console.log(`from:        onboarding@resend.dev  (Resend sandbox)`);
  console.log(`to:          ${ctx.email}  (server-resolved from session)`);
  console.log(`attachments: invoices.csv (${sample.length} rows)`);
  console.log(`first row:   ${sample[0].invoiceNumber} · ${sample[0].customer.firstName} ${sample[0].customer.lastName} · ${sample[0].total} TND\n`);

  const driver = new ResendEmailDriver(new ConfigService());
  const tool = createSendEmailTool({ emailService: new EmailService(driver), prisma });

  const subject = `OpAuto demo · 5 recent invoices · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const text =
    `Hi,\n\nAttached is a CSV of the 5 most recent invoices from the OpAuto demo.\n\n` +
    sample
      .map((i, idx) => `${idx + 1}. ${i.invoiceNumber} — ${i.customer.firstName} ${i.customer.lastName} — ${i.status} — ${i.total.toFixed(2)} TND`)
      .join('\n') +
    `\n\n— sent by send_email tool, recipient resolved from ctx.email server-side.`;

  // Note: no `to` arg — the tool reads ctx.email itself.
  const result = await tool.handler({ subject, text, attachInvoiceIds: ids }, ctx);

  console.log('---');
  console.log(JSON.stringify(result, null, 2));
  await prismaClient.$disconnect();
  if (result && 'error' in (result as any)) process.exit(1);
})();
