import { ToolPresenter } from './assistant-tool-presenter.service';
import { SmsPreviewComponent } from '../components/assistant-action-preview/sms-preview.component';
import { EmailPreviewComponent } from '../components/assistant-action-preview/email-preview.component';
import { CreateAppointmentPreviewComponent } from '../components/assistant-action-preview/create-appointment-preview.component';
import { CancelAppointmentPreviewComponent } from '../components/assistant-action-preview/cancel-appointment-preview.component';
import { RecordPaymentPreviewComponent } from '../components/assistant-action-preview/record-payment-preview.component';

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const str = (v: unknown, key: string): string | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const x = o[key];
  return typeof x === 'string' ? x : undefined;
};

const num = (v: unknown, key: string): number | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const x = o[key];
  return typeof x === 'number' ? x : undefined;
};

const arr = (v: unknown, key: string): unknown[] | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const x = o[key];
  return Array.isArray(x) ? x : undefined;
};

const arrLen = (v: unknown, key: string): number => arr(v, key)?.length ?? 0;

const formatDateTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

const k = (toolName: string, suffix: string): string =>
  `assistant.tools.${toolName}.${suffix}`;

const present = <TArgs = unknown, TResult = unknown>(
  toolName: string,
  extras: Partial<ToolPresenter<TArgs, TResult>> = {},
): ToolPresenter<TArgs, TResult> => ({
  toolName,
  runningKey: k(toolName, 'running'),
  successKey: k(toolName, 'success'),
  failureKey: k(toolName, 'failure'),
  ...extras,
});

export const TOOL_PRESENTERS: ToolPresenter[] = [
  // ── Appointments ────────────────────────────────────────────────────────
  present('list_appointments', {
    successParams: (_a, r) => ({ count: arrLen(r, 'appointments') }),
  }),
  present('find_available_slot', {
    successParams: (_a, r) => ({ when: formatDateTime(str(r, 'startTime')) }),
  }),
  present('create_appointment', {
    runningParams: (a) => ({ when: formatDateTime(str(a, 'scheduledAt')) }),
    successParams: (a) => ({ when: formatDateTime(str(a, 'scheduledAt')) }),
    previewComponent: CreateAppointmentPreviewComponent,
    previewInputs: (a) => ({
      scheduledAt: str(a, 'scheduledAt'),
      durationMinutes: num(a, 'durationMinutes'),
      type: str(a, 'type'),
      title: str(a, 'title'),
      notes: str(a, 'notes'),
    }),
    approveVerbKey: k('create_appointment', 'approveVerb'),
  }),
  present('cancel_appointment', {
    previewComponent: CancelAppointmentPreviewComponent,
    previewInputs: (a) => ({
      appointmentId: str(a, 'appointmentId'),
      reason: str(a, 'reason'),
    }),
    approveVerbKey: k('cancel_appointment', 'approveVerb'),
  }),

  // ── Customers / Cars ────────────────────────────────────────────────────
  present('find_customer', {
    runningParams: (a) => ({ q: str(a, 'query') ?? str(a, 'q') ?? '' }),
    successParams: (_a, r) => ({ count: arrLen(r, 'customers') }),
  }),
  present('get_customer', {
    successParams: (_a, r) => ({ name: str(r, 'firstName') ?? str(r, 'name') ?? '' }),
  }),
  present('find_car', {
    successParams: (_a, r) => ({ count: arrLen(r, 'cars') }),
  }),
  present('get_car', {
    successParams: (_a, r) => ({
      make: str(r, 'make') ?? '',
      model: str(r, 'model') ?? '',
    }),
  }),
  present('list_top_customers', {
    successParams: (_a, r) => ({ count: arrLen(r, 'customers') }),
  }),
  present('list_at_risk_customers', {
    successParams: (_a, r) => ({ count: arrLen(r, 'customers') }),
  }),
  present('list_returning_customers', {
    successParams: (_a, r) => ({ count: arrLen(r, 'customers') }),
  }),
  present('list_maintenance_due', {
    successParams: (_a, r) => ({ count: arrLen(r, 'cars') }),
  }),

  // ── Invoicing / Inventory ───────────────────────────────────────────────
  present('list_invoices', {
    successParams: (_a, r) => ({ count: arrLen(r, 'invoices') }),
  }),
  present('get_invoice', {
    successParams: (_a, r) => ({ number: str(r, 'invoiceNumber') ?? '' }),
  }),
  present('list_overdue_invoices', {
    successParams: (_a, r) => ({ count: arrLen(r, 'invoices') }),
  }),
  present('list_low_stock_parts', {
    successParams: (_a, r) => ({ count: arrLen(r, 'parts') }),
  }),
  present('get_inventory_value', {
    successParams: (_a, r) => ({ value: num(r, 'totalValue') ?? 0 }),
  }),
  present('record_payment', {
    runningParams: (a) => ({ amount: num(a, 'amount') ?? 0 }),
    successParams: (a) => ({ amount: num(a, 'amount') ?? 0 }),
    previewComponent: RecordPaymentPreviewComponent,
    previewInputs: (a) => ({
      amount: num(a, 'amount'),
      method: str(a, 'method'),
      reference: str(a, 'reference'),
      notes: str(a, 'notes'),
      invoiceNumber: str(a, '_expectedConfirmation'),
    }),
    approveVerbKey: k('record_payment', 'approveVerb'),
  }),

  // ── Communications ──────────────────────────────────────────────────────
  present('send_sms', {
    runningParams: (a) => ({ to: str(a, 'to') ?? '' }),
    successParams: (a) => ({ to: str(a, 'to') ?? '' }),
    previewComponent: SmsPreviewComponent,
    previewInputs: (a) => ({
      to: str(a, 'to'),
      body: str(a, 'body'),
    }),
    approveVerbKey: k('send_sms', 'approveVerb'),
  }),
  present('send_email', {
    runningParams: (a) => ({ subject: str(a, 'subject') ?? '' }),
    successParams: (a) => ({ subject: str(a, 'subject') ?? '' }),
    previewComponent: EmailPreviewComponent,
    previewInputs: (a) => ({
      subject: str(a, 'subject'),
      text: str(a, 'text'),
      html: str(a, 'html'),
      attachInvoiceCount: arrLen(a, 'attachInvoiceIds'),
      attachInvoiceFormat: str(a, 'attachInvoiceFormat') as 'csv' | 'pdf' | undefined,
    }),
    approveVerbKey: k('send_email', 'approveVerb'),
  }),
  present('propose_retention_action'),

  // ── Analytics ───────────────────────────────────────────────────────────
  present('list_active_jobs', {
    successParams: (_a, r) => ({ count: arrLen(r, 'jobs') }),
  }),
  present('get_dashboard_kpis'),
  present('get_invoices_summary', {
    successParams: (_a, r) => ({ total: num(r, 'totalAmount') ?? 0 }),
  }),
  present('get_customer_count', {
    successParams: (_a, r) => ({ count: num(r, 'count') ?? 0 }),
  }),
  present('get_revenue_summary', {
    successParams: (_a, r) => ({ total: num(r, 'totalRevenue') ?? 0 }),
  }),
  present('get_revenue_breakdown_by_service'),

  // ── Reports ─────────────────────────────────────────────────────────────
  present('generate_invoices_pdf', {
    successParams: (_a, r) => ({ count: num(r, 'invoiceCount') ?? 0 }),
  }),
  present('generate_period_report'),
];
