import { AssistantBlastTier, ApprovalStatus } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { InvoiceTokenService } from '../../../public/invoice-token.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface SendJobCustomerApprovalEmailArgs {
  jobId: string;
  requestedAmount?: number;
  summary?: string;
  note?: string;
  subject?: string;
  message?: string;
}

export interface SendJobCustomerApprovalEmailResult {
  providerMessageId: string;
  status: string;
  to: string;
  approvalRequestId: string;
  publicUrl: string;
  subject: string;
  requestedAmount?: number | null;
}

function toNum(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

function estimateTotal(job: any): number {
  const lines = Array.isArray(job?.parts) ? job.parts : [];
  return lines.reduce((sum: number, line: any) => {
    const quantity = toNum(line?.quantity) || 1;
    const unitPrice = toNum(line?.unitPrice);
    const tvaRate = toNum(line?.tvaRate);
    const discountPct = toNum(line?.discountPct);
    const base = quantity * unitPrice;
    const discounted = base * (1 - discountPct / 100);
    return sum + discounted * (1 + tvaRate / 100);
  }, 0);
}

function formatTnd(value: number): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TND`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function customerName(job: any): string {
  const customer = job?.car?.customer;
  return `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim();
}

function carLabel(job: any): string {
  const car = job?.car;
  return [
    car?.make,
    car?.model,
    car?.licensePlate ? `(${car.licensePlate})` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function lineItems(
  job: any,
): { description: string; quantity: number; unitPrice: number }[] {
  const lines = Array.isArray(job?.parts) ? job.parts : [];
  return lines.map((line: any) => ({
    description: String(line?.description ?? line?.part?.name ?? 'Work item'),
    quantity: toNum(line?.quantity) || 1,
    unitPrice: toNum(line?.unitPrice),
  }));
}

function approvalSummary(job: any, amount: number, provided?: string): string {
  if (provided?.trim()) return provided.trim();
  const items = lineItems(job)
    .slice(0, 5)
    .map((line) => `${line.description} x ${line.quantity}`)
    .join(', ');
  const prefix = items
    ? `Please review and approve the requested job items: ${items}.`
    : 'Please review and approve the requested maintenance job work.';
  return `${prefix} Estimated total: ${formatTnd(amount)}.`;
}

function buildHtmlEmail(opts: {
  name: string;
  car: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  amount: number;
  publicUrl: string;
  message?: string;
}): string {
  const safeName = escapeHtml(opts.name || 'there');
  const safeCar = escapeHtml(opts.car || 'your vehicle');
  const safeUrl = escapeHtml(opts.publicUrl);
  const safeMessage = opts.message?.trim()
    ? escapeHtml(opts.message.trim())
    : '';
  const rows = opts.lines.length
    ? opts.lines
        .map(
          (line) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(line.description)}</td>` +
            `<td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${line.quantity}</td>` +
            `<td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatTnd(line.unitPrice))}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3" style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Maintenance job review</td></tr>`;

  return [
    '<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;max-width:640px;">',
    `<p>Hello ${safeName},</p>`,
    `<p>We inspected ${safeCar}. Please review the requested work below and approve or reject it using the secure link.</p>`,
    safeMessage ? `<p>${safeMessage}</p>` : '',
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;">',
    '<thead><tr>',
    '<th style="padding:8px 0;border-bottom:2px solid #111827;text-align:left;">Item</th>',
    '<th style="padding:8px 0;border-bottom:2px solid #111827;text-align:center;">Qty</th>',
    '<th style="padding:8px 0;border-bottom:2px solid #111827;text-align:right;">HT price</th>',
    '</tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    `<p><strong>Estimated total:</strong> ${escapeHtml(formatTnd(opts.amount))}</p>`,
    `<p><a href="${safeUrl}" style="display:inline-block;background:#f28c28;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold;">Review and approve</a></p>`,
    `<p style="font-size:13px;color:#6b7280;">If the button does not work, copy this link:<br><a href="${safeUrl}">${safeUrl}</a></p>`,
    '<p>Thank you.</p>',
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTextEmail(opts: {
  name: string;
  car: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  amount: number;
  publicUrl: string;
  message?: string;
}): string {
  const items = opts.lines.length
    ? opts.lines
        .map(
          (line) =>
            `- ${line.description} x ${line.quantity}: ${formatTnd(line.unitPrice)} HT`,
        )
        .join('\n')
    : '- Maintenance job review';
  const message = opts.message?.trim() ? `\n\n${opts.message.trim()}` : '';
  return [
    `Hello ${opts.name || 'there'},`,
    '',
    `We inspected ${opts.car || 'your vehicle'}. Please review the requested work below.${message}`,
    '',
    items,
    '',
    `Estimated total: ${formatTnd(opts.amount)}`,
    '',
    `Review and approve here: ${opts.publicUrl}`,
    '',
    'Thank you.',
  ].join('\n');
}

function buildPublicUrl(baseUrl: string, token: string): string {
  const base = (baseUrl || 'http://localhost:4200').replace(/\/+$/, '');
  return `${base}/public/job-approvals/${token}`;
}

function findReusableApproval(job: any, email: string): any | null {
  const requests = Array.isArray(job?.approvalRequests)
    ? job.approvalRequests
    : [];
  return (
    requests.find((request: any) => {
      if (request?.status !== ApprovalStatus.PENDING) return false;
      const requestEmail =
        typeof request?.customerEmail === 'string'
          ? request.customerEmail.trim().toLowerCase()
          : '';
      return !requestEmail || requestEmail === email.toLowerCase();
    }) ?? null
  );
}

export function buildSendJobCustomerApprovalEmailTool(
  maintenanceService: MaintenanceService,
  emailService: EmailService,
  tokens: InvoiceTokenService,
  publicBaseUrl: string,
): ToolDefinition<
  SendJobCustomerApprovalEmailArgs,
  SendJobCustomerApprovalEmailResult
> {
  return {
    name: 'send_job_customer_approval_email',
    description:
      'Send a customer-facing maintenance job approval email to the customer stored on the job. ' +
      'Use this for "email/send the customer approval link for this job", "send that customer the parts approval", ' +
      'or "email the customer about this maintenance job". This tool resolves the recipient from the job, ' +
      'creates or reuses a public approval request, includes the approval URL in the email, and sends to the customer. ' +
      'Do not use send_email for customer job approval emails because send_email only sends to the authenticated owner.',
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    requiredRole: 'OWNER',
    requiredModule: 'maintenance',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId'],
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          description:
            'Maintenance job id whose customer should receive the approval email.',
        },
        requestedAmount: {
          type: 'number',
          minimum: 0,
          description:
            'Optional total amount in TND. If omitted, the tool calculates the total from job lines including TVA.',
        },
        summary: {
          type: 'string',
          description:
            'Optional short approval summary. If omitted, the tool summarizes the job lines.',
        },
        note: {
          type: 'string',
          description:
            'Optional internal note saved on a newly created approval request.',
        },
        subject: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description:
            'Optional email subject. If omitted, the tool uses a maintenance approval subject with the car label.',
        },
        message: {
          type: 'string',
          description:
            'Optional extra customer-facing paragraph to include before the approval table.',
        },
      },
    },
    handler: async (
      args: SendJobCustomerApprovalEmailArgs,
      ctx: AssistantUserContext,
    ): Promise<SendJobCustomerApprovalEmailResult> => {
      const job = await maintenanceService.findOne(args.jobId, ctx.garageId);
      const customer = job?.car?.customer;
      const to =
        typeof customer?.email === 'string' ? customer.email.trim() : '';
      if (!to || !isValidEmail(to)) {
        throw new Error('Job customer has no valid email address on file.');
      }

      const name = customerName(job);
      const car = carLabel(job);
      const amount = args.requestedAmount ?? estimateTotal(job);
      const summary = approvalSummary(job, amount, args.summary);
      const reusable = findReusableApproval(job, to);
      const approval =
        reusable ??
        (await maintenanceService.createApprovalRequest(
          args.jobId,
          ctx.garageId,
          ctx.userId,
          {
            requestedAmount: amount,
            summary,
            customerName: name || undefined,
            customerEmail: to,
            customerPhone: customer?.phone ?? undefined,
            sendVia: 'email',
            note: args.note,
          },
        ));
      const token = tokens.sign(approval.id, 'jobApproval');
      const publicUrl = buildPublicUrl(publicBaseUrl, token);
      const subject =
        args.subject?.trim() ||
        `Maintenance approval request${car ? ` for ${car}` : ''}`;
      const lines = lineItems(job);
      const html = buildHtmlEmail({
        name,
        car,
        lines,
        amount,
        publicUrl,
        message: args.message,
      });
      const text = buildTextEmail({
        name,
        car,
        lines,
        amount,
        publicUrl,
        message: args.message,
      });

      const result = await emailService.send({
        to,
        subject,
        html,
        text,
        replyTo: ctx.email ?? undefined,
      });

      return {
        providerMessageId: result.providerMessageId,
        status: result.status,
        to,
        approvalRequestId: approval.id,
        publicUrl,
        subject,
        requestedAmount: amount,
      };
    },
  };
}
