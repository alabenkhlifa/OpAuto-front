import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AssistantUserContext, PageContext, SseEvent } from './types';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';

/**
 * Stub. Phase 1 Subagent A implements the full per-turn LLM loop:
 * build system prompt → call LLM → handle tool_call / load_skill / dispatch_agent
 * → loop with iteration cap → stream SSE events → persist messages.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly conversation: ConversationService,
    private readonly llm: LlmGatewayService,
    private readonly tools: ToolRegistryService,
    private readonly skills: SkillRegistryService,
    private readonly agents: AgentRunnerService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  run(
    _ctx: AssistantUserContext,
    _conversationId: string,
    _userMessage: string,
    _pageContext: PageContext | undefined,
  ): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();
    queueMicrotask(() => {
      subject.next({
        type: 'text',
        delta:
          'The OpAuto assistant orchestrator is not yet implemented. Phase 1 (subagents A–F) will replace this stub.',
      });
      subject.next({ type: 'done' });
      subject.complete();
    });
    return subject.asObservable();
  }
}
