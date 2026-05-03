import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantUiMessage } from '../../../../core/models/assistant.model';
import {
  AssistantToolPresenterService,
  PresentedTool,
} from '../../services/assistant-tool-presenter.service';

marked.setOptions({ breaks: true, gfm: true });

const DEBUG_FLAG = 'debug=assistant';

@Component({
  selector: 'app-assistant-message',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './assistant-message.component.html',
  styleUrl: './assistant-message.component.css',
})
export class AssistantMessageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly presenter = inject(AssistantToolPresenterService);

  readonly message = input.required<AssistantUiMessage>();
  readonly approvalRequested = output<{ toolCallId: string }>();

  readonly role = computed(() => this.message().role);

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
  readonly isSystem = computed(() => this.role() === 'SYSTEM');
  // TOOL-role messages are rendered through their parent assistant turn
  // (via toolCall on the assistant message) — silent-drop here so the panel
  // doesn't show a separate JSON-y bubble.
  readonly isToolStandalone = computed(() => this.role() === 'TOOL');

  readonly bubbleClasses = computed(() => {
    const base = 'assistant-message__bubble';
    if (this.isUser()) return `${base} assistant-message__bubble--user`;
    if (this.isAssistant()) return `${base} assistant-message__bubble--assistant`;
    return `${base} assistant-message__bubble--system`;
  });

  readonly presented = computed<PresentedTool | null>(() =>
    this.presenter.format(this.message()),
  );

  readonly debugMode = computed(
    () => typeof window !== 'undefined' && window.location.search.includes(DEBUG_FLAG),
  );

  readonly debugJson = computed(() => {
    if (!this.debugMode()) return '';
    const tc = this.message().toolCall;
    if (!tc) return '';
    try {
      return JSON.stringify(
        { args: tc.args, result: tc.result, status: tc.status },
        null,
        2,
      );
    } catch {
      return '';
    }
  });

  reviewApproval(): void {
    const approval = this.message().pendingApproval;
    if (approval) {
      this.approvalRequested.emit({ toolCallId: approval.toolCallId });
    }
  }
}
