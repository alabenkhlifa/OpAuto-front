import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AssistantLauncherComponent } from './assistant-launcher.component';
import { AssistantStateService } from '../../services/assistant-state.service';
import { AssistantChatService } from '../../services/assistant-chat.service';
import { AssistantPendingApproval } from '../../../../core/models/assistant.model';

@Component({ standalone: true, template: 'dashboard' })
class DashboardStub {}

@Component({ standalone: true, template: 'auth' })
class AuthStub {}

describe('AssistantLauncherComponent', () => {
  let fixture: ComponentFixture<AssistantLauncherComponent>;
  let component: AssistantLauncherComponent;
  let state: AssistantStateService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AssistantLauncherComponent, HttpClientTestingModule],
      providers: [
        provideRouter([
          { path: 'dashboard', component: DashboardStub },
          { path: 'auth', component: AuthStub },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantLauncherComponent);
    component = fixture.componentInstance;
    state = TestBed.inject(AssistantStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('renders the launcher button on a non-auth route', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.assistant-launcher__btn');
    expect(btn).toBeTruthy();
  });

  it('hides the launcher on /auth route', async () => {
    await router.navigateByUrl('/auth');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.assistant-launcher__btn');
    expect(btn).toBeNull();
  });

  it('toggles the panel state when clicked', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    expect(state.panelState()).toBe('closed');

    const btn = fixture.nativeElement.querySelector('.assistant-launcher__btn') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    expect(state.panelState()).toBe('open');

    btn.click();
    fixture.detectChanges();
    expect(state.panelState()).toBe('closed');
  });

  it('shows a pending-approval indicator when state has one', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();

    const approval: AssistantPendingApproval = {
      toolCallId: 'tc-1',
      toolName: 'send_sms',
      args: {},
      blastTier: 'CONFIRM_WRITE',
      expiresAt: new Date().toISOString(),
      receivedAt: Date.now(),
    };
    state.setPendingApproval(approval);
    fixture.detectChanges();

    const dot = fixture.nativeElement.querySelector('.assistant-launcher__dot');
    expect(dot).toBeTruthy();
  });

  it('does not show the indicator when no approval is pending', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    const dot = fixture.nativeElement.querySelector('.assistant-launcher__dot');
    expect(dot).toBeNull();
  });

  describe('rehydrateActiveConversation (UI Bug 2)', () => {
    function setupWithChatStub(stub: Partial<AssistantChatService>): {
      fixture: ComponentFixture<AssistantLauncherComponent>;
      state: AssistantStateService;
    } {
      TestBed.resetTestingModule();
      return TestBed.configureTestingModule({
        imports: [AssistantLauncherComponent, HttpClientTestingModule],
        providers: [
          provideRouter([
            { path: 'dashboard', component: DashboardStub },
            { path: 'auth', component: AuthStub },
          ]),
          { provide: AssistantChatService, useValue: stub },
        ],
      })
        .compileComponents()
        .then(() => {
          const f = TestBed.createComponent(AssistantLauncherComponent);
          const s = TestBed.inject(AssistantStateService);
          f.detectChanges();
          return { fixture: f, state: s };
        }) as unknown as {
        fixture: ComponentFixture<AssistantLauncherComponent>;
        state: AssistantStateService;
      };
    }

    it('reloads the saved conversation messages when localStorage holds an id', async () => {
      localStorage.setItem('assistant.currentConversationId', 'conv-saved');
      const stub: Partial<AssistantChatService> = {
        listConversations: () => of([]),
        getConversation: () =>
          of({
            id: 'conv-saved',
            title: 'Yesterday chat',
            messages: [
              { id: 'm1', conversationId: 'conv-saved', role: 'USER', content: 'hi', createdAt: '2026-05-02T12:00:00Z' },
              { id: 'm2', conversationId: 'conv-saved', role: 'ASSISTANT', content: 'hello', createdAt: '2026-05-02T12:00:01Z' },
            ],
          }) as never,
      };
      const { state: s } = await setupWithChatStub(stub);
      expect(s.currentConversationId()).toBe('conv-saved');
      expect(s.messages().length).toBe(2);
      expect(s.messages()[0].content).toBe('hi');
    });

    it('clears the saved id silently when the saved conversation no longer exists', async () => {
      localStorage.setItem('assistant.currentConversationId', 'conv-deleted');
      const stub: Partial<AssistantChatService> = {
        listConversations: () => of([]),
        getConversation: () =>
          throwError(() => ({ status: 404, message: 'not found' })) as never,
      };
      const { state: s } = await setupWithChatStub(stub);
      expect(s.currentConversationId()).toBeNull();
      expect(s.messages()).toEqual([]);
    });

    it('does not fetch a conversation when localStorage has no saved id', async () => {
      const getConversation = jasmine.createSpy('getConversation');
      const stub: Partial<AssistantChatService> = {
        listConversations: () => of([]),
        getConversation,
      };
      await setupWithChatStub(stub);
      expect(getConversation).not.toHaveBeenCalled();
    });
  });

  describe('approval decision (UI Bug 3 — DENY ack regression)', () => {
    function setupWithChatStub(stub: Partial<AssistantChatService>): {
      fixture: ComponentFixture<AssistantLauncherComponent>;
      state: AssistantStateService;
      component: AssistantLauncherComponent;
    } {
      TestBed.resetTestingModule();
      return TestBed.configureTestingModule({
        imports: [AssistantLauncherComponent, HttpClientTestingModule],
        providers: [
          provideRouter([
            { path: 'dashboard', component: DashboardStub },
            { path: 'auth', component: AuthStub },
          ]),
          { provide: AssistantChatService, useValue: stub },
        ],
      })
        .compileComponents()
        .then(() => {
          const f = TestBed.createComponent(AssistantLauncherComponent);
          const s = TestBed.inject(AssistantStateService);
          const c = f.componentInstance;
          f.detectChanges();
          return { fixture: f, state: s, component: c };
        }) as unknown as {
        fixture: ComponentFixture<AssistantLauncherComponent>;
        state: AssistantStateService;
        component: AssistantLauncherComponent;
      };
    }

    function makePending(): AssistantPendingApproval {
      return {
        toolCallId: 'tc-deny-1',
        toolName: 'cancel_appointment',
        args: { appointmentId: 'abc' },
        blastTier: 'CONFIRM_WRITE',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        receivedAt: Date.now(),
      };
    }

    it('fires __resume__ on DENY so the backend can emit the deterministic ack text', async () => {
      const sendMessage = jasmine.createSpy('sendMessage').and.returnValue(of());
      const stub: Partial<AssistantChatService> = {
        listConversations: () => of([]),
        decideApproval: () => of({ approved: false }),
        sendMessage,
      };
      const { state: s, component } = await setupWithChatStub(stub);
      s.setPendingApproval(makePending());
      component.onApprovalDecided({ decision: 'deny' });

      expect(sendMessage).toHaveBeenCalledWith(
        jasmine.objectContaining({ userMessage: '__resume__:tc-deny-1' }),
      );
      expect(s.pendingApproval()).toBeNull();
    });

    it('fires __resume__ on APPROVE for the post-execution follow-up turn', async () => {
      const sendMessage = jasmine.createSpy('sendMessage').and.returnValue(of());
      const stub: Partial<AssistantChatService> = {
        listConversations: () => of([]),
        decideApproval: () => of({ approved: true }),
        sendMessage,
      };
      const { state: s, component } = await setupWithChatStub(stub);
      s.setPendingApproval(makePending());
      component.onApprovalDecided({ decision: 'approve' });

      expect(sendMessage).toHaveBeenCalledWith(
        jasmine.objectContaining({ userMessage: '__resume__:tc-deny-1' }),
      );
    });
  });
});
