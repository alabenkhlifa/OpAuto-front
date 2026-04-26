import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AssistantChatService } from './assistant-chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { AssistantSseEvent } from '../../../core/models/assistant.model';

describe('AssistantChatService', () => {
  let service: AssistantChatService;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    authSpy.getToken.and.returnValue('test-jwt');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AssistantChatService,
        { provide: AuthService, useValue: authSpy },
      ],
    });
    service = TestBed.inject(AssistantChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── SSE / fetch ─────────────────────────────────────────────────────────
  describe('sendMessage (SSE via fetch)', () => {
    function buildStreamResponse(chunks: string[]): Response {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          for (const chunk of chunks) {
            controller.enqueue(enc.encode(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    it('parses multiple SSE frames and emits events', (done) => {
      const events: AssistantSseEvent[] = [];
      const fetchSpy = spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(
          buildStreamResponse([
            'data: {"type":"text","delta":"He"}\n\n',
            'data: {"type":"text","delta":"llo"}\n\n',
            'data: {"type":"done","messageId":"m-1"}\n\n',
          ]),
        ),
      );

      service.sendMessage({ userMessage: 'hi' }).subscribe({
        next: e => events.push(e),
        complete: () => {
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          const [, init] = fetchSpy.calls.mostRecent().args;
          const headers = (init as RequestInit).headers as Record<string, string>;
          expect(headers['Authorization']).toBe('Bearer test-jwt');
          expect(headers['Accept']).toBe('text/event-stream');
          expect(events.length).toBe(3);
          expect(events[0]).toEqual({ type: 'text', delta: 'He' });
          expect(events[1]).toEqual({ type: 'text', delta: 'llo' });
          expect(events[2]).toEqual({ type: 'done', messageId: 'm-1' });
          done();
        },
        error: err => done.fail(err),
      });
    });

    it('handles approval_request and tool_call events', (done) => {
      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(
          buildStreamResponse([
            'data: {"type":"tool_call","toolCallId":"tc-1","name":"x","args":{}}\n\n',
            'data: {"type":"approval_request","toolCallId":"tc-1","toolName":"x","args":{},"blastTier":"CONFIRM_WRITE","expiresAt":"2030-01-01T00:00:00Z"}\n\n',
          ]),
        ),
      );
      const events: AssistantSseEvent[] = [];
      service.sendMessage({ userMessage: 'do it' }).subscribe({
        next: e => events.push(e),
        complete: () => {
          expect(events[0].type).toBe('tool_call');
          expect(events[1].type).toBe('approval_request');
          done();
        },
      });
    });

    it('skips comment lines and ignores malformed JSON', (done) => {
      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(
          buildStreamResponse([
            ': heartbeat\n\n',
            'data: not-json\n\n',
            'data: {"type":"text","delta":"ok"}\n\n',
          ]),
        ),
      );
      const events: AssistantSseEvent[] = [];
      service.sendMessage({ userMessage: 'hi' }).subscribe({
        next: e => events.push(e),
        complete: () => {
          expect(events.length).toBe(1);
          expect(events[0]).toEqual({ type: 'text', delta: 'ok' });
          done();
        },
      });
    });

    it('errors when fetch responds non-OK', (done) => {
      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(new Response('nope', { status: 500, statusText: 'Server Error' })),
      );
      service.sendMessage({ userMessage: 'hi' }).subscribe({
        next: () => done.fail('should not emit'),
        error: err => {
          expect(err.message).toContain('500');
          done();
        },
      });
    });

    it('aborts fetch on unsubscribe', () => {
      const abortSpy = jasmine.createSpy('abort');
      // Stall the fetch so we can assert the abort happens before resolution.
      spyOn(window, 'fetch').and.callFake((_url, init) => {
        const signal = (init as RequestInit).signal as AbortSignal;
        signal?.addEventListener('abort', abortSpy);
        return new Promise(() => {
          /* never resolves */
        });
      });
      const sub = service.sendMessage({ userMessage: 'hi' }).subscribe();
      sub.unsubscribe();
      expect(abortSpy).toHaveBeenCalled();
    });
  });

  // ── HTTP endpoints ──────────────────────────────────────────────────────
  describe('decideApproval', () => {
    it('POSTs to /assistant/approvals/:id/decide', () => {
      let result: { approved: boolean } | undefined;
      service.decideApproval('tc-1', { decision: 'approve' }).subscribe(r => (result = r));
      const req = httpMock.expectOne('/assistant/approvals/tc-1/decide');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ decision: 'approve' });
      req.flush({ approved: true });
      expect(result).toEqual({ approved: true });
    });
  });

  describe('listConversations', () => {
    it('GETs /assistant/conversations', () => {
      const data = [
        {
          id: 'c1',
          title: 'Chat',
          pinned: false,
          updatedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];
      let actual: unknown;
      service.listConversations().subscribe(r => (actual = r));
      const req = httpMock.expectOne('/assistant/conversations');
      expect(req.request.method).toBe('GET');
      req.flush(data);
      expect(actual).toEqual(data);
    });
  });

  describe('getConversation', () => {
    it('GETs /assistant/conversations/:id', () => {
      service.getConversation('c1').subscribe();
      const req = httpMock.expectOne('/assistant/conversations/c1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'c1', title: 't', messages: [] });
    });
  });

  describe('deleteConversation', () => {
    it('DELETEs /assistant/conversations/:id', () => {
      let res: { archived: boolean } | undefined;
      service.deleteConversation('c1').subscribe(r => (res = r));
      const req = httpMock.expectOne('/assistant/conversations/c1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ archived: true });
      expect(res).toEqual({ archived: true });
    });
  });

  describe('clearConversation', () => {
    it('POSTs /assistant/conversations/:id/clear', () => {
      let res: { cleared: number } | undefined;
      service.clearConversation('c1').subscribe(r => (res = r));
      const req = httpMock.expectOne('/assistant/conversations/c1/clear');
      expect(req.request.method).toBe('POST');
      req.flush({ cleared: 5 });
      expect(res).toEqual({ cleared: 5 });
    });
  });

  describe('getRegistry', () => {
    it('GETs /assistant/registry', () => {
      service.getRegistry().subscribe();
      const req = httpMock.expectOne('/assistant/registry');
      expect(req.request.method).toBe('GET');
      req.flush({ tools: [], skills: [], agents: [] });
    });
  });

  it('uses environment.apiUrl as fetch base URL', (done) => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.close();
            },
          }),
          { status: 200 },
        ),
      ),
    );
    service.sendMessage({ userMessage: 'hi' }).subscribe({
      complete: () => {
        const [url] = fetchSpy.calls.mostRecent().args;
        expect(String(url)).toBe(`${environment.apiUrl}/assistant/chat`);
        done();
      },
    });
  });
});
