import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AssistantMessageComponent } from './assistant-message.component';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  AssistantUiMessage,
  AssistantToolCallView,
  AssistantPendingApproval,
} from '../../../../core/models/assistant.model';

describe('AssistantMessageComponent', () => {
  let fixture: ComponentFixture<AssistantMessageComponent>;
  let component: AssistantMessageComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const baseMessage = (overrides: Partial<AssistantUiMessage> = {}): AssistantUiMessage => ({
    id: 'm1',
    conversationId: 'c1',
    role: 'USER',
    content: 'Hello',
    createdAt: new Date('2026-04-26T10:30:00Z').toISOString(),
    ...overrides,
  });

  beforeEach(async () => {
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: { subscribe: () => ({ unsubscribe: () => {} }) },
    });
    translationService.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [AssistantMessageComponent],
      providers: [{ provide: TranslationService, useValue: translationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantMessageComponent);
    component = fixture.componentInstance;
  });

  function setMessage(msg: AssistantUiMessage) {
    fixture.componentRef.setInput('message', msg);
    fixture.detectChanges();
  }

  it('renders a USER bubble with user-tinted styling', () => {
    setMessage(baseMessage({ role: 'USER', content: 'hi there' }));

    const bubble = fixture.debugElement.query(By.css('.assistant-message__bubble'));
    expect(bubble.nativeElement.classList).toContain('assistant-message__bubble--user');
    expect(fixture.nativeElement.textContent).toContain('hi there');
  });

  it('renders an ASSISTANT bubble with assistant-tinted styling', () => {
    setMessage(baseMessage({ role: 'ASSISTANT', content: 'reply' }));

    const bubble = fixture.debugElement.query(By.css('.assistant-message__bubble'));
    expect(bubble.nativeElement.classList).toContain('assistant-message__bubble--assistant');
  });

  it('renders a SYSTEM message centered and italic without a bubble', () => {
    setMessage(baseMessage({ role: 'SYSTEM', content: 'budget exceeded' }));

    expect(fixture.debugElement.query(By.css('.assistant-message__system'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.assistant-message__bubble'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('budget exceeded');
  });

  it('renders a TOOL message as a friendly tool card with the tool name pill', () => {
    const toolCall: AssistantToolCallView = {
      id: 'tc1',
      toolName: 'get_revenue_summary',
      args: { period: 'week' },
      result: { totalRevenue: 1234 },
      status: 'EXECUTED',
      blastTier: 'READ',
      durationMs: 42,
    };
    setMessage(
      baseMessage({
        role: 'TOOL',
        content: '',
        toolCall,
      }),
    );

    // No raw JSON appears anywhere in the user-facing card
    expect(fixture.nativeElement.textContent).not.toContain('{');
    expect(fixture.nativeElement.textContent).not.toContain('}');

    // Friendly success line resolves to the per-tool i18n key
    expect(fixture.nativeElement.textContent).toContain('assistant.tools.get_revenue_summary.success');

    // Tool name pill is shown
    const pill = fixture.debugElement.query(By.css('.assistant-message__tool-pill'));
    expect(pill).toBeTruthy();
    expect(pill.nativeElement.textContent).toContain('get_revenue_summary');

    // Duration is rendered
    expect(fixture.nativeElement.textContent).toContain('42 ms');
  });

  it('shows skill badge when message.skill is set', () => {
    setMessage(
      baseMessage({
        role: 'ASSISTANT',
        content: 'using skill',
        skill: { name: 'daily-briefing' },
      }),
    );

    expect(fixture.nativeElement.textContent).toContain('assistant.message.skillBadge');
  });

  it('shows agent badge and renders agent.result in body when provided', () => {
    setMessage(
      baseMessage({
        role: 'ASSISTANT',
        content: 'fallback',
        agent: { name: 'AnalyticsAgent', result: 'agent body output' },
      }),
    );

    expect(fixture.nativeElement.textContent).toContain('assistant.message.agentBadge');
    expect(fixture.nativeElement.textContent).toContain('agent body output');
    expect(fixture.nativeElement.textContent).not.toContain('fallback');
  });

  it('renders pending-approval card and emits approvalRequested when Review is clicked', (done) => {
    const pendingApproval: AssistantPendingApproval = {
      toolCallId: 'tc-42',
      toolName: 'send_sms',
      args: { to: '+216..', body: 'hi' },
      blastTier: 'CONFIRM_WRITE',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      receivedAt: Date.now(),
    };
    setMessage(
      baseMessage({
        role: 'ASSISTANT',
        content: 'I will send this',
        pendingApproval,
      }),
    );

    component.approvalRequested.subscribe((payload) => {
      expect(payload).toEqual({ toolCallId: 'tc-42' });
      done();
    });

    const reviewBtn = fixture.debugElement.query(By.css('.assistant-message__approval button'));
    expect(reviewBtn).toBeTruthy();
    reviewBtn.nativeElement.click();
  });

  it('renders an error card when message.error is set', () => {
    setMessage(
      baseMessage({
        role: 'ASSISTANT',
        content: 'oops',
        error: 'Provider returned 500',
      }),
    );

    const err = fixture.debugElement.query(By.css('.assistant-message__error'));
    expect(err).toBeTruthy();
    expect(err.nativeElement.textContent).toContain('Provider returned 500');
  });

  it('renders streaming cursor when isStreaming is true', () => {
    setMessage(
      baseMessage({
        role: 'ASSISTANT',
        content: 'partial',
        isStreaming: true,
      }),
    );

    expect(fixture.debugElement.query(By.css('.assistant-message__cursor'))).toBeTruthy();
  });

  it('renders a TOOL card with running state for PENDING_APPROVAL', () => {
    const toolCall: AssistantToolCallView = {
      id: 'tc-pa',
      toolName: 'cancel_appointment',
      args: { appointmentId: 'a1' },
      status: 'PENDING_APPROVAL',
      blastTier: 'CONFIRM_WRITE',
    };
    setMessage(
      baseMessage({
        role: 'TOOL',
        content: '',
        toolCall,
      }),
    );

    // running-state class
    const card = fixture.debugElement.query(By.css('.assistant-message__tool-card'));
    expect(card).toBeTruthy();
    expect(card.nativeElement.classList).toContain('assistant-message__tool-card--running');
    // Tool name still appears in the pill
    expect(fixture.nativeElement.textContent).toContain('cancel_appointment');
  });
});
