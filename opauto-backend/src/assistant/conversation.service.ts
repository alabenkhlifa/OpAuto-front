import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantMessageRole } from './types';

/**
 * Stub. Phase 1 Subagent F fills in: create/load conversations, append
 * messages, sliding-window history retrieval, title generation after first
 * turn, and soft delete / clear semantics.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(garageId: string, userId: string, conversationId?: string) {
    if (conversationId) {
      const existing = await this.prisma.assistantConversation.findFirst({
        where: { id: conversationId, garageId, userId, archivedAt: null },
      });
      if (existing) return existing;
    }
    return this.prisma.assistantConversation.create({
      data: { garageId, userId },
    });
  }

  async appendMessage(args: {
    conversationId: string;
    role: AssistantMessageRole;
    content: string;
    toolCallId?: string;
    skillUsed?: string;
    agentUsed?: string;
    tokensIn?: number;
    tokensOut?: number;
    llmProvider?: string;
  }) {
    return this.prisma.assistantMessage.create({
      data: {
        conversationId: args.conversationId,
        role: args.role,
        content: args.content,
        toolCallId: args.toolCallId,
        skillUsed: args.skillUsed,
        agentUsed: args.agentUsed,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
        llmProvider: args.llmProvider,
      },
    });
  }

  async getRecentHistory(conversationId: string, _limit = 20) {
    this.logger.debug(`getRecentHistory(${conversationId}) — stub returning empty window`);
    return [];
  }

  async listForUser(garageId: string, userId: string, limit = 20) {
    return this.prisma.assistantConversation.findMany({
      where: { garageId, userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, pinned: true, updatedAt: true, createdAt: true },
    });
  }

  async getById(id: string, garageId: string, userId: string) {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return conv;
  }

  async softDelete(id: string, garageId: string, userId: string) {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
    });
    if (!conv) return { archived: false };
    await this.prisma.assistantConversation.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { archived: true };
  }

  async clearMessages(id: string, garageId: string, userId: string) {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
    });
    if (!conv) return { cleared: 0 };
    const result = await this.prisma.assistantMessage.deleteMany({
      where: { conversationId: id },
    });
    return { cleared: result.count };
  }
}
