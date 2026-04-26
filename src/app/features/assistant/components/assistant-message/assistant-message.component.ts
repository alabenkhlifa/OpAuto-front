import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantUiMessage } from '../../../../core/models/assistant.model';

// Configure marked once. `breaks: true` turns single newlines into <br> for
// chat-style flow; `gfm: true` enables tables, fenced code, and autolinks.
marked.setOptions({ breaks: true, gfm: true });

@Component({
  selector: 'app-assistant-message',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './assistant-message.component.html',
  styleUrl: './assistant-message.component.css',
})
export class AssistantMessageComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly message = input.required<AssistantUiMessage>();
  readonly approvalRequested = output<{ toolCallId: string }>();

  readonly toolExpanded = signal(false);

  readonly role = computed(() => this.message().role);

  /**
   * Renders the message body as HTML for assistant turns (markdown via
   * marked + Angular's DomSanitizer for XSS safety) and as plain text for
   * user/system messages where markdown wouldn't make sense.
   */
  readonly renderedBody = computed<SafeHtml | string>(() => {
    const m = this.message();
    const text = m.agent?.result ?? m.content ?? '';
    if (!text) return '';
    if (m.role === 'ASSISTANT') {
      const html = marked.parse(text, { async: false }) as string;
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }
    return text;
  });
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
