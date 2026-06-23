export type AdminAiUsageRange =
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year';

export interface AdminAiUsageRangeWindow {
  key: AdminAiUsageRange;
  label: string;
  start: string;
  end: string;
  scope: 'ovh-only' | 'gateway-ovh-account';
}

export interface AdminAiUsageSummary {
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
}

export interface AdminAiUsageTaskMetric {
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
}

export interface AdminAiUsageModelMetric {
  provider: string;
  model: string | null;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  avgLatencyMs: number | null;
  failedCalls: number;
}

export interface AdminAiUsageTimeBucket {
  label: string;
  start: string;
  end: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  avgLatencyMs: number | null;
}

export interface AdminAiUsageAgentMetric {
  agent: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
}

export interface AdminAiUsageSkillMetric {
  skill: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
}

export interface AdminAiUsageUserMetric {
  userId: string;
  userName: string;
  calls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
}

export interface AdminAiUsageGarageMetric {
  garageId: string;
  garageName: string;
  garageLocation: string | null;
  calls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  uniqueUsers: number;
}

export interface AdminAiUsageToolMetric {
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
}

export interface AdminAiUsageApprovalRow {
  status: string;
  calls: number;
  share: number;
  avgDecisionSeconds: number;
}

export interface AdminAiUsageApprovalRefusal {
  totalToolCalls: number;
  approvalRequired: number;
  approvedOrExecuted: number;
  denied: number;
  expired: number;
  pending: number;
  rows: AdminAiUsageApprovalRow[];
}

export interface AdminAiUsageTopCall {
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
}

export interface AdminAiUsageSourceCoverage {
  dataSource: 'persisted_tables_only' | 'gateway_usage_events';
  includesGatewayOnlySignals: {
    classifierCalls: boolean;
    conversationTitles: boolean;
    rawGatewayLatency: boolean;
  };
  rowCoverage: {
    assistantMessagesScanned?: number;
    gatewayEventsScanned?: number;
    assistantToolCallsScanned: number;
    messagesWithoutModel?: number;
    messagesWithoutPurpose?: number;
    messagesWithoutTokens?: number;
    eventsWithoutModel?: number;
    eventsWithoutPurpose?: number;
    eventsWithoutTokens?: number;
    eventsWithoutContext?: number;
  };
}

export interface AdminAiUsageDashboard {
  generatedAt: string;
  range: AdminAiUsageRangeWindow;
  summary: AdminAiUsageSummary;
  taskUsage: AdminAiUsageTaskMetric[];
  modelUsage: AdminAiUsageModelMetric[];
  timeBuckets: AdminAiUsageTimeBucket[];
  agentUsage: AdminAiUsageAgentMetric[];
  skillUsage: AdminAiUsageSkillMetric[];
  userUsage: AdminAiUsageUserMetric[];
  garageUsage: AdminAiUsageGarageMetric[];
  toolUsage: AdminAiUsageToolMetric[];
  approvalRefusal: AdminAiUsageApprovalRefusal;
  topExpensiveCalls: AdminAiUsageTopCall[];
  sourceCoverage: AdminAiUsageSourceCoverage;
}
