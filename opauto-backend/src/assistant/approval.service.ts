import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AssistantBlastTier,
  AssistantToolCallStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const APPROVAL_TTL_MS = 5 * 60 * 1000;

type CreatePendingArgs = {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  blastTier: string;
  args: unknown;
};

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPending(args: CreatePendingArgs): Promise<{ expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
    const blastTier = this.parseBlastTier(args.blastTier);

    await this.prisma.assistantToolCall.create({
      data: {
        id: args.toolCallId,
        conversationId: args.conversationId,
        toolName: args.toolName,
        argsJson: this.toJsonInput(args.args),
        status: AssistantToolCallStatus.PENDING_APPROVAL,
        blastTier,
        expiresAt,
      },
    });

    return { expiresAt };
  }

  async decide(
    toolCallId: string,
    decision: 'approve' | 'deny',
    userId: string,
    garageId: string,
    typedConfirmation?: string,
  ): Promise<{ approved: boolean }> {
    const row = await this.prisma.assistantToolCall.findUnique({
      where: { id: toolCallId },
      include: { conversation: { select: { garageId: true } } },
    });
    if (!row) {
      throw new NotFoundException('approval not found');
    }

    if (row.conversation.garageId !== garageId) {
      throw new ForbiddenException('approval does not belong to this garage');
    }

    if (row.status !== AssistantToolCallStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `approval already ${row.status.toLowerCase()}`,
      );
    }

    const now = new Date();
    if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) {
      await this.prisma.assistantToolCall.update({
        where: { id: toolCallId },
        data: { status: AssistantToolCallStatus.EXPIRED },
      });
      throw new GoneException('approval expired');
    }

    if (decision === 'deny') {
      await this.prisma.assistantToolCall.update({
        where: { id: toolCallId },
        data: {
          status: AssistantToolCallStatus.DENIED,
          approvedByUserId: userId,
          approvedAt: now,
        },
      });
      this.logger.log(`approval ${toolCallId} denied by ${userId}`);
      return { approved: false };
    }

    if (row.blastTier === AssistantBlastTier.TYPED_CONFIRM_WRITE) {
      const expected = this.extractExpectedConfirmation(row.argsJson);
      if (!expected) {
        throw new BadRequestException(
          'typed confirmation required but not configured',
        );
      }
      const provided = (typedConfirmation ?? '').trim();
      if (provided !== expected.trim()) {
        throw new BadRequestException('typed confirmation does not match');
      }
    }

    await this.prisma.assistantToolCall.update({
      where: { id: toolCallId },
      data: {
        status: AssistantToolCallStatus.APPROVED,
        approvedByUserId: userId,
        approvedAt: now,
      },
    });
    this.logger.log(`approval ${toolCallId} approved by ${userId}`);
    return { approved: true };
  }

  async expireOverdue(): Promise<number> {
    const result = await this.prisma.assistantToolCall.updateMany({
      where: {
        status: AssistantToolCallStatus.PENDING_APPROVAL,
        expiresAt: { lt: new Date() },
      },
      data: { status: AssistantToolCallStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`expired ${result.count} stale approvals`);
    }
    return result.count;
  }

  private parseBlastTier(raw: string): AssistantBlastTier {
    const normalized = raw.toUpperCase() as AssistantBlastTier;
    if (
      normalized !== AssistantBlastTier.READ &&
      normalized !== AssistantBlastTier.AUTO_WRITE &&
      normalized !== AssistantBlastTier.CONFIRM_WRITE &&
      normalized !== AssistantBlastTier.TYPED_CONFIRM_WRITE
    ) {
      throw new BadRequestException(`unknown blast tier: ${raw}`);
    }
    return normalized;
  }

  private extractExpectedConfirmation(argsJson: Prisma.JsonValue): string | null {
    if (
      argsJson &&
      typeof argsJson === 'object' &&
      !Array.isArray(argsJson)
    ) {
      const value = (argsJson as Record<string, unknown>)._expectedConfirmation;
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return null;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue {
    // Prisma's InputJsonValue forbids `undefined`; replace with null at the top level.
    if (value === undefined) return null as unknown as Prisma.InputJsonValue;
    return value as Prisma.InputJsonValue;
  }
}
