import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantConversationListComponent } from '../assistant-conversation-list/assistant-conversation-list.component';
import { AssistantConversationSummary } from '../../../../core/models/assistant.model';

/**
 * Slide-in overlay that wraps the existing AssistantConversationListComponent.
 * Backdrop click → close. ESC → close.
 *
 * The drawer is a thin presentational shell: the list itself owns selection,
 * delete and clear logic.
 */
@Component({
  selector: 'app-assistant-conversation-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe, AssistantConversationListComponent],
  templateUrl: './assistant-conversation-drawer.component.html',
  styleUrl: './assistant-conversation-drawer.component.css',
})
export class AssistantConversationDrawerComponent {
  readonly open = input(false);
  readonly conversations = input<AssistantConversationSummary[]>([]);
  readonly currentId = input<string | null>(null);

  readonly closed = output<void>();
  readonly conversationSelected = output<string>();
  readonly newConversationRequested = output<void>();
  readonly conversationDeleted = output<string>();
  readonly conversationCleared = output<string>();

  close(): void {
    this.closed.emit();
  }

  onConvSelect(id: string): void {
    this.conversationSelected.emit(id);
    this.close();
  }

  onNewConversation(): void {
    this.newConversationRequested.emit();
    this.close();
  }

  onConvDelete(id: string): void {
    this.conversationDeleted.emit(id);
  }

  onConvClear(id: string): void {
    this.conversationCleared.emit(id);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }
}
