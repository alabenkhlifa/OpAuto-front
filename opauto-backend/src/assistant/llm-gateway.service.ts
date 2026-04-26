import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionRequest, LlmCompletionResult } from './types';

/**
 * Stub. Phase 1 Subagent A replaces this with Groq-first / Claude-fallback
 * tool-calling-aware completion that wraps the existing AiService provider chain.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.logger.warn('LlmGatewayService.complete called on stub — Phase 1 not implemented');
    return {
      provider: 'mock',
      content: 'The assistant is not yet wired up. Phase 1 implementation pending.',
      toolCalls: [],
    };
  }
}
