import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import {
  AssistantApprovalDecision,
  AssistantChatRequest,
  AssistantConversationSummary,
  AssistantMessage,
  AssistantRegistry,
  AssistantSseEvent,
} from '../../../core/models/assistant.model';

const ASSISTANT_BASE = '/assistant';

// Defensive frontend signatures mirror the backend leak-detector. The backend
// validator should normally strip these before they reach the SSE stream;
// this is a last-ditch sanitiser so a backend miss never lets raw tool-call
// JSON render in the chat UI. We only check for presence (not full structure)
// because nested-brace JSON is hard to balance with regex — if a leak shape is
// detected, we drop the entire delta rather than try to splice it.
const LEAK_XML_TAG_DETECT_RE = /<function\s*=\s*[A-Za-z_][A-Za-z0-9_]*\s*>/i;
const LEAK_RAW_OBJECT_DETECT_RE = /\{\s*"type"\s*:\s*"function"\s*,\s*"name"\s*:/;

/**
 * Wraps the assistant HTTP + SSE endpoints.
 *
 * Uses `fetch()` + `ReadableStream` to consume SSE because EventSource
 * does not support POST nor custom Authorization headers. Each `data: <json>`
 * frame is parsed and emitted as an `AssistantSseEvent`. AbortController
 * tears the stream down on unsubscribe.
 */
@Injectable({ providedIn: 'root' })
export class AssistantChatService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private get apiBase(): string {
    return environment.apiUrl ?? 'http://localhost:3000/api';
  }

  /**
   * Open an SSE stream against `POST /api/assistant/chat`. Each emission is
   * one parsed server event. The stream completes on `done` / `error` events
   * or when the response body ends.
   */
  sendMessage(req: AssistantChatRequest): Observable<AssistantSseEvent> {
    return new Observable<AssistantSseEvent>(subscriber => {
      const controller = new AbortController();
      const url = `${this.apiBase}${ASSISTANT_BASE}/chat`;
      const token = this.auth.getToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
        signal: controller.signal,
      })
        .then(async response => {
          if (!response.ok) {
            subscriber.error(
              new Error(`Assistant chat failed: ${response.status} ${response.statusText}`),
            );
            return;
          }
          if (!response.body) {
            subscriber.error(new Error('Assistant chat returned no stream body'));
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              buffer = this.flushFrames(buffer, subscriber);
            }
            // Flush any final frame in the buffer (no trailing blank line).
            this.flushFrames(buffer + '\n\n', subscriber);
            subscriber.complete();
          } catch (err) {
            if (controller.signal.aborted) {
              subscriber.complete();
            } else {
              subscriber.error(err);
            }
          }
        })
        .catch(err => {
          if (controller.signal.aborted) {
            subscriber.complete();
          } else {
            subscriber.error(err);
          }
        });

      return () => controller.abort();
    });
  }

  /** Approve or deny a pending tool call. */
  decideApproval(
    toolCallId: string,
    decision: AssistantApprovalDecision,
  ): Observable<{ approved: boolean }> {
    return this.http.post<{ approved: boolean }>(
      `${ASSISTANT_BASE}/approvals/${encodeURIComponent(toolCallId)}/decide`,
      decision,
    );
  }

  /** List the user's recent conversations. */
  listConversations(): Observable<AssistantConversationSummary[]> {
    return this.http.get<AssistantConversationSummary[]>(`${ASSISTANT_BASE}/conversations`);
  }

  /** Fetch a single conversation by id (with full message history). */
  getConversation(
    id: string,
  ): Observable<{ id: string; title: string | null; messages: AssistantMessage[] }> {
    return this.http.get<{ id: string; title: string | null; messages: AssistantMessage[] }>(
      `${ASSISTANT_BASE}/conversations/${encodeURIComponent(id)}`,
    );
  }

  /** Soft-delete (archive) a conversation. */
  deleteConversation(id: string): Observable<{ archived: boolean }> {
    return this.http.delete<{ archived: boolean }>(
      `${ASSISTANT_BASE}/conversations/${encodeURIComponent(id)}`,
    );
  }

  /** Wipe all messages for a conversation but keep the shell. */
  clearConversation(id: string): Observable<{ cleared: number }> {
    return this.http.post<{ cleared: number }>(
      `${ASSISTANT_BASE}/conversations/${encodeURIComponent(id)}/clear`,
      {},
    );
  }

  /** Fetch the registry (tools, skills, agents) for UI hinting. */
  getRegistry(): Observable<AssistantRegistry> {
    return this.http.get<AssistantRegistry>(`${ASSISTANT_BASE}/registry`);
  }

  // ── SSE frame parser ─────────────────────────────────────────────────────
  /**
   * Drains complete SSE frames (separated by a blank line) from the buffer,
   * emits each parsed event, and returns the remaining tail buffer.
   */
  private flushFrames(
    buffer: string,
    subscriber: { next: (e: AssistantSseEvent) => void },
  ): string {
    let working = buffer.replace(/\r\n/g, '\n');
    let idx = working.indexOf('\n\n');
    while (idx !== -1) {
      const frame = working.slice(0, idx);
      working = working.slice(idx + 2);
      const parsed = this.parseFrame(frame);
      if (parsed) subscriber.next(parsed);
      idx = working.indexOf('\n\n');
    }
    return working;
  }

  private parseFrame(frame: string): AssistantSseEvent | null {
    if (!frame || !frame.trim()) return null;
    const dataLines: string[] = [];
    for (const rawLine of frame.split('\n')) {
      const line = rawLine.trimEnd();
      if (!line || line.startsWith(':')) continue; // comment/heartbeat
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^\s/, ''));
      }
      // We ignore `event:` and `id:` lines — the payload's `type` field
      // is the discriminator for AssistantSseEvent.
    }
    if (dataLines.length === 0) return null;
    const payload = dataLines.join('\n');
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        return this.sanitizeEvent(parsed as AssistantSseEvent);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Last-ditch defence against backend leaks. If the backend validator missed
   * a text-mode tool call (raw JSON object or `<function=...>` markup) and it
   * arrives in a `text` event delta, drop the entire delta. We deliberately
   * don't try to splice partial JSON out (nested braces are hard to balance
   * in a regex); the backend validator is the right place to scrub mixed
   * content. Dropping a tainted frame is strictly better than letting the
   * JSON render in the chat UI.
   */
  private sanitizeEvent(event: AssistantSseEvent): AssistantSseEvent | null {
    if (event.type !== 'text') return event;
    if (
      LEAK_XML_TAG_DETECT_RE.test(event.delta) ||
      LEAK_RAW_OBJECT_DETECT_RE.test(event.delta)
    ) {
      console.warn('[assistant] dropped tool-call leak in text delta');
      return null;
    }
    return event;
  }
}
