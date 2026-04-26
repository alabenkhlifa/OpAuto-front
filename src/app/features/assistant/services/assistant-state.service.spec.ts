import { TestBed } from '@angular/core/testing';
import { AssistantStateService } from './assistant-state.service';
import {
  AssistantPendingApproval,
  AssistantUiMessage,
} from '../../../core/models/assistant.model';

describe('AssistantStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AssistantStateService] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createService(): AssistantStateService {
    return TestBed.inject(AssistantStateService);
  }

  it('initializes with closed panel and empty state', () => {
    const svc = createService();
    expect(svc.panelState()).toBe('closed');
    expect(svc.currentConversationId()).toBeNull();
    expect(svc.messages()).toEqual([]);
    expect(svc.pendingApproval()).toBeNull();
    expect(svc.isStreaming()).toBeFalse();
    expect(svc.error()).toBeNull();
  });

  describe('panel lifecycle', () => {
    it('open / close / toggle update panelState', () => {
      const svc = createService();
      svc.openPanel();
      expect(svc.panelState()).toBe('open');
      svc.closePanel();
      expect(svc.panelState()).toBe('closed');
      svc.togglePanel();
      expect(svc.panelState()).toBe('open');
      svc.togglePanel();
      expect(svc.panelState()).toBe('closed');
    });

    it('persists panelState to localStorage', () => {
      const svc = createService();
      svc.openPanel();
      TestBed.flushEffects();
      expect(localStorage.getItem('assistant.panelState')).toBe('open');
    });

    it('restores panelState from localStorage on init', () => {
      localStorage.setItem('assistant.panelState', 'open');
      const svc = createService();
      expect(svc.panelState()).toBe('open');
    });
  });

  describe('conversation id persistence', () => {
    it('persists conversation id', () => {
      const svc = createService();
      svc.setConversationId('conv-123');
      TestBed.flushEffects();
      expect(localStorage.getItem('assistant.currentConversationId')).toBe('conv-123');
    });

    it('clears the persisted id when set to null', () => {
      localStorage.setItem('assistant.currentConversationId', 'old');
      const svc = createService();
      svc.setConversationId(null);
      TestBed.flushEffects();
      expect(localStorage.getItem('assistant.currentConversationId')).toBeNull();
    });

    it('restores conversation id from localStorage on init', () => {
      localStorage.setItem('assistant.currentConversationId', 'restored');
      const svc = createService();
      expect(svc.currentConversationId()).toBe('restored');
    });
  });

  describe('messages', () => {
    const baseMsg: AssistantUiMessage = {
      id: 'm1',
      conversationId: 'c1',
      role: 'USER',
      content: 'hello',
      createdAt: new Date().toISOString(),
    };

    it('setMessages replaces the list', () => {
      const svc = createService();
      svc.setMessages([baseMsg]);
      expect(svc.messages().length).toBe(1);
      expect(svc.messages()[0].content).toBe('hello');
    });

    it('appendMessage appends', () => {
      const svc = createService();
      svc.setMessages([baseMsg]);
      svc.appendMessage({ ...baseMsg, id: 'm2', content: 'world' });
      expect(svc.messages().length).toBe(2);
      expect(svc.messages()[1].content).toBe('world');
    });

    it('appendStreamingDelta creates a placeholder when no streaming msg exists', () => {
      const svc = createService();
      svc.appendStreamingDelta('Hi');
      expect(svc.messages().length).toBe(1);
      const m = svc.messages()[0];
      expect(m.role).toBe('ASSISTANT');
      expect(m.content).toBe('Hi');
      expect(m.isStreaming).toBeTrue();
    });

    it('appendStreamingDelta appends to last streaming message', () => {
      const svc = createService();
      svc.appendStreamingDelta('Hello');
      svc.appendStreamingDelta(' world');
      expect(svc.messages().length).toBe(1);
      expect(svc.messages()[0].content).toBe('Hello world');
    });

    it('appendStreamingDelta starts a new bubble after a non-streaming user message', () => {
      const svc = createService();
      svc.appendMessage(baseMsg);
      svc.appendStreamingDelta('reply');
      expect(svc.messages().length).toBe(2);
      expect(svc.messages()[1].role).toBe('ASSISTANT');
      expect(svc.messages()[1].isStreaming).toBeTrue();
    });

    it('appendStreamingDelta ignores empty deltas', () => {
      const svc = createService();
      svc.appendStreamingDelta('');
      expect(svc.messages()).toEqual([]);
    });

    it('finalizeStreamingMessage clears the streaming flag', () => {
      const svc = createService();
      svc.appendStreamingDelta('hi');
      svc.finalizeStreamingMessage('server-id');
      const last = svc.messages()[0];
      expect(last.isStreaming).toBeFalse();
      expect(last.id).toBe('server-id');
    });
  });

  describe('pending approval', () => {
    const approval: AssistantPendingApproval = {
      toolCallId: 'tc-1',
      toolName: 'send_sms',
      args: { phone: '+1' },
      blastTier: 'CONFIRM_WRITE',
      expiresAt: new Date().toISOString(),
      receivedAt: Date.now(),
    };

    it('set / clear pending approval', () => {
      const svc = createService();
      svc.setPendingApproval(approval);
      expect(svc.pendingApproval()).toEqual(approval);
      expect(svc.hasPendingApproval()).toBeTrue();
      svc.clearPendingApproval();
      expect(svc.pendingApproval()).toBeNull();
      expect(svc.hasPendingApproval()).toBeFalse();
    });

    it('reset() clears pending approval', () => {
      const svc = createService();
      svc.setPendingApproval(approval);
      svc.reset();
      expect(svc.pendingApproval()).toBeNull();
    });
  });

  describe('streaming and error', () => {
    it('startStreaming sets streaming true and clears error', () => {
      const svc = createService();
      svc.setError('boom');
      svc.startStreaming();
      expect(svc.isStreaming()).toBeTrue();
      expect(svc.error()).toBeNull();
    });

    it('stopStreaming sets streaming false', () => {
      const svc = createService();
      svc.startStreaming();
      svc.stopStreaming();
      expect(svc.isStreaming()).toBeFalse();
    });
  });

  describe('reset', () => {
    it('reset clears messages, approvals, error, streaming, conversation id', () => {
      const svc = createService();
      svc.setConversationId('c1');
      svc.appendMessage({
        id: 'm',
        conversationId: 'c1',
        role: 'USER',
        content: 'hi',
        createdAt: new Date().toISOString(),
      });
      svc.startStreaming();
      svc.setError('err');
      svc.setPendingApproval({
        toolCallId: 'tc',
        toolName: 't',
        args: {},
        blastTier: 'READ',
        expiresAt: new Date().toISOString(),
        receivedAt: Date.now(),
      });

      svc.reset();
      expect(svc.messages()).toEqual([]);
      expect(svc.pendingApproval()).toBeNull();
      expect(svc.isStreaming()).toBeFalse();
      expect(svc.error()).toBeNull();
      expect(svc.currentConversationId()).toBeNull();
    });
  });
});
