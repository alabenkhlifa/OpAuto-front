import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantUiMessage } from '../../../../core/models/assistant.model';

@Component({
  selector: 'app-assistant-message',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './assistant-message.component.html',
  styleUrl: './assistant-message.component.css',
})
export class AssistantMessageComponent {
  readonly message = input.required<AssistantUiMessage>();
  readonly approvalRequested = output<{ toolCallId: string }>();

  readonly toolExpanded = signal(false);

  readonly role = computed(() => this.message().role);
  readonly isUser = computed(() => this.role() === 'USER');
  readonly isAssistant = computed(() => this.role() === 'ASSISTANT');
  readonly isTool = computed(() => this.role() === 'TOOL');
  readonly isSystem = computed(() => this.role() === 'SYSTEM');

  readonly bubbleClasses = computed(() => {
    const base = 'assistant-message__bubble';
    if (this.isUser()) return `${base} assistant-message__bubble--user`;
    if (this.isAssistant()) return `${base} assistant-message__bubble--assistant`;
    if (this.isTool()) return `${base} assistant-message__bubble--tool`;
    return `${base} assistant-message__bubble--system`;
  });

  readonly toolCallStatusKey = computed(() => {
    const tc = this.message().toolCall;
    if (!tc) return null;
    switch (tc.status) {
      case 'PENDING_APPROVAL':
        return 'assistant.message.toolCallPendingApproval';
      case 'EXECUTED':
      case 'APPROVED':
        return 'assistant.message.toolCallExecuted';
      case 'FAILED':
      case 'EXPIRED':
      case 'DENIED':
        return 'assistant.message.toolCallFailed';
      default:
        return 'assistant.message.toolCallStarted';
    }
  });

  readonly toolResultPreview = computed(() => {
    const result = this.message().toolCall?.result;
    if (result === undefined || result === null) return '';
    try {
      const json = JSON.stringify(result);
      return json.length > 120 ? `${json.slice(0, 120)}…` : json;
    } catch {
      return String(result);
    }
  });

  readonly toolResultPretty = computed(() => {
    const result = this.message().toolCall?.result;
    if (result === undefined || result === null) return '';
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  });

  toggleToolExpand(): void {
    this.toolExpanded.update((v) => !v);
  }

  onJsonKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.toolExpanded.set(false);
    }
  }

  reviewApproval(): void {
    const approval = this.message().pendingApproval;
    if (approval) {
      this.approvalRequested.emit({ toolCallId: approval.toolCallId });
    }
  }
}
