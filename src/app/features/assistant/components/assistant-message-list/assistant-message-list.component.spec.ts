import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AssistantMessageListComponent } from './assistant-message-list.component';
import { AssistantMessageComponent } from '../assistant-message/assistant-message.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantUiMessage } from '../../../../core/models/assistant.model';

describe('AssistantMessageListComponent', () => {
  let fixture: ComponentFixture<AssistantMessageListComponent>;
  let component: AssistantMessageListComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const mkMessage = (id: string, overrides: Partial<AssistantUiMessage> = {}): AssistantUiMessage => ({
    id,
    conversationId: 'c1',
    role: 'USER',
    content: `msg ${id}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(async () => {
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: { subscribe: () => ({ unsubscribe: () => {} }) },
    });
    translationService.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [AssistantMessageListComponent, AssistantMessageComponent],
      providers: [{ provide: TranslationService, useValue: translationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantMessageListComponent);
    component = fixture.componentInstance;
  });

  it('renders the empty-state hint when messages is empty', () => {
    fixture.componentRef.setInput('messages', []);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.assistant-message-list__empty'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('assistant.message.emptyHint');
    expect(fixture.debugElement.queryAll(By.directive(AssistantMessageComponent)).length).toBe(0);
  });

  it('renders one assistant-message per message item', () => {
    fixture.componentRef.setInput('messages', [
      mkMessage('a'),
      mkMessage('b', { role: 'ASSISTANT', content: 'hi' }),
      mkMessage('c'),
    ]);
    fixture.detectChanges();

    const rendered = fixture.debugElement.queryAll(By.directive(AssistantMessageComponent));
    expect(rendered.length).toBe(3);
  });

  it('shows the thinking pill when streaming and the last message is from the user', () => {
    fixture.componentRef.setInput('messages', [mkMessage('u1', { role: 'USER' })]);
    fixture.componentRef.setInput('isStreaming', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.assistant-message-list__thinking'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('assistant.message.thinking');
  });

  it('hides the thinking pill when not streaming', () => {
    fixture.componentRef.setInput('messages', [mkMessage('u1', { role: 'USER' })]);
    fixture.componentRef.setInput('isStreaming', false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.assistant-message-list__thinking'))).toBeNull();
  });

  it('hides the thinking pill when streaming but last message is assistant', () => {
    fixture.componentRef.setInput('messages', [
      mkMessage('u1', { role: 'USER' }),
      mkMessage('a1', { role: 'ASSISTANT', content: 'thinking already started' }),
    ]);
    fixture.componentRef.setInput('isStreaming', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.assistant-message-list__thinking'))).toBeNull();
  });

  it('scrolls to bottom when messages length changes', async () => {
    fixture.componentRef.setInput('messages', [mkMessage('a')]);
    fixture.detectChanges();

    const anchorEl = fixture.debugElement.query(By.css('.assistant-message-list__anchor'))
      .nativeElement as HTMLElement;
    const spy = spyOn(anchorEl, 'scrollIntoView');

    fixture.componentRef.setInput('messages', [mkMessage('a'), mkMessage('b')]);
    fixture.detectChanges();

    // queueMicrotask flushes after the current microtask queue completes
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });

  it('forwards approvalRequested events from a child message', (done) => {
    const msg = mkMessage('p1', {
      role: 'ASSISTANT',
      content: 'approve me',
      pendingApproval: {
        toolCallId: 'tc-99',
        toolName: 'send_sms',
        args: {},
        blastTier: 'CONFIRM_WRITE',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        receivedAt: Date.now(),
      },
    });
    fixture.componentRef.setInput('messages', [msg]);
    fixture.detectChanges();

    component.approvalRequested.subscribe((payload) => {
      expect(payload).toEqual({ toolCallId: 'tc-99' });
      done();
    });

    const reviewBtn = fixture.debugElement.query(By.css('.assistant-message__approval button'));
    expect(reviewBtn).toBeTruthy();
    reviewBtn.nativeElement.click();
  });
});
