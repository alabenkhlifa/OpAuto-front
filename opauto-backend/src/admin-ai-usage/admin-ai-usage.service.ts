import { Injectable } from '@nestjs/common';
import { AssistantToolCallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageRangeKey } from './dto/admin-ai-usage-query.dto';

type OvhRangeWindow = {
  key: AiUsageRangeKey;
  label: string;
  start: Date;
  end: Date;
};

type OvhUsageSummary = {
  llmCalls: number;
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
  failedCalls: number;
  rejectedCalls: number;
  mockCalls: number;
  avgLatencyMs: number | null;
  gatewayEvents: number;
  eventsMissingContext: number;
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
  avgLatencyMs: number | null;
  failedCalls: number;
};

type OvhModelUsageRow = {
  provider: string;
  model: string | null;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  avgLatencyMs: number | null;
  failedCalls: number;
};

type OvhTimeBucketRow = {
  label: string;
  start: string;
  end: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  avgLatencyMs: number | null;
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
  eventId: string;
  conversationId: string | null;
  userId: string | null;
  userName: string;
  garageId: string | null;
  garageName: string | null;
  createdAt: string;
  provider: string;
  purpose: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  priced: boolean;
  latencyMs: number | null;
  status: string;
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
    scope: 'gateway-ovh-account';
  };
  summary: OvhUsageSummary;
  taskUsage: OvhTaskUsageRow[];
  modelUsage: OvhModelUsageRow[];
  timeBuckets: OvhTimeBucketRow[];
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
    dataSource: 'gateway_usage_events';
    includesGatewayOnlySignals: {
      classifierCalls: true;
      conversationTitles: true;
      rawGatewayLatency: true;
    };
    rowCoverage: {
      gatewayEventsScanned: number;
      assistantToolCallsScanned: number;
      eventsWithoutModel: number;
      eventsWithoutPurpose: number;
      eventsWithoutTokens: number;
      eventsWithoutContext: number;
    };
  };
};

type LlmUsageEventRow = {
  id: string;
  provider: string;
  model: string | null;
  purpose: string | null;
  status: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  estimatedCost: number;
  priced: boolean;
  conversationId: string | null;
  garageId: string | null;
  userId: string | null;
  toolName: string | null;
  createdAt: Date;
};

type UserRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type GarageRecord = {
  id: string;
  name: string | null;
  address: string | null;
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
    user: UserRecord;
    garage: GarageRecord;
  };
};

const ASSISTANT_TOOL_SELECTION_PURPOSE = 'assistant_tool_selection';
const ASSISTANT_COMPOSE_PURPOSE = 'assistant_compose';
const DEFAULT_AGENT_PREFIX = 'agent_runner:';

function addToMap<K extends string, V>(map: Map<K, V>, key: K, seed: () => V) {
  if (!map.has(key)) map.set(key, seed());
  return map.get(key) as V;
}

function userNameFromRecord(row: UserRecord | undefined): string {
  if (!row) return 'Unknown user';
  const first = row.firstName?.trim() ?? '';
  const last = row.lastName?.trim() ?? '';
  if ((first + last).trim().length > 0) {
    return `${first} ${last}`.trim();
  }
  return row.email?.trim() || 'Unknown user';
}

function garageNameFromRecord(row: GarageRecord | undefined): string {
  return row?.name?.trim() || 'Unknown garage';
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

function normalizedPurpose(event: LlmUsageEventRow): string {
  const rawPurpose = event.purpose?.trim() || 'unknown';
  const toolName = event.toolName?.trim();
  if (toolName && shouldScopePurposeToTool(rawPurpose)) {
    return toolScopedPurpose(rawPurpose, toolName);
  }
  return rawPurpose;
}

function taskGroupKey(purpose: string, model: string | null): string {
  return `${purpose}::${model ?? 'unknown-model'}`;
}

function modelGroupKey(provider: string, model: string | null): string {
  return `${provider}::${model ?? 'unknown-model'}`;
}

function eventStatus(row: { status: string | null | undefined }): string {
  return (row.status ?? 'SUCCESS').trim().toUpperCase() || 'SUCCESS';
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function averageMs(total: number, samples: number): number | null {
  if (samples <= 0) return null;
  return Number((total / samples).toFixed(2));
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

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function addMonths(base: Date, months: number): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1, 0, 0, 0, 0),
  );
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
    const day = startOfToday.getUTCDay();
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
    return {
      key: range,
      label: makeRangeLabel(range),
      start: new Date(
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
      ),
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
    return {
      key: range,
      label: makeRangeLabel(range),
      start: new Date(
        Date.UTC(startYear, normalizedQuarter * 3, 1, 0, 0, 0, 0),
      ),
      end:
        targetQuarter < 0
          ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
          : getQuarterStartUtc(now, quarter),
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

  return {
    key: range,
    label: makeRangeLabel(range),
    start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
  };
}

function buildBucketRanges(
  window: OvhRangeWindow,
): { start: Date; end: Date; label: string }[] {
  const buckets: { start: Date; end: Date; label: string }[] = [];

  if (
    window.key === AiUsageRangeKey.TODAY ||
    window.key === AiUsageRangeKey.YESTERDAY
  ) {
    for (let i = 0; i < 24; i += 1) {
      const start = addHours(window.start, i);
      const end = addHours(start, 1);
      buckets.push({
        start,
        end,
        label: `${String(start.getUTCHours()).padStart(2, '0')}:00`,
      });
    }
    return buckets;
  }

  if (
    window.key === AiUsageRangeKey.LAST_WEEK ||
    window.key === AiUsageRangeKey.THIS_MONTH ||
    window.key === AiUsageRangeKey.LAST_MONTH
  ) {
    let cursor = window.start;
    while (cursor < window.end) {
      const start = cursor;
      const end = addDays(start, 1);
      buckets.push({
        start,
        end,
        label: start.toISOString().slice(5, 10),
      });
      cursor = end;
    }
    return buckets;
  }

  let cursor = new Date(
    Date.UTC(
      window.start.getUTCFullYear(),
      window.start.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );
  while (cursor < window.end) {
    const start = cursor;
    const end = addMonths(start, 1);
    buckets.push({
      start,
      end,
      label: start.toISOString().slice(0, 7),
    });
    cursor = end;
  }
  return buckets;
}

@Injectable()
export class AdminAiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getOvhUsage(
    _garageId: string,
    range: AiUsageRangeKey,
  ): Promise<OvhUsageResponse> {
    const window = resolveRangeWindow(range);
    const whereWindow = {
      createdAt: { gte: window.start, lt: window.end },
    } as const;

    const events = (await this.prisma.llmUsageEvent.findMany({
      where: {
        ...whereWindow,
        provider: 'ovh',
      },
      orderBy: { createdAt: 'asc' },
    })) as LlmUsageEventRow[];

    const toolCalls = (await this.prisma.assistantToolCall.findMany({
      where: whereWindow,
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
      },
    })) as ToolCallRow[];

    const userIds = new Set<string>();
    const garageIds = new Set<string>();
    for (const event of events) {
      if (event.userId) userIds.add(event.userId);
      if (event.garageId) garageIds.add(event.garageId);
    }
    for (const toolCall of toolCalls) {
      if (toolCall.conversation.userId)
        userIds.add(toolCall.conversation.userId);
      if (toolCall.conversation.garage.id)
        garageIds.add(toolCall.conversation.garage.id);
    }

    const users = userIds.size
      ? ((await this.prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })) as UserRecord[])
      : [];
    const garages = garageIds.size
      ? ((await this.prisma.garage.findMany({
          where: { id: { in: Array.from(garageIds) } },
          select: { id: true, name: true, address: true },
        })) as GarageRecord[])
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const garagesById = new Map(garages.map((garage) => [garage.id, garage]));

    const summary: OvhUsageSummary = {
      llmCalls: 0,
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
      failedCalls: 0,
      rejectedCalls: 0,
      mockCalls: 0,
      avgLatencyMs: null,
      gatewayEvents: events.length,
      eventsMissingContext: 0,
    };

    const tasks = new Map<
      string,
      OvhTaskUsageRow & { latencyTotal: number; latencySamples: number }
    >();
    const models = new Map<
      string,
      OvhModelUsageRow & { latencyTotal: number; latencySamples: number }
    >();
    const agents = new Map<string, OvhAgentUsageRow>();
    const usersUsage = new Map<string, OvhUserUsageRow>();
    const garagesUsage = new Map<
      string,
      OvhGarageUsageRow & { userIds: Set<string> }
    >();
    const seenUsers = new Set<string>();
    const topCalls: OvhTopExpensiveCall[] = [];
    let latencyTotal = 0;
    let latencySamples = 0;

    for (const event of events) {
      const purpose = normalizedPurpose(event);
      const model = event.model?.trim() || null;
      const tokensIn = event.tokensIn ?? 0;
      const tokensOut = event.tokensOut ?? 0;
      const status = eventStatus(event);
      const cost = event.estimatedCost ?? 0;

      summary.llmCalls += 1;
      summary.assistantMessages += 1;
      summary.tokensIn += tokensIn;
      summary.tokensOut += tokensOut;
      summary.estimatedCost += cost;
      if (event.priced) summary.ovhMessagesPriced += 1;
      else summary.ovhMessagesUnpriced += 1;
      if (event.tokensIn === null && event.tokensOut === null)
        summary.tokensMissing += 1;
      if (!event.model?.trim()) summary.rowsWithMissingModel += 1;
      if (!event.purpose?.trim()) summary.rowsWithMissingPurpose += 1;
      if (!event.userId || !event.garageId) summary.eventsMissingContext += 1;
      if (status === 'FAILED') summary.failedCalls += 1;
      if (status === 'REJECTED') summary.rejectedCalls += 1;
      if (status === 'MOCK') summary.mockCalls += 1;
      if (typeof event.latencyMs === 'number') {
        latencyTotal += event.latencyMs;
        latencySamples += 1;
      }

      const task = addToMap(tasks, taskGroupKey(purpose, model), () => ({
        purpose,
        model,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
        unpricedCalls: 0,
        avgLatencyMs: null,
        failedCalls: 0,
        latencyTotal: 0,
        latencySamples: 0,
      }));
      task.calls += 1;
      task.tokensIn += tokensIn;
      task.tokensOut += tokensOut;
      task.estimatedCost += cost;
      if (!event.priced) task.unpricedCalls += 1;
      if (status === 'FAILED' || status === 'REJECTED') task.failedCalls += 1;
      if (event.toolName) task.toolCalls += 1;
      if (typeof event.latencyMs === 'number') {
        task.latencyTotal += event.latencyMs;
        task.latencySamples += 1;
      }

      const modelRow = addToMap(
        models,
        modelGroupKey(event.provider, model),
        () => ({
          provider: event.provider,
          model,
          calls: 0,
          tokensIn: 0,
          tokensOut: 0,
          estimatedCost: 0,
          avgLatencyMs: null,
          failedCalls: 0,
          latencyTotal: 0,
          latencySamples: 0,
        }),
      );
      modelRow.calls += 1;
      modelRow.tokensIn += tokensIn;
      modelRow.tokensOut += tokensOut;
      modelRow.estimatedCost += cost;
      if (status === 'FAILED' || status === 'REJECTED')
        modelRow.failedCalls += 1;
      if (typeof event.latencyMs === 'number') {
        modelRow.latencyTotal += event.latencyMs;
        modelRow.latencySamples += 1;
      }

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
        agentRow.estimatedCost += cost;
      }

      if (event.userId) {
        seenUsers.add(event.userId);
        const userRow = addToMap(usersUsage, event.userId, () => ({
          userId: event.userId as string,
          userName: userNameFromRecord(usersById.get(event.userId as string)),
          calls: 0,
          toolCalls: 0,
          tokensIn: 0,
          tokensOut: 0,
          estimatedCost: 0,
        }));
        userRow.calls += 1;
        userRow.tokensIn += tokensIn;
        userRow.tokensOut += tokensOut;
        userRow.estimatedCost += cost;
      }

      if (event.garageId) {
        const garageRow = addToMap(garagesUsage, event.garageId, () => {
          const garage = garagesById.get(event.garageId as string);
          return {
            garageId: event.garageId as string,
            garageName: garageNameFromRecord(garage),
            garageLocation: garage?.address ?? null,
            calls: 0,
            toolCalls: 0,
            tokensIn: 0,
            tokensOut: 0,
            estimatedCost: 0,
            uniqueUsers: 0,
            userIds: new Set<string>(),
          };
        });
        garageRow.calls += 1;
        garageRow.tokensIn += tokensIn;
        garageRow.tokensOut += tokensOut;
        garageRow.estimatedCost += cost;
        if (event.userId) garageRow.userIds.add(event.userId);
      }

      topCalls.push({
        eventId: event.id,
        conversationId: event.conversationId,
        userId: event.userId,
        userName: userNameFromRecord(
          event.userId ? usersById.get(event.userId) : undefined,
        ),
        garageId: event.garageId,
        garageName: event.garageId
          ? garageNameFromRecord(garagesById.get(event.garageId))
          : null,
        createdAt: event.createdAt.toISOString(),
        provider: event.provider,
        purpose,
        model,
        tokensIn,
        tokensOut,
        estimatedCost: cost,
        priced: event.priced,
        latencyMs: event.latencyMs,
        status,
      });
    }

    const toolRows = new Map<string, OvhToolUsageRow>();
    const approvalStatus = new Map<string, number>();
    const approvalDecisionMs = new Map<
      string,
      { totalMs: number; count: number }
    >();
    let approvalRequired = 0;

    for (const tc of toolCalls) {
      summary.toolCalls += 1;
      seenUsers.add(tc.conversation.userId);

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

      const status = tc.status;
      approvalStatus.set(status, (approvalStatus.get(status) ?? 0) + 1);

      if (status === AssistantToolCallStatus.APPROVED) {
        toolRow.approved += 1;
        approvalRequired += 1;
      } else if (status === AssistantToolCallStatus.DENIED) {
        toolRow.denied += 1;
        approvalRequired += 1;
      } else if (status === AssistantToolCallStatus.PENDING_APPROVAL) {
        toolRow.pending += 1;
        approvalRequired += 1;
      } else if (status === AssistantToolCallStatus.EXPIRED) {
        toolRow.expired += 1;
      } else if (status === AssistantToolCallStatus.EXECUTED) {
        toolRow.executed += 1;
      } else if (status === AssistantToolCallStatus.FAILED) {
        toolRow.failed += 1;
      }

      if (tc.approvedAt) {
        const decision = approvalDecisionMs.get(status) ?? {
          totalMs: 0,
          count: 0,
        };
        decision.totalMs += Math.max(
          0,
          tc.approvedAt.getTime() - tc.createdAt.getTime(),
        );
        decision.count += 1;
        approvalDecisionMs.set(status, decision);
      }

      const userRow = addToMap(usersUsage, tc.conversation.userId, () => ({
        userId: tc.conversation.userId,
        userName: userNameFromRecord(tc.conversation.user),
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
      }));
      userRow.toolCalls += 1;

      const garage = tc.conversation.garage;
      const garageRow = addToMap(garagesUsage, garage.id, () => ({
        garageId: garage.id,
        garageName: garageNameFromRecord(garage),
        garageLocation: garage.address,
        calls: 0,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
        uniqueUsers: 0,
        userIds: new Set<string>(),
      }));
      garageRow.toolCalls += 1;
      garageRow.userIds.add(tc.conversation.userId);
    }

    summary.uniqueUsers = seenUsers.size;
    summary.estimatedCost = rounded(summary.estimatedCost);
    summary.avgLatencyMs = averageMs(latencyTotal, latencySamples);

    const taskUsageSorted = Array.from(tasks.values())
      .map(({ latencyTotal: total, latencySamples: samples, ...task }) => ({
        ...task,
        estimatedCost: rounded(task.estimatedCost),
        avgLatencyMs: averageMs(total, samples),
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    const modelUsageSorted = Array.from(models.values())
      .map(({ latencyTotal: total, latencySamples: samples, ...model }) => ({
        ...model,
        estimatedCost: rounded(model.estimatedCost),
        avgLatencyMs: averageMs(total, samples),
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    const agentUsageSorted = Array.from(agents.values())
      .map((agent) => ({
        ...agent,
        estimatedCost: rounded(agent.estimatedCost),
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    const userUsageSorted = Array.from(usersUsage.values())
      .map((user) => ({ ...user, estimatedCost: rounded(user.estimatedCost) }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    const garageUsageSorted = Array.from(garagesUsage.values())
      .map(({ userIds, ...garage }) => ({
        ...garage,
        estimatedCost: rounded(garage.estimatedCost),
        uniqueUsers: userIds.size,
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

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
        return {
          status,
          calls,
          share: Number(share.toFixed(2)),
          avgDecisionSeconds:
            decision && decision.count > 0
              ? Number((decision.totalMs / decision.count / 1000).toFixed(2))
              : 0,
        };
      },
    );

    const timeBuckets = this.buildTimeBuckets(window, events);

    return {
      generatedAt: new Date().toISOString(),
      range: {
        key: window.key,
        label: window.label,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        scope: 'gateway-ovh-account',
      },
      summary,
      taskUsage: taskUsageSorted,
      modelUsage: modelUsageSorted,
      timeBuckets,
      agentUsage: agentUsageSorted,
      skillUsage: [],
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
      topExpensiveCalls: topCalls
        .sort((a, b) => b.estimatedCost - a.estimatedCost)
        .slice(0, 10)
        .map((call) => ({
          ...call,
          estimatedCost: rounded(call.estimatedCost),
        })),
      sourceCoverage: {
        dataSource: 'gateway_usage_events',
        includesGatewayOnlySignals: {
          classifierCalls: true,
          conversationTitles: true,
          rawGatewayLatency: true,
        },
        rowCoverage: {
          gatewayEventsScanned: events.length,
          assistantToolCallsScanned: toolCalls.length,
          eventsWithoutModel: summary.rowsWithMissingModel,
          eventsWithoutPurpose: summary.rowsWithMissingPurpose,
          eventsWithoutTokens: summary.tokensMissing,
          eventsWithoutContext: summary.eventsMissingContext,
        },
      },
    };
  }

  private buildTimeBuckets(
    window: OvhRangeWindow,
    events: LlmUsageEventRow[],
  ): OvhTimeBucketRow[] {
    return buildBucketRanges(window).map((bucket) => {
      const rows = events.filter(
        (event) =>
          event.createdAt >= bucket.start && event.createdAt < bucket.end,
      );
      const latencyRows = rows.filter(
        (event) => typeof event.latencyMs === 'number',
      );
      const latencyTotal = latencyRows.reduce(
        (sum, event) => sum + (event.latencyMs ?? 0),
        0,
      );
      return {
        label: bucket.label,
        start: bucket.start.toISOString(),
        end: bucket.end.toISOString(),
        calls: rows.length,
        tokensIn: rows.reduce((sum, event) => sum + (event.tokensIn ?? 0), 0),
        tokensOut: rows.reduce((sum, event) => sum + (event.tokensOut ?? 0), 0),
        estimatedCost: rounded(
          rows.reduce((sum, event) => sum + (event.estimatedCost ?? 0), 0),
        ),
        avgLatencyMs: averageMs(latencyTotal, latencyRows.length),
      };
    });
  }
}
