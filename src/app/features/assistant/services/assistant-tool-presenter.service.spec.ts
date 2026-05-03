import { TestBed } from '@angular/core/testing';
import { AssistantToolPresenterService } from './assistant-tool-presenter.service';
import {
  AssistantPendingApproval,
  AssistantToolCallStatus,
  AssistantUiMessage,
} from '../../../core/models/assistant.model';
import { SmsPreviewComponent } from '../components/assistant-action-preview/sms-preview.component';
import { CreateAppointmentPreviewComponent } from '../components/assistant-action-preview/create-appointment-preview.component';
import { RecordPaymentPreviewComponent } from '../components/assistant-action-preview/record-payment-preview.component';

describe('AssistantToolPresenterService', () => {
  let svc: AssistantToolPresenterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AssistantToolPresenterService);
  });

  const toolMsg = (
    toolName: string,
    status: AssistantToolCallStatus,
    args?: unknown,
    result?: unknown,
  ): AssistantUiMessage => ({
    id: 'm-1',
    conversationId: 'c-1',
    role: 'TOOL',
    content: '',
    createdAt: new Date().toISOString(),
    toolCall: {
      id: 'tc-1',
      toolName,
      args,
      result,
      status,
      blastTier: 'READ',
      durationMs: 10,
    },
  });

  // ─── format() ───────────────────────────────────────────────────────────

  it('returns null for messages with no toolCall', () => {
    const msg = { ...toolMsg('list_invoices', 'EXECUTED'), toolCall: undefined };
    expect(svc.format(msg)).toBeNull();
  });

  it('returns null for orphan tool_result with empty toolName', () => {
    const msg = toolMsg('', 'FAILED');
    expect(svc.format(msg)).toBeNull();
  });

  it('formats a known read-tool success with count from result array', () => {
    const msg = toolMsg('list_invoices', 'EXECUTED', { limit: 10 }, { invoices: [1, 2, 3, 4, 5] });
    const p = svc.format(msg)!;
    expect(p.state).toBe('success');
    expect(p.statusKey).toBe('assistant.tools.list_invoices.success');
    expect(p.statusParams['count']).toBe(5);
    expect(p.toolName).toBe('list_invoices');
  });

  it('formats failure state from FAILED status', () => {
    const msg = toolMsg('list_invoices', 'FAILED', undefined, undefined);
    const p = svc.format(msg)!;
    expect(p.state).toBe('failure');
    expect(p.statusKey).toBe('assistant.tools.list_invoices.failure');
  });

  it('treats DENIED and EXPIRED as failure', () => {
    expect(svc.format(toolMsg('send_sms', 'DENIED'))!.state).toBe('failure');
    expect(svc.format(toolMsg('send_sms', 'EXPIRED'))!.state).toBe('failure');
  });

  it('treats APPROVED (in-flight, not yet executed) as running', () => {
    const p = svc.format(toolMsg('send_sms', 'APPROVED'))!;
    expect(p.state).toBe('running');
    expect(p.statusKey).toBe('assistant.tools.send_sms.running');
  });

  it('falls back to generic copy for unknown tool names', () => {
    const p = svc.format(toolMsg('totally_made_up_tool', 'EXECUTED', {}, {}))!;
    expect(p.statusKey).toBe('assistant.tools._fallback.success');
    expect(p.toolName).toBe('totally_made_up_tool');
  });

  it('extracts make/model for get_car success', () => {
    const p = svc.format(
      toolMsg('get_car', 'EXECUTED', {}, { make: 'Kia', model: 'Cerato' }),
    )!;
    expect(p.statusParams['make']).toBe('Kia');
    expect(p.statusParams['model']).toBe('Cerato');
  });

  it('does not throw when result is malformed', () => {
    const p = svc.format(toolMsg('list_invoices', 'EXECUTED', {}, 'not-an-object'))!;
    expect(p.state).toBe('success');
    expect(p.statusParams['count']).toBe(0);
  });

  // ─── approvalSummary() ──────────────────────────────────────────────────

  const pending = (toolName: string, args: unknown): AssistantPendingApproval => ({
    toolCallId: 'tc-1',
    toolName,
    args,
    blastTier: 'CONFIRM_WRITE',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    receivedAt: Date.now(),
  });

  it('returns the SMS preview component for send_sms', () => {
    const s = svc.approvalSummary(pending('send_sms', { to: '+216123', body: 'hi' }));
    expect(s.previewComponent).toBe(SmsPreviewComponent);
    expect(s.previewInputs?.['to']).toBe('+216123');
    expect(s.previewInputs?.['body']).toBe('hi');
    expect(s.approveVerbKey).toBe('assistant.tools.send_sms.approveVerb');
  });

  it('returns the create-appointment preview for create_appointment', () => {
    const s = svc.approvalSummary(
      pending('create_appointment', {
        scheduledAt: '2026-05-10T09:00:00Z',
        durationMinutes: 60,
        type: 'oil-change',
      }),
    );
    expect(s.previewComponent).toBe(CreateAppointmentPreviewComponent);
    expect(s.previewInputs?.['durationMinutes']).toBe(60);
    expect(s.previewInputs?.['type']).toBe('oil-change');
  });

  it('returns the record-payment preview and uses _expectedConfirmation as invoiceNumber', () => {
    const s = svc.approvalSummary(
      pending('record_payment', {
        amount: 250,
        method: 'CASH',
        _expectedConfirmation: 'INV-202604-0001',
      }),
    );
    expect(s.previewComponent).toBe(RecordPaymentPreviewComponent);
    expect(s.previewInputs?.['amount']).toBe(250);
    expect(s.previewInputs?.['invoiceNumber']).toBe('INV-202604-0001');
  });

  it('returns default approve verb when tool is unknown', () => {
    const s = svc.approvalSummary(pending('unknown_tool', { foo: 1 }));
    expect(s.previewComponent).toBeUndefined();
    expect(s.approveVerbKey).toBe('assistant.approval.approveDefault');
  });

  // ─── registry coverage ─────────────────────────────────────────────────

  it('has presenters for every backend-registered tool name', () => {
    const expectedTools = [
      'list_appointments', 'find_available_slot', 'create_appointment', 'cancel_appointment',
      'find_customer', 'get_customer', 'find_car', 'get_car',
      'list_top_customers', 'list_at_risk_customers', 'list_returning_customers', 'list_maintenance_due',
      'list_invoices', 'get_invoice', 'list_overdue_invoices', 'list_low_stock_parts',
      'get_inventory_value', 'record_payment',
      'send_sms', 'send_email', 'propose_retention_action',
      'list_active_jobs', 'get_dashboard_kpis', 'get_invoices_summary',
      'get_customer_count', 'get_revenue_summary',
      'generate_invoices_pdf', 'generate_period_report',
    ];
    for (const t of expectedTools) {
      expect(svc.hasPresenter(t)).withContext(t).toBe(true);
    }
  });
});
