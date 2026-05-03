import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AssistantConversationDrawerComponent } from './assistant-conversation-drawer.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantConversationSummary } from '../../../../core/models/assistant.model';

describe('AssistantConversationDrawerComponent', () => {
  let fixture: ComponentFixture<AssistantConversationDrawerComponent>;
  let component: AssistantConversationDrawerComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const sampleConversations: AssistantConversationSummary[] = [
    {
      id: 'c1',
      title: 'First chat',
      pinned: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  const setOpen = (open: boolean): void => {
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('conversations', sampleConversations);
    fixture.componentRef.setInput('currentId', null);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: { subscribe: () => ({ unsubscribe: () => {} }) },
    });
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AssistantConversationDrawerComponent],
      providers: [{ provide: TranslationService, useValue: translationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantConversationDrawerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('renders nothing when open=false', () => {
    setOpen(false);
    expect(fixture.debugElement.query(By.css('.conv-drawer'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.conv-drawer-backdrop'))).toBeNull();
  });

  it('renders backdrop + aside when open=true', () => {
    setOpen(true);
    expect(fixture.debugElement.query(By.css('.conv-drawer-backdrop'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.conv-drawer'))).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Regression: the projected drawer host must have pointer-events: auto,
  // otherwise the panel slot's `pointer-events: none` cascades through and
  // the close button silently swallows clicks. Angular view encapsulation
  // means the panel's `> *` rule never matched the host — this regression
  // test guards the `:host { pointer-events: auto }` declaration.
  // ──────────────────────────────────────────────────────────────────────
  it('host element has pointer-events: auto so projected clicks reach the close button', () => {
    setOpen(true);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host); // attach so getComputedStyle is meaningful
    const computed = window.getComputedStyle(host).pointerEvents;
    expect(computed).toBe('auto');
    document.body.removeChild(host);
  });

  it('emits closed when the close button is clicked', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    const btn = fixture.debugElement.query(By.css('.conv-drawer__close'));
    expect(btn).toBeTruthy();
    btn.nativeElement.click();

    expect(events.length).toBe(1);
  });

  it('emits closed when the backdrop is clicked', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    const backdrop = fixture.debugElement.query(By.css('.conv-drawer-backdrop'));
    backdrop.nativeElement.click();

    expect(events.length).toBe(1);
  });

  it('emits closed on ESC keydown when open', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(events.length).toBe(1);
  });

  it('does not emit closed on ESC when drawer is closed', () => {
    setOpen(false);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(events.length).toBe(0);
  });

  it('emits conversationSelected and closed when a conversation is picked', () => {
    setOpen(true);
    const selected: string[] = [];
    const closed: number[] = [];
    component.conversationSelected.subscribe((id) => selected.push(id));
    component.closed.subscribe(() => closed.push(1));

    component.onConvSelect('c1');

    expect(selected).toEqual(['c1']);
    expect(closed.length).toBe(1);
  });
});
