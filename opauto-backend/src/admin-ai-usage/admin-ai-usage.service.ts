import { Injectable } from '@nestjs/common';
import { AssistantToolCallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageRangeKey } from './dto/admin-ai-usage-query.dto';

export const ADMIN_AI_USAGE_OWNER_EMAIL = 'ala.khliifa@gmail.com';

type OvhRangeWindow = {
  key: AiUsageRangeKey;
  label: string;
  start: Date;
  end: Date;
};

type RangeOptionCopy = {
  value: AiUsageRangeKey;
  label: string;
};

type PurposeDisplayCopy = {
  label: string;
  description: string;
};

type DashboardSectionCopy = {
  title: string;
  subtitle: string;
};

type DashboardKpiCopy = {
  label: string;
  hintTemplate: string;
};

type DashboardCopy = {
  app: {
    ariaLabel: string;
  };
  login: {
    ariaLabel: string;
    eyebrow: string;
    title: string;
    description: string;
    factsAriaLabel: string;
    facts: string[];
    formEyebrow: string;
    formTitle: string;
    emailLabel: string;
    passwordLabel: string;
    emailValidation: string;
    passwordValidation: string;
    defaultEmail: string;
    submitLabel: string;
    submittingLabel: string;
    restrictedError: string;
    invalidCredentialsError: string;
    sessionExpiredError: string;
  };
  header: {
    badge: string;
    title: string;
    generatedTemplate: string;
    rangeLabel: string;
    rangeWindowSeparator: string;
    scopeLabel: string;
    refreshLabel: string;
    loadingLabel: string;
    signOutLabel: string;
  };
  rangeOptions: RangeOptionCopy[];
  kpis: {
    calls: DashboardKpiCopy;
    spend: DashboardKpiCopy;
    tokens: DashboardKpiCopy;
    latency: DashboardKpiCopy;
  };
  sections: {
    costByTask: DashboardSectionCopy;
    costShare: DashboardSectionCopy;
    trend: DashboardSectionCopy;
    modelUsage: DashboardSectionCopy;
    taskUsage: DashboardSectionCopy;
    userUsage: DashboardSectionCopy;
    garageUsage: DashboardSectionCopy;
    toolHealth: DashboardSectionCopy;
    agentUsage: DashboardSectionCopy;
    sourceCoverage: DashboardSectionCopy;
    approval: DashboardSectionCopy;
    topCalls: DashboardSectionCopy;
  };
  tableHeaders: {
    taskUsage: string[];
    agentUsage: string[];
    sourceCoverage: string[];
    approval: string[];
  };
  labels: {
    totalSuffix: string;
    topTasks: string;
    calls: string;
    aiCalls: string;
    tokens: string;
    cost: string;
    latency: string;
    avgMs: string;
    inputTokens: string;
    outputTokens: string;
    toolCalls: string;
    notAvailable: string;
    utc: string;
    unknownTask: string;
    unknownModel: string;
    unknownProvider: string;
    unknownUser: string;
    unknownGarage: string;
    unknownAgent: string;
    unknownTool: string;
    otherTasks: string;
    toolDescription: string;
    pricedCalls: string;
    unpricedCalls: string;
    totalTokens: string;
    failedOrRejected: string;
  };
  units: {
    milliseconds: string;
    seconds: string;
  };
  booleans: {
    yes: string;
    no: string;
  };
  messages: {
    loadingAnalytics: string;
    endpointUnavailable: string;
    analyticsLoadFailed: string;
    noTaskUsage: string;
    noCost: string;
    noTrend: string;
    noModelUsage: string;
    noUserUsage: string;
    noGarageUsage: string;
    noToolUsage: string;
    noAgentUsage: string;
    noApprovalActivity: string;
    noTopCalls: string;
    noGatewayEvents: string;
  };
  approvalKpis: {
    approvalRequiredShare: string;
    approvedOrExecutedWrites: string;
    deniedOrRefused: string;
    expiredOrPending: string;
  };
  statuses: Record<string, string>;
  tiers: Record<string, string>;
  purposes: Record<string, PurposeDisplayCopy>;
  purposeTemplates: {
    toolPlanningLabel: string;
    toolPlanningDescription: string;
    replyWritingLabel: string;
    replyWritingDescription: string;
    storedCallDescription: string;
  };
  sourceRows: Record<
    string,
    { label: string; statusLabel: string; tone: 'primary' | 'neutral' | 'warn' }
  >;
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
  label: string;
  description: string;
  model: string | null;
  modelLabel: string;
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
  providerLabel: string;
  model: string | null;
  modelLabel: string;
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
  label: string;
  description: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
};

type OvhSkillUsageRow = {
  skill: string;
  label: string;
  description: string;
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
  label: string;
  description: string;
  dominantTierLabel: string;
  outcomeLabel: string;
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
  providerLabel: string;
  purpose: string;
  label: string;
  description: string;
  model: string | null;
  modelLabel: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  priced: boolean;
  latencyMs: number | null;
  status: string;
  statusLabel: string;
};

type OvhApprovalBreakdownRow = {
  status: string;
  label: string;
  calls: number;
  share: number;
  approvalRequired: boolean;
  approvalRequiredLabel: string;
  avgDecisionSeconds: number;
};

type OvhSourceCoverageRow = {
  key: string;
  label: string;
  value: number;
  statusLabel: string;
  tone: 'primary' | 'neutral' | 'warn';
};

type OvhUsageResponse = {
  copy: DashboardCopy;
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
    rows: OvhSourceCoverageRow[];
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
const DASHBOARD_COPY: DashboardCopy = {
  app: {
    ariaLabel: 'AI and OVH usage analytics',
  },
  login: {
    ariaLabel: 'Admin AI dashboard login',
    eyebrow: 'Owner analytics',
    title: 'AI / OVH Usage Analytics',
    description:
      'Sign in with the configured owner account to monitor gateway-level OVH model usage, tokens, cost, tools, agents, approvals, users, and garages.',
    factsAriaLabel: 'Dashboard scope',
    facts: ['Gateway usage events', 'OVH account scope', 'Owner-only access'],
    formEyebrow: 'Standalone login',
    formTitle: 'Open dashboard',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    emailValidation: 'Enter the configured owner email.',
    passwordValidation: 'Enter the dashboard password.',
    defaultEmail: ADMIN_AI_USAGE_OWNER_EMAIL,
    submitLabel: 'Sign in',
    submittingLabel: 'Signing in...',
    restrictedError:
      'This dashboard is restricted to the configured owner account.',
    invalidCredentialsError: 'Invalid admin email or password.',
    sessionExpiredError:
      'Your admin session expired or is not allowed for this dashboard.',
  },
  header: {
    badge: 'Operations Console',
    title: 'AI / OVH Usage Analytics',
    generatedTemplate:
      'Generated {generatedAt}, gateway-level OVH usage events',
    rangeLabel: 'Range',
    rangeWindowSeparator: 'to',
    scopeLabel: 'Gateway OVH account',
    refreshLabel: 'Refresh',
    loadingLabel: 'Loading',
    signOutLabel: 'Sign out',
  },
  rangeOptions: [
    { value: AiUsageRangeKey.TODAY, label: 'Today' },
    { value: AiUsageRangeKey.YESTERDAY, label: 'Yesterday' },
    { value: AiUsageRangeKey.LAST_WEEK, label: 'Last week' },
    { value: AiUsageRangeKey.THIS_MONTH, label: 'This month' },
    { value: AiUsageRangeKey.LAST_MONTH, label: 'Last month' },
    { value: AiUsageRangeKey.THIS_QUARTER, label: 'This quarter' },
    { value: AiUsageRangeKey.LAST_QUARTER, label: 'Last quarter' },
    { value: AiUsageRangeKey.THIS_YEAR, label: 'This year' },
    { value: AiUsageRangeKey.LAST_YEAR, label: 'Last year' },
  ],
  kpis: {
    calls: {
      label: 'Gateway AI calls',
      hintTemplate: '{gatewayEvents} OVH completion events recorded',
    },
    spend: {
      label: 'Estimated OVH spend',
      hintTemplate: '{pricedCalls} priced calls, {unpricedCalls} unpriced',
    },
    tokens: {
      label: 'Input / output tokens',
      hintTemplate: '{totalTokens} total tokens',
    },
    latency: {
      label: 'Average completion latency',
      hintTemplate: '{failureRate} failed or rejected provider attempts',
    },
  },
  sections: {
    costByTask: {
      title: 'Cost by AI Task',
      subtitle: '{rangeLabel}, {totalCost} total',
    },
    costShare: {
      title: 'AI Task Cost Share',
      subtitle: 'top tasks',
    },
    trend: {
      title: 'OVH Usage Trend',
      subtitle: '{rangeLabel} buckets',
    },
    modelUsage: {
      title: 'Model Usage',
      subtitle: 'gateway calls by model',
    },
    taskUsage: {
      title: 'AI Task Usage',
      subtitle: 'usage grouped by task and model',
    },
    userUsage: {
      title: 'User Usage',
      subtitle: 'gateway events grouped by user',
    },
    garageUsage: {
      title: 'Garage Usage',
      subtitle: 'gateway events grouped by garage',
    },
    toolHealth: {
      title: 'Tool Execution Health',
      subtitle: 'actual tool calls and outcomes',
    },
    agentUsage: {
      title: 'Agent Usage',
      subtitle: 'specialized agent calls from gateway events',
    },
    sourceCoverage: {
      title: 'Source Coverage',
      subtitle: '{coverage} attributed to user and garage',
    },
    approval: {
      title: 'Approval / Refusal Analytics',
      subtitle: 'tool calls grouped by approval outcome',
    },
    topCalls: {
      title: 'Top Expensive AI Calls',
      subtitle: 'individual gateway completion events',
    },
  },
  tableHeaders: {
    taskUsage: [
      'AI Task',
      'Model',
      'Calls',
      'Input tokens',
      'Output tokens',
      'Cost',
      'Avg ms',
    ],
    agentUsage: [
      'Agent',
      'Calls',
      'Input tokens',
      'Output tokens',
      'Tool calls',
      'Cost',
      'Avg ms',
    ],
    sourceCoverage: ['Metric', 'Rows', 'Status'],
    approval: ['Status', 'Calls', 'Share', 'Approval-required', 'Avg decision'],
  },
  labels: {
    totalSuffix: 'total',
    topTasks: 'top tasks',
    calls: 'calls',
    aiCalls: 'AI calls',
    tokens: 'Tokens',
    cost: 'Cost',
    latency: 'Latency',
    avgMs: 'Avg ms',
    inputTokens: 'Input tokens',
    outputTokens: 'Output tokens',
    toolCalls: 'Tool calls',
    notAvailable: 'n/a',
    utc: 'UTC',
    unknownTask: 'Unknown AI task',
    unknownModel: 'Unknown model',
    unknownProvider: 'Unknown provider',
    unknownUser: 'Unknown user',
    unknownGarage: 'Unknown garage',
    unknownAgent: 'Unknown agent',
    unknownTool: 'Unknown tool',
    otherTasks: 'Other AI tasks',
    toolDescription: 'Tool invoked by the assistant.',
    pricedCalls: 'priced calls',
    unpricedCalls: 'unpriced',
    totalTokens: 'total tokens',
    failedOrRejected: 'failed or rejected provider attempts',
  },
  units: {
    milliseconds: 'ms',
    seconds: 's',
  },
  booleans: {
    yes: 'Yes',
    no: 'No',
  },
  messages: {
    loadingAnalytics: 'Loading AI usage analytics...',
    endpointUnavailable:
      'The admin AI usage endpoint is not available on this server.',
    analyticsLoadFailed: 'Could not load AI usage analytics. Try refreshing.',
    noTaskUsage: 'No AI task usage in this range.',
    noCost: 'No cost recorded in this range.',
    noTrend: 'No usage trend in this range.',
    noModelUsage: 'No model usage in this range.',
    noUserUsage: 'No user usage in this range.',
    noGarageUsage: 'No garage usage in this range.',
    noToolUsage: 'No tool usage in this range.',
    noAgentUsage: 'No agent usage in this range.',
    noApprovalActivity: 'No approval or refusal activity in this range.',
    noTopCalls: 'No priced OVH calls in this range.',
    noGatewayEvents: 'No gateway events in range',
  },
  approvalKpis: {
    approvalRequiredShare: 'Approval-required share',
    approvedOrExecutedWrites: 'Approved/executed writes',
    deniedOrRefused: 'Denied/refused',
    expiredOrPending: 'Expired or pending',
  },
  statuses: {
    APPROVED: 'Approved',
    DENIED: 'Refused',
    EXPIRED: 'Expired',
    PENDING_APPROVAL: 'Waiting for approval',
    EXECUTED: 'Executed',
    FAILED: 'Failed',
    SUCCESS: 'Completed',
    REJECTED: 'Rejected',
    MOCK: 'Mocked',
    UNKNOWN: 'Unknown status',
  },
  tiers: {
    READ: 'Read action',
    AUTO_WRITE: 'Auto-write action',
    CONFIRM_WRITE: 'Needs approval',
    TYPED_CONFIRM_WRITE: 'Typed confirmation',
    UNKNOWN: 'Unknown access',
  },
  purposes: {
    assistant_tool_selection: {
      label: 'Tool planning without tool context',
      description:
        'The gateway recorded a tool-selection completion without a tool name.',
    },
    assistant_compose: {
      label: 'Assistant reply without tool context',
      description:
        'The gateway recorded a reply-writing completion without the related tool name.',
    },
    intent_classifier: {
      label: 'Intent routing',
      description:
        'Classifies the user request before the main assistant runs.',
    },
    conversation_title: {
      label: 'Conversation title generation',
      description: 'Creates short conversation titles for the chat history.',
    },
    'agent_runner:analytics-agent': {
      label: 'Analytics agent',
      description:
        'Runs reporting and analysis requests through the LLM brain.',
    },
    'agent_runner:communications-agent': {
      label: 'Communications agent',
      description: 'Drafts or prepares customer communication workflows.',
    },
    'agent_runner:inventory-agent': {
      label: 'Inventory agent',
      description: 'Handles inventory-related reasoning and tool planning.',
    },
    'agent_runner:finance-agent': {
      label: 'Finance agent',
      description: 'Handles invoicing, payment, and financial reasoning tasks.',
    },
    'agent_runner:growth-agent': {
      label: 'Growth agent',
      description: 'Handles customer growth and follow-up reasoning tasks.',
    },
    'agent_runner:scheduling-agent': {
      label: 'Scheduling agent',
      description: 'Handles calendar and booking reasoning tasks.',
    },
    unknown: {
      label: 'Unknown AI task',
      description: 'Stored gateway call without a recognized task label.',
    },
  },
  purposeTemplates: {
    toolPlanningLabel: '{tool} tool planning',
    toolPlanningDescription: 'Selects {tool} as the next assistant action.',
    replyWritingLabel: '{tool} reply writing',
    replyWritingDescription:
      'Writes the final user-facing answer after {tool} finishes.',
    storedCallDescription: 'Stored AI call for {task}.',
  },
  sourceRows: {
    gatewayEventsScanned: {
      label: 'Gateway events scanned',
      statusLabel: 'Primary usage source',
      tone: 'primary',
    },
    assistantToolCallsScanned: {
      label: 'Tool calls scanned',
      statusLabel: 'Execution health source',
      tone: 'neutral',
    },
    eventsWithoutContext: {
      label: 'Events missing context',
      statusLabel: 'Still counted in OVH totals',
      tone: 'neutral',
    },
    eventsWithoutTokens: {
      label: 'Events missing tokens',
      statusLabel: 'Cost may be incomplete',
      tone: 'warn',
    },
  },
};
const APPROVAL_REQUIRED_STATUSES = new Set<string>([
  AssistantToolCallStatus.APPROVED,
  AssistantToolCallStatus.DENIED,
  AssistantToolCallStatus.PENDING_APPROVAL,
]);

function addToMap<K extends string, V>(map: Map<K, V>, key: K, seed: () => V) {
  if (!map.has(key)) map.set(key, seed());
  return map.get(key) as V;
}

function copyDashboard(): DashboardCopy {
  return {
    ...DASHBOARD_COPY,
    login: { ...DASHBOARD_COPY.login },
    header: { ...DASHBOARD_COPY.header },
    rangeOptions: DASHBOARD_COPY.rangeOptions.map((option) => ({ ...option })),
    kpis: {
      calls: { ...DASHBOARD_COPY.kpis.calls },
      spend: { ...DASHBOARD_COPY.kpis.spend },
      tokens: { ...DASHBOARD_COPY.kpis.tokens },
      latency: { ...DASHBOARD_COPY.kpis.latency },
    },
    sections: Object.fromEntries(
      Object.entries(DASHBOARD_COPY.sections).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ) as DashboardCopy['sections'],
    tableHeaders: {
      taskUsage: [...DASHBOARD_COPY.tableHeaders.taskUsage],
      agentUsage: [...DASHBOARD_COPY.tableHeaders.agentUsage],
      sourceCoverage: [...DASHBOARD_COPY.tableHeaders.sourceCoverage],
      approval: [...DASHBOARD_COPY.tableHeaders.approval],
    },
    labels: { ...DASHBOARD_COPY.labels },
    units: { ...DASHBOARD_COPY.units },
    booleans: { ...DASHBOARD_COPY.booleans },
    messages: { ...DASHBOARD_COPY.messages },
    approvalKpis: { ...DASHBOARD_COPY.approvalKpis },
    statuses: { ...DASHBOARD_COPY.statuses },
    tiers: { ...DASHBOARD_COPY.tiers },
    purposes: Object.fromEntries(
      Object.entries(DASHBOARD_COPY.purposes).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ) as Record<string, PurposeDisplayCopy>,
    purposeTemplates: { ...DASHBOARD_COPY.purposeTemplates },
    sourceRows: Object.fromEntries(
      Object.entries(DASHBOARD_COPY.sourceRows).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ) as DashboardCopy['sourceRows'],
  };
}

function applyTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key]),
  );
}

function humanizeIdentifier(value: string | null | undefined): string {
  const cleaned = (value || '')
    .replace(/^agent_runner:/, '')
    .replace(/[_:.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
}

function modelDisplayLabel(model: string | null): string {
  const value = model?.trim() ?? '';
  if (!value) return DASHBOARD_COPY.labels.unknownModel;
  if (/mistral/i.test(value)) return 'Mistral Small 3.2';
  if (/llama/i.test(value)) return 'Llama 3.3 70B';
  return humanizeIdentifier(value) || value;
}

function providerDisplayLabel(provider: string | null | undefined): string {
  const value = provider?.trim();
  return value ? value.toUpperCase() : DASHBOARD_COPY.labels.unknownProvider;
}

function scopedToolPurpose(
  purpose: string,
): { basePurpose: string; toolName: string } | null {
  const match = /^(assistant_tool_selection|assistant_compose):(.+)$/.exec(
    purpose,
  );
  if (!match?.[2]?.trim()) return null;
  return { basePurpose: match[1], toolName: match[2].trim() };
}

function purposeDisplay(purpose: string): PurposeDisplayCopy {
  const scoped = scopedToolPurpose(purpose);
  if (scoped) {
    const tool = humanizeIdentifier(scoped.toolName);
    const isReply = scoped.basePurpose === ASSISTANT_COMPOSE_PURPOSE;
    return {
      label: applyTemplate(
        isReply
          ? DASHBOARD_COPY.purposeTemplates.replyWritingLabel
          : DASHBOARD_COPY.purposeTemplates.toolPlanningLabel,
        { tool },
      ),
      description: applyTemplate(
        isReply
          ? DASHBOARD_COPY.purposeTemplates.replyWritingDescription
          : DASHBOARD_COPY.purposeTemplates.toolPlanningDescription,
        { tool },
      ),
    };
  }

  const known = DASHBOARD_COPY.purposes[purpose];
  if (known) return known;

  const task = humanizeIdentifier(purpose) || DASHBOARD_COPY.labels.unknownTask;
  return {
    label: task,
    description: applyTemplate(
      DASHBOARD_COPY.purposeTemplates.storedCallDescription,
      {
        task,
      },
    ),
  };
}

function toolDisplayName(toolName: string | null | undefined): string {
  return humanizeIdentifier(toolName) || DASHBOARD_COPY.labels.unknownTool;
}

function statusDisplayLabel(status: string | null | undefined): string {
  const normalized = (status ?? 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
  return (
    DASHBOARD_COPY.statuses[normalized] ??
    humanizeIdentifier(normalized) ??
    DASHBOARD_COPY.statuses.UNKNOWN
  );
}

function tierDisplayLabel(tier: string | null | undefined): string {
  const normalized = (tier ?? 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
  return (
    DASHBOARD_COPY.tiers[normalized] ??
    humanizeIdentifier(normalized) ??
    DASHBOARD_COPY.tiers.UNKNOWN
  );
}

function dominantTierLabel(row: OvhToolUsageRow): string {
  const entries = Object.entries(row.tierBreakdown ?? {});
  if (entries.length === 0) return DASHBOARD_COPY.tiers.UNKNOWN;
  const [tier] = entries.sort((a, b) => b[1] - a[1])[0];
  return tierDisplayLabel(tier);
}

function toolOutcomeLabel(row: OvhToolUsageRow): string {
  return `${row.approved} ${DASHBOARD_COPY.statuses.APPROVED.toLowerCase()}, ${row.denied} ${DASHBOARD_COPY.statuses.DENIED.toLowerCase()}, ${row.failed} ${DASHBOARD_COPY.statuses.FAILED.toLowerCase()}`;
}

function agentDisplay(agent: string): PurposeDisplayCopy {
  const purpose = `${DEFAULT_AGENT_PREFIX}${agent}`;
  return purposeDisplay(purpose);
}

function userNameFromRecord(row: UserRecord | undefined): string {
  if (!row) return DASHBOARD_COPY.labels.unknownUser;
  const first = row.firstName?.trim() ?? '';
  const last = row.lastName?.trim() ?? '';
  if ((first + last).trim().length > 0) {
    return `${first} ${last}`.trim();
  }
  return row.email?.trim() || DASHBOARD_COPY.labels.unknownUser;
}

function garageNameFromRecord(row: GarageRecord | undefined): string {
  return row?.name?.trim() || DASHBOARD_COPY.labels.unknownGarage;
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
  return (
    DASHBOARD_COPY.rangeOptions.find((option) => option.value === key)?.label ??
    String(key)
  );
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

  getDashboardCopy(): DashboardCopy {
    return copyDashboard();
  }

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
      const purposeCopy = purposeDisplay(purpose);
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
        label: purposeCopy.label,
        description: purposeCopy.description,
        model,
        modelLabel: modelDisplayLabel(model),
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
          providerLabel: providerDisplayLabel(event.provider),
          model,
          modelLabel: modelDisplayLabel(model),
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
        const agentCopy = agentDisplay(agent);
        const agentRow = addToMap(agents, agent, () => ({
          agent,
          label: agentCopy.label,
          description: agentCopy.description,
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
        providerLabel: providerDisplayLabel(event.provider),
        purpose,
        label: purposeCopy.label,
        description: purposeCopy.description,
        model,
        modelLabel: modelDisplayLabel(model),
        tokensIn,
        tokensOut,
        estimatedCost: cost,
        priced: event.priced,
        latencyMs: event.latencyMs,
        status,
        statusLabel: statusDisplayLabel(status),
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
        label: toolDisplayName(tc.toolName),
        description: DASHBOARD_COPY.labels.toolDescription,
        dominantTierLabel: DASHBOARD_COPY.tiers.UNKNOWN,
        outcomeLabel: '',
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

    const toolUsageSorted = Array.from(toolRows.values())
      .map((tool) => ({
        ...tool,
        dominantTierLabel: dominantTierLabel(tool),
        outcomeLabel: toolOutcomeLabel(tool),
      }))
      .sort((a, b) => b.calls - a.calls);

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
        const approvalRequiredForStatus =
          APPROVAL_REQUIRED_STATUSES.has(status);
        return {
          status,
          label: statusDisplayLabel(status),
          calls,
          share: Number(share.toFixed(2)),
          approvalRequired: approvalRequiredForStatus,
          approvalRequiredLabel: approvalRequiredForStatus
            ? DASHBOARD_COPY.booleans.yes
            : DASHBOARD_COPY.booleans.no,
          avgDecisionSeconds:
            decision && decision.count > 0
              ? Number((decision.totalMs / decision.count / 1000).toFixed(2))
              : 0,
        };
      },
    );

    const timeBuckets = this.buildTimeBuckets(window, events);
    const sourceRows = this.buildSourceCoverageRows({
      gatewayEventsScanned: events.length,
      assistantToolCallsScanned: toolCalls.length,
      eventsWithoutContext: summary.eventsMissingContext,
      eventsWithoutTokens: summary.tokensMissing,
    });

    return {
      copy: this.getDashboardCopy(),
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
        rows: sourceRows,
      },
    };
  }

  private buildSourceCoverageRows(values: {
    gatewayEventsScanned: number;
    assistantToolCallsScanned: number;
    eventsWithoutContext: number;
    eventsWithoutTokens: number;
  }): OvhSourceCoverageRow[] {
    return Object.entries(values).map(([key, value]) => {
      const copy = DASHBOARD_COPY.sourceRows[key];
      return {
        key,
        label: copy.label,
        value,
        statusLabel: copy.statusLabel,
        tone: copy.tone,
      };
    });
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
