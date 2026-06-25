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
  providerMessageId?: string;
  status: string;
  to: string;
  approvalRequestId: string;
  publicUrl: string;
  subject: string;
  requestedAmount?: number | null;
  error?: 'send_failed';
  message?: string;
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v && typeof (v as any).toNumber === 'function') {
    return (v as any).toNumber();
  }
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ApprovalLine = {
  description: string;
  quantity: number | null;
  unitPrice: number;
  total: number;
};

function lineTotalHt(line: any): number {
  const quantity = toNum(line?.quantity) || 1;
  const unitPrice = toNum(line?.unitPrice);
  const discountPct = toNum(line?.discountPct);
  return quantity * unitPrice * (1 - discountPct / 100);
}

function approvalLines(job: any): ApprovalLine[] {
  const lines: ApprovalLine[] = [];
  const jobEstimate = toNum(job?.actualCost) || toNum(job?.estimatedCost);
  if (jobEstimate > 0) {
    lines.push({
      description: 'Base maintenance estimate',
      quantity: null,
      unitPrice: jobEstimate,
      total: jobEstimate,
    });
  }

  const jobLines = Array.isArray(job?.parts) ? job.parts : [];
  for (const line of jobLines) {
    const quantity = toNum(line?.quantity) || 1;
    const unitPrice = toNum(line?.unitPrice);
    lines.push({
      description: String(line?.description ?? line?.part?.name ?? 'Work item'),
      quantity,
      unitPrice,
      total: lineTotalHt(line),
    });
  }

  return lines;
}

function estimateTotal(job: any): number {
  return approvalLines(job).reduce((sum, line) => sum + line.total, 0);
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

function approvalSummary(job: any, amount: number): string {
  const items = approvalLines(job);
  if (!items.length) {
    return `Please review and approve the requested maintenance job work.\nEstimated total: ${formatTnd(amount)}.`;
  }

  const lines = items
    .map((line) => {
      const quantity = line.quantity === null ? '' : ` x ${line.quantity}`;
      return `- ${line.description}${quantity}: ${formatTnd(line.total)}`;
    })
    .join('\n');
  return `Please review and approve the requested job items:\n${lines}\nEstimated total: ${formatTnd(amount)}.`;
}

function buildHtmlEmail(opts: {
  name: string;
  car: string;
  lines: ApprovalLine[];
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
            `<td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${line.quantity ?? '-'}</td>` +
            `<td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatTnd(line.total))}</td></tr>`,
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
    '<th style="padding:8px 0;border-bottom:2px solid #111827;text-align:right;">HT total</th>',
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
  lines: ApprovalLine[];
  amount: number;
  publicUrl: string;
  message?: string;
}): string {
  const items = opts.lines.length
    ? opts.lines
        .map(
          (line) => {
            const quantity = line.quantity === null ? '' : ` x ${line.quantity}`;
            return `- ${line.description}${quantity}: ${formatTnd(line.total)} HT`;
          },
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

function matchesAmount(actual: unknown, expected: number): boolean {
  return Math.abs(toNum(actual) - expected) < 0.005;
}

function findReusableApproval(
  job: any,
  email: string,
  amount: number,
  summary: string,
): any | null {
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
      const requestSummary =
        typeof request?.summary === 'string' ? request.summary.trim() : '';
      return (
        requestEmail === email.toLowerCase() &&
        matchesAmount(request?.requestedAmount, amount) &&
        requestSummary === summary
      );
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
            'Legacy hint only. The tool calculates the customer-facing amount from the current job estimate plus HT job lines.',
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
      const amount = estimateTotal(job);
      const summary = approvalSummary(job, amount);
      const reusable = findReusableApproval(job, to, amount, summary);
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
      const lines = approvalLines(job);
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

      try {
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
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: 'send_failed',
          message,
          status: 'failed',
          to,
          approvalRequestId: approval.id,
          publicUrl,
          subject,
          requestedAmount: amount,
        };
      }
    },
  };
}
