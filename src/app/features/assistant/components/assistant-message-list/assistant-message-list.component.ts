import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantUiMessage } from '../../../../core/models/assistant.model';
import { AssistantMessageComponent } from '../assistant-message/assistant-message.component';

@Component({
  selector: 'app-assistant-message-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe, AssistantMessageComponent],
  templateUrl: './assistant-message-list.component.html',
  styleUrl: './assistant-message-list.component.css',
})
export class AssistantMessageListComponent implements AfterViewInit {
  readonly messages = input<AssistantUiMessage[]>([]);
  readonly isStreaming = input<boolean>(false);
  readonly approvalRequested = output<{ toolCallId: string }>();

  readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');

  readonly messageCount = computed(() => this.messages().length);

  readonly isEmpty = computed(() => this.messageCount() === 0);

  readonly showThinking = computed(() => {
    if (!this.isStreaming()) return false;
    const list = this.messages();
    if (list.length === 0) return true;
    const last = list[list.length - 1];
    return last.role === 'USER';
  });

  constructor() {
    effect(() => {
      // React to message count changes (and streaming) and scroll to bottom.
      this.messageCount();
      this.isStreaming();
      this.scrollToBottom();
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  onApprovalRequested(payload: { toolCallId: string }): void {
    this.approvalRequested.emit(payload);
  }

  trackById(_index: number, item: AssistantUiMessage): string {
    return item.id;
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const anchor = this.scrollAnchor();
      anchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }
}
