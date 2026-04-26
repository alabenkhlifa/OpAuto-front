import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AssistantLauncherComponent } from './assistant-launcher.component';
import { AssistantStateService } from '../../services/assistant-state.service';
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
});
