import { Injectable, Logger } from '@nestjs/common';

/**
 * Stub. Phase 1 Subagent E implements deferred-turn approval state machine,
 * expiry job (5-min TTL), and resumption when the user approves/denies.
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  async createPending(_args: {
    conversationId: string;
    toolCallId: string;
    toolName: string;
    blastTier: string;
    args: unknown;
  }): Promise<{ expiresAt: Date }> {
    this.logger.warn('ApprovalService.createPending called on stub');
    return { expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
  }

  async decide(
    _toolCallId: string,
    _decision: 'approve' | 'deny',
    _userId: string,
    _typedConfirmation?: string,
  ): Promise<{ approved: boolean }> {
    this.logger.warn('ApprovalService.decide called on stub');
    return { approved: false };
  }

  async expireOverdue(): Promise<number> {
    return 0;
  }
}
