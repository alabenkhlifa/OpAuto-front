import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmUsageContext } from './types';
import { estimateLlmCost } from './llm-usage-pricing';

type LlmUsageStatus = 'SUCCESS' | 'FAILED' | 'REJECTED' | 'MOCK';

export interface RecordLlmUsageInput {
  provider: string;
  model?: string;
  purpose?: string;
  status: LlmUsageStatus;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  context?: LlmUsageContext;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LlmUsageRecorderService {
  private readonly logger = new Logger(LlmUsageRecorderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordLlmUsageInput): Promise<void> {
    try {
      const cost = estimateLlmCost({
        provider: input.provider,
        model: input.model,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
      });
      const metadata = input.metadata ?? input.context?.metadata;

      await this.prisma.llmUsageEvent.create({
        data: {
          provider: input.provider,
          model: input.model,
          purpose: input.purpose,
          status: input.status,
          tokensIn: input.tokensIn,
          tokensOut: input.tokensOut,
          latencyMs: input.latencyMs,
          estimatedCost: cost.estimatedCost,
          priced: cost.priced,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          conversationId: input.context?.conversationId,
          garageId: input.context?.garageId,
          userId: input.context?.userId,
          assistantMessageId: input.context?.assistantMessageId,
          toolCallId: input.context?.toolCallId,
          toolName: input.context?.toolName,
          metadata:
            metadata === undefined
              ? undefined
              : (metadata as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to record LLM usage event: ${message}`);
    }
  }
}
