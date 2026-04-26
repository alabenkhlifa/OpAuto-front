import { Injectable, Logger } from '@nestjs/common';
import { AssistantConversation, AssistantMessage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantMessageRole } from './types';

const TITLE_MAX_LENGTH = 60;
const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_LIST_LIMIT = 20;

export interface AppendMessageArgs {
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  toolCallId?: string;
  skillUsed?: string;
  agentUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  llmProvider?: string;
}

export interface RecentHistoryEntry {
  id: string;
  role: AssistantMessageRole;
  content: string;
  toolCallId: string | null;
  createdAt: Date;
}

export type Summarizer = (text: string) => Promise<string>;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(
    garageId: string,
    userId: string,
    conversationId?: string,
  ): Promise<AssistantConversation> {
    if (conversationId) {
      // Multi-tenancy: only return the conversation when it belongs to this
      // garage AND user. A foreign id falls through to creating a brand-new
      // conversation, never reveals the foreign row.
      const existing = await this.prisma.assistantConversation.findFirst({
        where: { id: conversationId, garageId, userId, archivedAt: null },
      });
      if (existing) return existing;
    }
    return this.prisma.assistantConversation.create({
      data: { garageId, userId },
    });
  }

  async appendMessage(args: AppendMessageArgs): Promise<AssistantMessage> {
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

  /**
   * Returns the last `limit` messages in chronological order (oldest first).
   *
   * NOTE: this method is called only by the orchestrator on conversations it
   * has already authorised via `getOrCreate`, so it intentionally does NOT
   * accept garageId/userId. Callers from outside the orchestrator MUST verify
   * tenancy before invoking this method.
   */
  async getRecentHistory(
    conversationId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<RecentHistoryEntry[]> {
    const safeLimit = Math.max(1, limit);
    const rows = await this.prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        role: true,
        content: true,
        toolCallId: true,
        createdAt: true,
      },
    });
    // findMany returned newest-first; reverse to chronological for the LLM.
    return rows.reverse();
  }

  async listForUser(
    garageId: string,
    userId: string,
    limit = DEFAULT_LIST_LIMIT,
  ) {
    return this.prisma.assistantConversation.findMany({
      where: { garageId, userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, pinned: true, updatedAt: true, createdAt: true },
    });
  }

  async getById(id: string, garageId: string, userId: string) {
    return this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async softDelete(
    id: string,
    garageId: string,
    userId: string,
  ): Promise<{ archived: boolean }> {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
      select: { id: true },
    });
    if (!conv) return { archived: false };
    await this.prisma.assistantConversation.update({
      where: { id: conv.id },
      data: { archivedAt: new Date() },
    });
    return { archived: true };
  }

  async clearMessages(
    id: string,
    garageId: string,
    userId: string,
  ): Promise<{ cleared: number }> {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id, garageId, userId, archivedAt: null },
      select: { id: true },
    });
    if (!conv) return { cleared: 0 };
    const result = await this.prisma.assistantMessage.deleteMany({
      where: { conversationId: conv.id },
    });
    return { cleared: result.count };
  }

  /**
   * Generates a short title from the conversation's first user message using
   * the supplied summarizer. The summarizer is injected so this service stays
   * free of LLM dependencies — the orchestrator chooses how to summarise.
   *
   * Idempotent: returns the existing title without re-summarising. Returns
   * null if there is no user message yet, or if the summarizer throws (this
   * is a non-critical enhancement and must never break the chat flow).
   */
  async generateTitleFromFirstMessage(
    conversationId: string,
    summarizer: Summarizer,
  ): Promise<string | null> {
    const conv = await this.prisma.assistantConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true },
    });
    if (!conv) return null;
    if (conv.title && conv.title.trim().length > 0) return conv.title;

    const firstUserMessage = await this.prisma.assistantMessage.findFirst({
      where: { conversationId, role: AssistantMessageRole.USER },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });
    if (!firstUserMessage || !firstUserMessage.content?.trim()) return null;

    let summary: string;
    try {
      summary = await summarizer(firstUserMessage.content);
    } catch (err) {
      this.logger.warn(
        `Title summarizer failed for conversation ${conversationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }

    const title = this.normaliseTitle(summary);
    if (!title) return null;

    try {
      await this.prisma.assistantConversation.update({
        where: { id: conversationId },
        data: { title },
      });
    } catch (err) {
      // Highly unlikely (FK to Conversation just verified above), but stay
      // resilient for the same reason as the summarizer guard.
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.warn(
          `Failed to persist title for conversation ${conversationId}: ${err.code}`,
        );
        return null;
      }
      throw err;
    }
    return title;
  }

  private normaliseTitle(raw: string): string | null {
    const cleaned = raw
      .replace(/[\r\n]+/g, ' ')
      .replace(/^["'`\s]+|["'`\s]+$/g, '')
      .trim();
    if (!cleaned) return null;
    if (cleaned.length <= TITLE_MAX_LENGTH) return cleaned;
    return `${cleaned.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
  }
}
