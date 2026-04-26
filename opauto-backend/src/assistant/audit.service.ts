import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantBlastTier, AssistantToolCallStatus } from './types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logToolCall(args: {
    conversationId: string;
    messageId?: string;
    toolName: string;
    argsJson: unknown;
    resultJson?: unknown;
    status: AssistantToolCallStatus;
    blastTier: AssistantBlastTier;
    approvedByUserId?: string;
    approvedAt?: Date;
    expiresAt?: Date;
    errorMessage?: string;
    durationMs?: number;
  }) {
    return this.prisma.assistantToolCall.create({
      data: {
        conversationId: args.conversationId,
        messageId: args.messageId ?? null,
        toolName: args.toolName,
        argsJson: args.argsJson as object,
        resultJson: (args.resultJson ?? null) as object | null,
        status: args.status,
        blastTier: args.blastTier,
        approvedByUserId: args.approvedByUserId,
        approvedAt: args.approvedAt,
        expiresAt: args.expiresAt,
        errorMessage: args.errorMessage,
        durationMs: args.durationMs,
      },
    });
  }
}
