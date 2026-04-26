import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantConversationSummary } from '../../../../core/models/assistant.model';

const MAX_VISIBLE = 50;

@Component({
  selector: 'app-assistant-conversation-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assistant-conversation-list.component.html',
  styleUrl: './assistant-conversation-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantConversationListComponent {
  private readonly translationService = inject(TranslationService);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  readonly conversations = input.required<AssistantConversationSummary[]>();
  readonly currentId = input<string | null>(null);

  readonly conversationSelected = output<string>();
  readonly newConversationRequested = output<void>();
  readonly conversationDeleted = output<string>();
  readonly conversationCleared = output<string>();

  /** Id of the conversation whose 3-dot menu is currently open. */
  readonly openMenuId = signal<string | null>(null);
  /** Mobile accordion expansion state (only relevant under 768px). */
  readonly accordionExpanded = signal(true);

  readonly sortedConversations = computed(() => {
    return [...this.conversations()]
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        return bTime - aTime;
      })
      .slice(0, MAX_VISIBLE);
  });

  readonly isEmpty = computed(() => this.sortedConversations().length === 0);

  titleFor(conversation: AssistantConversationSummary): string {
    if (conversation.title && conversation.title.trim().length > 0) {
      return conversation.title;
    }
    return this.translationService.instant('assistant.conversation.untitled');
  }

  isSelected(conversation: AssistantConversationSummary): boolean {
    return this.currentId() === conversation.id;
  }

  selectConversation(conversation: AssistantConversationSummary): void {
    this.openMenuId.set(null);
    this.conversationSelected.emit(conversation.id);
  }

  requestNewConversation(): void {
    this.openMenuId.set(null);
    this.newConversationRequested.emit();
  }

  toggleMenu(event: Event, conversationId: string): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === conversationId ? null : conversationId));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  deleteConversation(event: Event, conversation: AssistantConversationSummary): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    const message = this.translationService.instant('assistant.conversation.deleteConfirm');
    if (window.confirm(message)) {
      this.conversationDeleted.emit(conversation.id);
    }
  }

  clearConversation(event: Event, conversation: AssistantConversationSummary): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    const message = this.translationService.instant('assistant.conversation.clearConfirm');
    if (window.confirm(message)) {
      this.conversationCleared.emit(conversation.id);
    }
  }

  toggleAccordion(): void {
    this.accordionExpanded.update((v) => !v);
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.openMenuId() === null) return;
    const target = event.target as HTMLElement | null;
    const host = this.hostRef.nativeElement as HTMLElement;
    if (!target || !host.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.openMenuId() !== null) {
      this.closeMenu();
    }
  }

  trackById = (_: number, item: AssistantConversationSummary): string => item.id;

  /**
   * Format the relative time for a conversation's updatedAt timestamp.
   * Returns a translated string. Visible to tests via the public API.
   */
  relativeTime(iso: string): string {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) {
      return '';
    }
    const now = Date.now();
    const diffMs = Math.max(0, now - ts);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (diffSec < 60) {
      return this.translationService.instant('assistant.conversation.justNow');
    }
    if (diffMin < 60) {
      return this.translationService.instant('assistant.conversation.minutesAgo', {
        count: diffMin,
      });
    }
    if (diffHour < 24) {
      return this.translationService.instant('assistant.conversation.hoursAgo', {
        count: diffHour,
      });
    }
    if (diffDay === 1) {
      return this.translationService.instant('assistant.conversation.yesterday');
    }
    if (diffDay < 7) {
      return this.translationService.instant('assistant.conversation.daysAgo', {
        count: diffDay,
      });
    }
    return this.translationService.instant('assistant.conversation.weeksAgo', {
      count: diffWeek,
    });
  }
}
