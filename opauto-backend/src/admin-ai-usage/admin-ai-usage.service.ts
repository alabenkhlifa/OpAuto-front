import { Injectable } from '@nestjs/common';
import { AssistantMessageRole, AssistantToolCallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageRangeKey } from './dto/admin-ai-usage-query.dto';

type OvhRangeWindow = {
  key: AiUsageRangeKey;
  label: string;
  start: Date;
  end: Date;
};

type OvhUsageSummary = {
  assistantMessages: number;
  ovhMessagesPriced: number;
  ovhMessagesUnpriced: number;
  toolCalls: number;
  uniqueUsers: number;
  tokensIn: number;
  tokensOut: number;
  tokensMissing: number;
  estimatedCost: number;
  rowsWithMissingPurpose: number;
  rowsWithMissingModel: number;
};

type OvhTaskUsageRow = {
  purpose: string;
  model: string | null;
  calls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  unpricedCalls: number;
};

type OvhAgentUsageRow = {
  agent: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
};

type OvhSkillUsageRow = {
  skill: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
};

type OvhUserUsageRow = {
  userId: string;
  userName: string;
  calls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
};

type OvhGarageUsageRow = {
  garageId: string;
  garageName: string;
  garageLocation: string | null;
  calls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  uniqueUsers: number;
};

type OvhToolUsageRow = {
  toolName: string;
  calls: number;
  failed: number;
  approved: number;
  denied: number;
  expired: number;
  pending: number;
  executed: number;
  avgDurationMs: number | null;
  durationSamples: number;
  tierBreakdown: {
    READ: number;
    AUTO_WRITE: number;
    CONFIRM_WRITE: number;
    TYPED_CONFIRM_WRITE: number;
    UNKNOWN: number;
  };
};

type OvhTopExpensiveCall = {
  messageId: string;
  conversationId: string;
  userId: string;
  userName: string;
  createdAt: string;
  purpose: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  priced: boolean;
};

type OvhApprovalBreakdownRow = {
  status: string;
  calls: number;
  share: number;
  avgDecisionSeconds: number;
};

type OvhUsageResponse = {
  generatedAt: string;
  range: {
    key: AiUsageRangeKey;
    label: string;
    start: string;
    end: string;
    scope: 'ovh-only';
  };
  summary: OvhUsageSummary;
  taskUsage: OvhTaskUsageRow[];
  agentUsage: OvhAgentUsageRow[];
  skillUsage: OvhSkillUsageRow[];
  userUsage: OvhUserUsageRow[];
  garageUsage: OvhGarageUsageRow[];
  toolUsage: OvhToolUsageRow[];
  approvalRefusal: {
    totalToolCalls: number;
    approvalRequired: number;
    approvedOrExecuted: number;
    denied: number;
    expired: number;
    pending: number;
    rows: OvhApprovalBreakdownRow[];
  };
  topExpensiveCalls: OvhTopExpensiveCall[];
  sourceCoverage: {
    dataSource: 'persisted_tables_only';
    includesGatewayOnlySignals: {
      classifierCalls: false;
      conversationTitles: false;
      rawGatewayLatency: false;
    };
    rowCoverage: {
      assistantMessagesScanned: number;
      assistantToolCallsScanned: number;
      messagesWithoutModel: number;
      messagesWithoutPurpose: number;
      messagesWithoutTokens: number;
    };
  };
};

type UserProfile = {
  userId: string;
  userName: string;
};

type MessageRow = {
  id: string;
  conversationId: string;
  toolCallId: string | null;
  content: string;
  role: AssistantMessageRole;
  tokensIn: number | null;
  tokensOut: number | null;
  llmProvider: string | null;
  llmModel: string | null;
  llmPurpose: string | null;
  skillUsed: string | null;
  createdAt: Date;
  conversation: {
    userId: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
    garage: {
      id: string;
      name: string;
      address: string | null;
    };
  };
  emittedToolCalls?: {
    id: string;
    toolName: string;
    createdAt: Date;
  }[];
};

type ToolCallRow = {
  id: string;
  conversationId: string;
  messageId: string | null;
  toolName: string;
  status: AssistantToolCallStatus;
  blastTier: string;
  durationMs: number | null;
  approvedAt: Date | null;
  createdAt: Date;
  conversation: {
    userId: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
    garage: {
      id: string;
      name: string;
      address: string | null;
    };
  };
  emitter: {
    llmPurpose: string | null;
    llmModel: string | null;
  } | null;
};

const MILLION = 1_000_000;
const ASSISTANT_TOOL_SELECTION_PURPOSE = 'assistant_tool_selection';
const ASSISTANT_COMPOSE_PURPOSE = 'assistant_compose';
const OVH_PRICING = {
  LLAMA: {
    matcher: /(meta[-_]llama|llama)/i,
    inputRate: 0.74,
    outputRate: 0.74,
  },
  MISTRAL: {
    matcher: /mistral/i,
    inputRate: 0.1,
    outputRate: 0,
  },
};

const DEFAULT_AGENT_PREFIX = 'agent_runner:';

function taskGroupKey(purpose: string, model: string | null): string {
  return `${purpose}::${model ?? 'unknown-model'}`;
}

function shouldScopePurposeToTool(purpose: string): boolean {
  return (
    purpose === ASSISTANT_TOOL_SELECTION_PURPOSE ||
    purpose === ASSISTANT_COMPOSE_PURPOSE
  );
}

function toolScopedPurpose(purpose: string, toolName: string): string {
  return `${purpose}:${toolName}`;
}

function addToMap<K extends string, V>(map: Map<K, V>, key: K, seed: () => V) {
  if (!map.has(key)) map.set(key, seed());
  return map.get(key) as V;
}

function addToList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const current = map.get(key);
  if (current) {
    current.push(value);
    return;
  }
  map.set(key, [value]);
}

function userNameFromRecord(row: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const first = row.firstName?.trim() ?? '';
  const last = row.lastName?.trim() ?? '';
  if ((first + last).trim().length > 0) {
    return `${first} ${last}`.trim();
  }
  return row.email?.trim() || 'Unknown user';
}

function garageNameFromRecord(row: { name: string | null }): string {
  return row.name?.trim() || 'Unknown garage';
}

function getOvhPricing(model: string | null | undefined) {
  if (!model) return null;
  if (OVH_PRICING.MISTRAL.matcher.test(model)) {
    return OVH_PRICING.MISTRAL;
  }
  if (OVH_PRICING.LLAMA.matcher.test(model)) {
    return OVH_PRICING.LLAMA;
  }
  return null;
}

function firstToolName(
  rows: readonly { toolName: string; createdAt: Date }[] | undefined,
): string | null {
  const row = rows?.find((item) => item.toolName.trim().length > 0);
  return row?.toolName.trim() || null;
}

function relatedToolNameForMessage(
  message: MessageRow,
  rawPurpose: string,
  boundaries: { previous?: Date; next?: Date } | undefined,
  toolCallsByConversation: Map<string, ToolCallRow[]>,
  toolCallsByMessageId: Map<string, ToolCallRow[]>,
): string | null {
  const emittedTool = firstToolName(message.emittedToolCalls);
  if (emittedTool) {
    return emittedTool;
  }

  const directTool = firstToolName(toolCallsByMessageId.get(message.id));
  if (directTool) {
    return directTool;
  }

  if (!shouldScopePurposeToTool(rawPurpose)) {
    return null;
  }

  const conversationToolCalls =
    toolCallsByConversation.get(message.conversationId) ?? [];
  if (conversationToolCalls.length === 0) {
    return null;
  }

  const currentTime = message.createdAt.getTime();
  const previousTime = boundaries?.previous?.getTime();
  const nextTime = boundaries?.next?.getTime();

  if (rawPurpose === ASSISTANT_TOOL_SELECTION_PURPOSE) {
    const toolCall = conversationToolCalls.find((row) => {
      const toolTime = row.createdAt.getTime();
      return (
        toolTime >= currentTime &&
        (nextTime === undefined || toolTime < nextTime)
      );
    });
    return toolCall?.toolName.trim() || null;
  }

  const priorToolCalls = conversationToolCalls.filter((row) => {
    const toolTime = row.createdAt.getTime();
    return (
      toolTime <= currentTime &&
      (previousTime === undefined || toolTime > previousTime)
    );
  });
  return firstToolName([...priorToolCalls].reverse());
}

function startOfUtcDay(base: Date): Date {
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function makeRangeLabel(key: AiUsageRangeKey): string {
  switch (key) {
    case AiUsageRangeKey.TODAY:
      return 'Today';
    case AiUsageRangeKey.YESTERDAY:
      return 'Yesterday';
    case AiUsageRangeKey.LAST_WEEK:
      return 'Last week';
    case AiUsageRangeKey.THIS_MONTH:
      return 'This month';
    case AiUsageRangeKey.LAST_MONTH:
      return 'Last month';
    case AiUsageRangeKey.THIS_QUARTER:
      return 'This quarter';
    case AiUsageRangeKey.LAST_QUARTER:
      return 'Last quarter';
    case AiUsageRangeKey.THIS_YEAR:
      return 'This year';
    case AiUsageRangeKey.LAST_YEAR:
      return 'Last year';
    default:
      return String(key);
  }
}

function getQuarterStartUtc(base: Date, quarterIndex: number): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), quarterIndex * 3, 1, 0, 0, 0, 0),
  );
}

function resolveRangeWindow(
  range: AiUsageRangeKey,
  now = new Date(),
): OvhRangeWindow {
  const startOfToday = startOfUtcDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);

  if (range === AiUsageRangeKey.TODAY) {
    return {
      key: range,
      label: makeRangeLabel(range),
      start: startOfToday,
      end: startOfTomorrow,
    };
  }

  if (range === AiUsageRangeKey.YESTERDAY) {
    return {
      key: range,
      label: makeRangeLabel(range),
      start: addDays(startOfToday, -1),
      end: startOfToday,
    };
  }

  if (range === AiUsageRangeKey.LAST_WEEK) {
    const day = startOfToday.getUTCDay(); // 0=Sun, 6=Sat
    const daysSinceMonday = (day + 6) % 7;
    const mondayThisWeek = addDays(startOfToday, -daysSinceMonday);
    return {
      key: range,
      label: makeRangeLabel(range),
      start: addDays(mondayThisWeek, -7),
      end: mondayThisWeek,
    };
  }

  if (range === AiUsageRangeKey.THIS_MONTH) {
    return {
      key: range,
      label: makeRangeLabel(range),
      start: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
      ),
      end: new Date(
        Date.UTC(
          now.getUTCMonth() === 11
            ? now.getUTCFullYear() + 1
            : now.getUTCFullYear(),
          (now.getUTCMonth() + 1) % 12,
          1,
          0,
          0,
          0,
          0,
        ),
      ),
    };
  }

  if (range === AiUsageRangeKey.LAST_MONTH) {
    const thisMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const lastMonthStart = new Date(
      Date.UTC(
        now.getUTCMonth() === 0
          ? now.getUTCFullYear() - 1
          : now.getUTCFullYear(),
        now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1,
        1,
        0,
        0,
        0,
        0,
      ),
    );
    return {
      key: range,
      label: makeRangeLabel(range),
      start: lastMonthStart,
      end: thisMonthStart,
    };
  }

  if (range === AiUsageRangeKey.THIS_QUARTER) {
    const quarter = Math.floor(now.getUTCMonth() / 3);
    return {
      key: range,
      label: makeRangeLabel(range),
      start: getQuarterStartUtc(now, quarter),
      end: getQuarterStartUtc(now, quarter + 1),
    };
  }

  if (range === AiUsageRangeKey.LAST_QUARTER) {
    const quarter = Math.floor(now.getUTCMonth() / 3);
    const targetQuarter = quarter - 1;
    const startYear =
      targetQuarter < 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const normalizedQuarter = ((targetQuarter % 4) + 4) % 4;
    const startBase = new Date(
      Date.UTC(startYear, normalizedQuarter * 3, 1, 0, 0, 0, 0),
    );
    const endBase =
      targetQuarter < 0
        ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
        : getQuarterStartUtc(now, quarter);
    return {
      key: range,
      label: makeRangeLabel(range),
      start: startBase,
      end: endBase,
    };
  }

  if (range === AiUsageRangeKey.THIS_YEAR) {
    return {
      key: range,
      label: makeRangeLabel(range),
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0)),
    };
  }

  // LAST_YEAR
  return {
    key: range,
    label: makeRangeLabel(range),
    start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
  };
}

@Injectable()
export class AdminAiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getOvhUsage(
    garageId: string,
    range: AiUsageRangeKey,
  ): Promise<OvhUsageResponse> {
    const window = resolveRangeWindow(range);
    const whereBase = {
      createdAt: { gte: window.start, lt: window.end },
      llmProvider: 'ovh',
      role: AssistantMessageRole.ASSISTANT,
      conversation: { garageId },
    } as const;

    const messages = (await this.prisma.assistantMessage.findMany({
      where: whereBase,
      orderBy: { createdAt: 'asc' },
      include: {
        conversation: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            garage: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        emittedToolCalls: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            toolName: true,
            createdAt: true,
          },
        },
      },
    })) as MessageRow[];

    const whereToolCalls = {
      createdAt: { gte: window.start, lt: window.end },
      conversation: { garageId },
    } as const;
    const toolCalls = (await this.prisma.assistantToolCall.findMany({
      where: whereToolCalls,
      orderBy: { createdAt: 'asc' },
      include: {
        conversation: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            garage: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        emitter: {
          select: {
            llmPurpose: true,
            llmModel: true,
          },
        },
      },
    })) as ToolCallRow[];

    const toolCallsByConversation = new Map<string, ToolCallRow[]>();
    const toolCallsByMessageId = new Map<string, ToolCallRow[]>();
    for (const toolCall of toolCalls) {
      addToList(toolCallsByConversation, toolCall.conversationId, toolCall);
      if (toolCall.messageId) {
        addToList(toolCallsByMessageId, toolCall.messageId, toolCall);
      }
    }

    const messagesByConversation = new Map<string, MessageRow[]>();
    for (const message of messages) {
      addToList(messagesByConversation, message.conversationId, message);
    }
    const messageBoundariesById = new Map<
      string,
      { previous?: Date; next?: Date }
    >();
    for (const conversationMessages of messagesByConversation.values()) {
      const sorted = [...conversationMessages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      sorted.forEach((message, index) => {
        messageBoundariesById.set(message.id, {
          previous: sorted[index - 1]?.createdAt,
          next: sorted[index + 1]?.createdAt,
        });
      });
    }

    const summary: OvhUsageSummary = {
      assistantMessages: 0,
      ovhMessagesPriced: 0,
      ovhMessagesUnpriced: 0,
      toolCalls: 0,
      uniqueUsers: 0,
      tokensIn: 0,
      tokensOut: 0,
      tokensMissing: 0,
      estimatedCost: 0,
      rowsWithMissingPurpose: 0,
      rowsWithMissingModel: 0,
    };

    const tasks = new Map<string, OvhTaskUsageRow>();
    const agents = new Map<string, OvhAgentUsageRow>();
    const skills = new Map<string, OvhSkillUsageRow>();
    const users = new Map<string, OvhUserUsageRow>();
    const garages = new Map<string, OvhGarageUsageRow>();

    const seenUsers = new Set<string>();
    const topCalls: OvhTopExpensiveCall[] = [];
    const purposeToolCounts = new Map<string, number>();
    const conversationUsers = new Map<string, UserProfile>();
    const toolCallTaskKeyById = new Map<string, string>();

    for (const msg of messages) {
      const userId = msg.conversation.userId;
      const userName = userNameFromRecord(msg.conversation.user);
      const garage = msg.conversation.garage;
      conversationUsers.set(msg.conversationId, { userId, userName });

      const tokensIn = msg.tokensIn ?? 0;
      const tokensOut = msg.tokensOut ?? 0;
      const hasTokenCoverage = msg.tokensIn !== null || msg.tokensOut !== null;
      const hasModel = Boolean(msg.llmModel && msg.llmModel.trim().length > 0);
      const rawPurpose = (msg.llmPurpose ?? 'unknown').trim() || 'unknown';
      const relatedToolName = relatedToolNameForMessage(
        msg,
        rawPurpose,
        messageBoundariesById.get(msg.id),
        toolCallsByConversation,
        toolCallsByMessageId,
      );
      const purpose =
        relatedToolName && shouldScopePurposeToTool(rawPurpose)
          ? toolScopedPurpose(rawPurpose, relatedToolName)
          : rawPurpose;
      const model = msg.llmModel?.trim() || null;
      const taskKey = taskGroupKey(purpose, model);

      seenUsers.add(userId);
      summary.assistantMessages += 1;
      summary.tokensIn += tokensIn;
      summary.tokensOut += tokensOut;
      if (!hasTokenCoverage) summary.tokensMissing += 1;
      if (!hasModel) summary.rowsWithMissingModel += 1;
      if (rawPurpose === 'unknown') summary.rowsWithMissingPurpose += 1;

      const pricing = getOvhPricing(model);
      const estimatedCost = pricing
        ? (tokensIn * pricing.inputRate + tokensOut * pricing.outputRate) /
          MILLION
        : 0;
      if (pricing) summary.ovhMessagesPriced += 1;
      if (!pricing) summary.ovhMessagesUnpriced += 1;
      summary.estimatedCost += estimatedCost;

      const task = addToMap(tasks, taskKey, () => ({
        purpose,
        model,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
        unpricedCalls: 0,
      }));
      task.calls += 1;
      task.tokensIn += tokensIn;
      task.tokensOut += tokensOut;
      task.estimatedCost += estimatedCost;
      if (!pricing) task.unpricedCalls += 1;

      if (purpose.startsWith(DEFAULT_AGENT_PREFIX)) {
        const agent = purpose.slice(DEFAULT_AGENT_PREFIX.length);
        const agentRow = addToMap(agents, agent, () => ({
          agent,
          calls: 0,
          tokensIn: 0,
          tokensOut: 0,
          estimatedCost: 0,
        }));
        agentRow.calls += 1;
        agentRow.tokensIn += tokensIn;
        agentRow.tokensOut += tokensOut;
        agentRow.estimatedCost += estimatedCost;
      }

      const userRow = addToMap(users, userId, () => ({
        userId,
        userName,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
      }));
      userRow.calls += 1;
      userRow.tokensIn += tokensIn;
      userRow.tokensOut += tokensOut;
      userRow.estimatedCost += estimatedCost;

      const garageRow = addToMap(garages, garageId, () => ({
        garageId,
        garageName: garageNameFromRecord(garage),
        garageLocation: garage.address,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
        uniqueUsers: 0,
      }));
      garageRow.calls += 1;
      garageRow.tokensIn += tokensIn;
      garageRow.tokensOut += tokensOut;
      garageRow.estimatedCost += estimatedCost;

      topCalls.push({
        messageId: msg.id,
        conversationId: msg.conversationId,
        userId,
        userName,
        createdAt: msg.createdAt.toISOString(),
        purpose,
        model,
        tokensIn,
        tokensOut,
        estimatedCost,
        priced: Boolean(pricing),
      });

      if (msg.toolCallId) {
        toolCallTaskKeyById.set(msg.toolCallId, taskKey);
      }
      if (relatedToolName && shouldScopePurposeToTool(rawPurpose)) {
        purposeToolCounts.set(
          taskKey,
          (purposeToolCounts.get(taskKey) ?? 0) + 1,
        );
      }

      const skill = msg.skillUsed?.trim() || 'direct_assistant';
      const skillRow = addToMap(skills, skill, () => ({
        skill,
        calls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
      }));
      skillRow.calls += 1;
      skillRow.tokensIn += tokensIn;
      skillRow.tokensOut += tokensOut;
      skillRow.estimatedCost += estimatedCost;
    }

    const toolRows = new Map<string, OvhToolUsageRow>();
    const approvalStatus = new Map<string, number>();
    const approvalDecisionMs = new Map<
      string,
      {
        totalMs: number;
        count: number;
      }
    >();
    let approvalRequired = 0;

    for (const tc of toolCalls) {
      summary.toolCalls += 1;

      const toolRow = addToMap(toolRows, tc.toolName, () => ({
        toolName: tc.toolName,
        calls: 0,
        failed: 0,
        approved: 0,
        denied: 0,
        expired: 0,
        pending: 0,
        executed: 0,
        avgDurationMs: null,
        durationSamples: 0,
        tierBreakdown: {
          READ: 0,
          AUTO_WRITE: 0,
          CONFIRM_WRITE: 0,
          TYPED_CONFIRM_WRITE: 0,
          UNKNOWN: 0,
        },
      }));
      toolRow.calls += 1;

      if (tc.durationMs !== null && tc.durationMs !== undefined) {
        const nextAvg =
          ((toolRow.avgDurationMs ?? 0) * toolRow.durationSamples +
            tc.durationMs) /
          (toolRow.durationSamples + 1);
        toolRow.avgDurationMs = Number(nextAvg.toFixed(2));
        toolRow.durationSamples += 1;
      }

      if (tc.blastTier === 'READ') toolRow.tierBreakdown.READ += 1;
      else if (tc.blastTier === 'AUTO_WRITE')
        toolRow.tierBreakdown.AUTO_WRITE += 1;
      else if (tc.blastTier === 'CONFIRM_WRITE')
        toolRow.tierBreakdown.CONFIRM_WRITE += 1;
      else if (tc.blastTier === 'TYPED_CONFIRM_WRITE')
        toolRow.tierBreakdown.TYPED_CONFIRM_WRITE += 1;
      else toolRow.tierBreakdown.UNKNOWN += 1;

      switch (tc.status) {
        case AssistantToolCallStatus.APPROVED:
          toolRow.approved += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          if (tc.approvedAt) {
            const previous = approvalDecisionMs.get(tc.status) ?? {
              totalMs: 0,
              count: 0,
            };
            previous.totalMs += Math.max(
              0,
              tc.approvedAt.getTime() - tc.createdAt.getTime(),
            );
            previous.count += 1;
            approvalDecisionMs.set(tc.status, previous);
          }
          approvalRequired += 1;
          break;
        case AssistantToolCallStatus.DENIED:
          toolRow.denied += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          if (tc.approvedAt) {
            const previous = approvalDecisionMs.get(tc.status) ?? {
              totalMs: 0,
              count: 0,
            };
            previous.totalMs += Math.max(
              0,
              tc.approvedAt.getTime() - tc.createdAt.getTime(),
            );
            previous.count += 1;
            approvalDecisionMs.set(tc.status, previous);
          }
          approvalRequired += 1;
          break;
        case AssistantToolCallStatus.PENDING_APPROVAL:
          toolRow.pending += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          approvalRequired += 1;
          break;
        case AssistantToolCallStatus.EXPIRED:
          toolRow.expired += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          break;
        case AssistantToolCallStatus.EXECUTED:
          toolRow.executed += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          break;
        case AssistantToolCallStatus.FAILED:
          toolRow.failed += 1;
          approvalStatus.set(
            tc.status,
            (approvalStatus.get(tc.status) ?? 0) + 1,
          );
          break;
        default:
          approvalStatus.set(
            tc.status as unknown as string,
            (approvalStatus.get(tc.status as unknown as string) ?? 0) + 1,
          );
      }

      const purpose = tc.emitter?.llmPurpose?.trim() || 'unknown';
      const model = tc.emitter?.llmModel?.trim() || null;
      const taskKey =
        purpose === 'unknown'
          ? toolCallTaskKeyById.get(tc.id)
          : shouldScopePurposeToTool(purpose)
            ? undefined
            : taskGroupKey(purpose, model);
      if (taskKey) {
        const taskToolCalls = purposeToolCounts.get(taskKey) ?? 0;
        purposeToolCounts.set(taskKey, taskToolCalls + 1);
      }

      const user = conversationUsers.get(tc.conversationId);
      if (!user) {
        const fallbackUserId = tc.conversation.userId;
        const fallbackUserName = userNameFromRecord(tc.conversation.user);
        conversationUsers.set(tc.conversationId, {
          userId: fallbackUserId,
          userName: fallbackUserName,
        });
      }
      seenUsers.add(tc.conversation.userId);
      if (tc.conversation.userId) {
        const ur = addToMap(users, tc.conversation.userId, () => ({
          userId: tc.conversation.userId,
          userName: userNameFromRecord(tc.conversation.user),
          calls: 0,
          toolCalls: 0,
          tokensIn: 0,
          tokensOut: 0,
          estimatedCost: 0,
        }));
        ur.toolCalls += 1;
      }

      const gr = addToMap(garages, garageId, () => ({
        garageId,
        garageName: garageNameFromRecord(tc.conversation.garage),
        garageLocation: tc.conversation.garage.address,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
        uniqueUsers: 0,
      }));
      gr.toolCalls += 1;
    }

    for (const gr of garages.values()) {
      gr.uniqueUsers = seenUsers.size;
    }

    summary.uniqueUsers = seenUsers.size;

    const taskUsage = Array.from(tasks.values()).map((task) => ({
      ...task,
      toolCalls:
        purposeToolCounts.get(taskGroupKey(task.purpose, task.model)) ?? 0,
    }));

    const taskUsageSorted = taskUsage.sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    );
    const agentUsageSorted = Array.from(agents.values()).sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    );
    const skillUsageSorted = Array.from(skills.values()).sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    );
    const userUsageSorted = Array.from(users.values()).sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    );
    const garageUsageSorted = Array.from(garages.values()).sort(
      (a, b) => b.calls - a.calls,
    );

    const toolUsageSorted = Array.from(toolRows.values()).sort(
      (a, b) => b.calls - a.calls,
    );

    const totalToolCalls = summary.toolCalls;
    const approvedOrExecuted =
      (approvalStatus.get(AssistantToolCallStatus.APPROVED) ?? 0) +
      (approvalStatus.get(AssistantToolCallStatus.EXECUTED) ?? 0);
    const denied = approvalStatus.get(AssistantToolCallStatus.DENIED) ?? 0;
    const expired = approvalStatus.get(AssistantToolCallStatus.EXPIRED) ?? 0;
    const pending =
      approvalStatus.get(AssistantToolCallStatus.PENDING_APPROVAL) ?? 0;
    const approvalRows = Object.values(AssistantToolCallStatus).map(
      (status) => {
        const calls = approvalStatus.get(status) ?? 0;
        const share = totalToolCalls > 0 ? (calls / totalToolCalls) * 100 : 0;
        const decision = approvalDecisionMs.get(status);
        const decisionSeconds =
          decision && decision.count > 0
            ? Number((decision.totalMs / decision.count / 1000).toFixed(2))
            : 0;

        return {
          status,
          calls,
          share: Number(share.toFixed(2)),
          avgDecisionSeconds: decisionSeconds,
        };
      },
    );

    const topExpensiveCalls = topCalls
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 10)
      .map((item) => item);

    return {
      generatedAt: new Date().toISOString(),
      range: {
        key: window.key,
        label: window.label,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        scope: 'ovh-only',
      },
      summary,
      taskUsage: taskUsageSorted,
      agentUsage: agentUsageSorted,
      skillUsage: skillUsageSorted,
      userUsage: userUsageSorted,
      garageUsage: garageUsageSorted,
      toolUsage: toolUsageSorted,
      approvalRefusal: {
        totalToolCalls,
        approvalRequired,
        approvedOrExecuted,
        denied,
        expired,
        pending,
        rows: approvalRows,
      },
      topExpensiveCalls,
      sourceCoverage: {
        dataSource: 'persisted_tables_only',
        includesGatewayOnlySignals: {
          classifierCalls: false,
          conversationTitles: false,
          rawGatewayLatency: false,
        },
        rowCoverage: {
          assistantMessagesScanned: messages.length,
          assistantToolCallsScanned: toolCalls.length,
          messagesWithoutModel: summary.rowsWithMissingModel,
          messagesWithoutPurpose: summary.rowsWithMissingPurpose,
          messagesWithoutTokens: summary.tokensMissing,
        },
      },
    };
  }
}
