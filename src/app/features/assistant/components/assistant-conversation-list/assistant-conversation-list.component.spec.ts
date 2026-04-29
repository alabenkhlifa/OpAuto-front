import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { AssistantConversationListComponent } from './assistant-conversation-list.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantConversationSummary } from '../../../../core/models/assistant.model';

@Component({
  standalone: true,
  imports: [AssistantConversationListComponent],
  template: `
    <app-assistant-conversation-list
      [conversations]="conversations()"
      [currentId]="currentId()"
      (conversationSelected)="onSelected($event)"
      (newConversationRequested)="onNew()"
      (conversationDeleted)="onDeleted($event)"
      (conversationCleared)="onCleared($event)"
    />
  `,
})
class HostComponent {
  conversations = signal<AssistantConversationSummary[]>([]);
  currentId = signal<string | null>(null);

  selectedId: string | null = null;
  newCount = 0;
  deletedId: string | null = null;
  clearedId: string | null = null;

  onSelected(id: string): void {
    this.selectedId = id;
  }
  onNew(): void {
    this.newCount += 1;
  }
  onDeleted(id: string): void {
    this.deletedId = id;
  }
  onCleared(id: string): void {
    this.clearedId = id;
  }
}

describe('AssistantConversationListComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const baseTime = new Date('2026-04-26T12:00:00Z').getTime();

  const mkConversation = (
    overrides: Partial<AssistantConversationSummary> & { id: string },
  ): AssistantConversationSummary => ({
    id: overrides.id,
    // Use 'title' in overrides so an explicit null/empty-string is preserved.
    title: 'title' in overrides ? overrides.title! : `Conversation ${overrides.id}`,
    pinned: overrides.pinned ?? false,
    updatedAt: overrides.updatedAt ?? new Date(baseTime).toISOString(),
    createdAt: overrides.createdAt ?? new Date(baseTime).toISOString(),
  });

  beforeEach(async () => {
    const translationSpy = jasmine.createSpyObj<TranslationService>(
      'TranslationService',
      ['instant', 'translate'],
      { translations$: new BehaviorSubject({}) },
    );
    translationSpy.instant.and.callFake((key: string, params?: Record<string, unknown>) => {
      if (params && typeof params['count'] === 'number') {
        return `${key}:${params['count']}`;
      }
      return key;
    });

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: TranslationService, useValue: translationSpy }],
    }).compileComponents();

    translationService = TestBed.inject(TranslationService) as jasmine.SpyObj<TranslationService>;

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(baseTime));

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  function getListComponent(): AssistantConversationListComponent {
    return fixture.debugElement.query(By.directive(AssistantConversationListComponent))
      .componentInstance as AssistantConversationListComponent;
  }

  it('renders empty state when there are no conversations', () => {
    host.conversations.set([]);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.assistant-conversation-list__empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('assistant.conversation.empty');
  });

  it('sorts conversations by updatedAt desc and clamps to 50 visible', () => {
    const conversations: AssistantConversationSummary[] = [];
    for (let i = 0; i < 60; i++) {
      conversations.push(
        mkConversation({
          id: `c${i}`,
          title: `Title ${i}`,
          updatedAt: new Date(baseTime - i * 60_000).toISOString(),
        }),
      );
    }
    host.conversations.set(conversations);
    fixture.detectChanges();

    const list = getListComponent();
    const sorted = list.sortedConversations();
    expect(sorted.length).toBe(50);
    // Most recently updated should be first
    expect(sorted[0].id).toBe('c0');
    expect(sorted[1].id).toBe('c1');
    expect(sorted[49].id).toBe('c49');
  });

  it('emits conversationSelected with the right id when a row is clicked', () => {
    host.conversations.set([
      mkConversation({ id: 'a', title: 'Alpha', updatedAt: new Date(baseTime).toISOString() }),
      mkConversation({
        id: 'b',
        title: 'Beta',
        updatedAt: new Date(baseTime - 60_000).toISOString(),
      }),
    ]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll(
      '.assistant-conversation-list__item',
    ) as NodeListOf<HTMLButtonElement>;
    expect(items.length).toBe(2);
    items[1].click();
    fixture.detectChanges();

    expect(host.selectedId).toBe('b');
  });

  it('marks selected row with aria-current and selected modifier', () => {
    host.conversations.set([
      mkConversation({ id: 'a', title: 'Alpha' }),
      mkConversation({ id: 'b', title: 'Beta' }),
    ]);
    host.currentId.set('b');
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll(
      '.assistant-conversation-list__item',
    ) as NodeListOf<HTMLButtonElement>;
    const selected = Array.from(items).find((el) => el.getAttribute('aria-current') === 'true');
    expect(selected).toBeTruthy();
    expect(selected!.classList).toContain('assistant-conversation-list__item--selected');
    expect(selected!.textContent).toContain('Beta');
  });

  it('emits newConversationRequested when the "+ New" button is clicked', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    const newBtn = fixture.nativeElement.querySelector(
      '.assistant-conversation-list__new-btn',
    ) as HTMLButtonElement;
    newBtn.click();
    fixture.detectChanges();

    expect(host.newCount).toBe(1);
  });

  it('uses untitled translation key when title is null', () => {
    host.conversations.set([
      mkConversation({ id: 'a', title: null }),
    ]);
    fixture.detectChanges();

    const titleEl = fixture.nativeElement.querySelector(
      '.assistant-conversation-list__item-title',
    );
    expect(titleEl.textContent).toContain('assistant.conversation.untitled');
  });

  it('opens the actions menu when the 3-dot button is clicked', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    const menuBtn = fixture.nativeElement.querySelector(
      '.assistant-conversation-list__menu-btn',
    ) as HTMLButtonElement;
    menuBtn.click();
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.assistant-conversation-list__menu');
    expect(menu).toBeTruthy();
    expect(menuBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits conversationDeleted when delete is confirmed', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(true);

    const list = getListComponent();
    list.deleteConversation(new MouseEvent('click'), { ...mkConversation({ id: 'a' }) });
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalledWith('assistant.conversation.deleteConfirm');
    expect(host.deletedId).toBe('a');
  });

  it('does not emit conversationDeleted when delete is cancelled', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(false);

    const list = getListComponent();
    list.deleteConversation(new MouseEvent('click'), { ...mkConversation({ id: 'a' }) });
    fixture.detectChanges();

    expect(host.deletedId).toBeNull();
  });

  it('emits conversationCleared when clear is confirmed', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(true);

    const list = getListComponent();
    list.clearConversation(new MouseEvent('click'), { ...mkConversation({ id: 'a' }) });
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalledWith('assistant.conversation.clearConfirm');
    expect(host.clearedId).toBe('a');
  });

  it('does not emit conversationCleared when clear is cancelled', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(false);

    const list = getListComponent();
    list.clearConversation(new MouseEvent('click'), { ...mkConversation({ id: 'a' }) });
    fixture.detectChanges();

    expect(host.clearedId).toBeNull();
  });

  it('closes the menu when Escape is pressed', () => {
    host.conversations.set([mkConversation({ id: 'a' })]);
    fixture.detectChanges();

    const list = getListComponent();
    list.openMenuId.set('a');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.assistant-conversation-list__menu')).toBeTruthy();

    list.onEscape();
    fixture.detectChanges();
    expect(list.openMenuId()).toBeNull();
  });

  describe('relativeTime', () => {
    let list: AssistantConversationListComponent;

    beforeEach(() => {
      host.conversations.set([mkConversation({ id: 'a' })]);
      fixture.detectChanges();
      list = getListComponent();
    });

    it('returns justNow for less than a minute', () => {
      const result = list.relativeTime(new Date(baseTime - 30_000).toISOString());
      expect(result).toBe('assistant.conversation.justNow');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.justNow',
      );
    });

    it('returns minutesAgo with the right count for under an hour', () => {
      const result = list.relativeTime(new Date(baseTime - 5 * 60_000).toISOString());
      expect(result).toBe('assistant.conversation.minutesAgo:5');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.minutesAgo',
        { count: 5 },
      );
    });

    it('returns hoursAgo with the right count for under a day', () => {
      const result = list.relativeTime(new Date(baseTime - 3 * 60 * 60_000).toISOString());
      expect(result).toBe('assistant.conversation.hoursAgo:3');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.hoursAgo',
        { count: 3 },
      );
    });

    it('returns yesterday when exactly one day ago', () => {
      const result = list.relativeTime(new Date(baseTime - 24 * 60 * 60_000).toISOString());
      expect(result).toBe('assistant.conversation.yesterday');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.yesterday',
      );
    });

    it('returns daysAgo with count for 2-6 days', () => {
      const result = list.relativeTime(new Date(baseTime - 3 * 24 * 60 * 60_000).toISOString());
      expect(result).toBe('assistant.conversation.daysAgo:3');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.daysAgo',
        { count: 3 },
      );
    });

    it('returns weeksAgo with count for 7+ days', () => {
      const result = list.relativeTime(new Date(baseTime - 14 * 24 * 60 * 60_000).toISOString());
      expect(result).toBe('assistant.conversation.weeksAgo:2');
      expect(translationService.instant).toHaveBeenCalledWith(
        'assistant.conversation.weeksAgo',
        { count: 2 },
      );
    });

    it('returns empty string for an invalid date', () => {
      expect(list.relativeTime('not-a-date')).toBe('');
    });
  });
});
