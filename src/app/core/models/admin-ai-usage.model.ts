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

export interface AdminAiUsageRangeOption {
  value: AdminAiUsageRange;
  label: string;
}

export interface AdminAiUsageSectionCopy {
  title: string;
  subtitle: string;
}

export interface AdminAiUsageKpiCopy {
  label: string;
  hintTemplate: string;
}

export interface AdminAiUsageDashboardCopy {
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
  rangeOptions: AdminAiUsageRangeOption[];
  kpis: {
    calls: AdminAiUsageKpiCopy;
    spend: AdminAiUsageKpiCopy;
    tokens: AdminAiUsageKpiCopy;
    latency: AdminAiUsageKpiCopy;
  };
  sections: {
    costByTask: AdminAiUsageSectionCopy;
    costShare: AdminAiUsageSectionCopy;
    trend: AdminAiUsageSectionCopy;
    modelUsage: AdminAiUsageSectionCopy;
    taskUsage: AdminAiUsageSectionCopy;
    userUsage: AdminAiUsageSectionCopy;
    garageUsage: AdminAiUsageSectionCopy;
    toolHealth: AdminAiUsageSectionCopy;
    agentUsage: AdminAiUsageSectionCopy;
    sourceCoverage: AdminAiUsageSectionCopy;
    approval: AdminAiUsageSectionCopy;
    topCalls: AdminAiUsageSectionCopy;
  };
  tableHeaders: {
    taskUsage: string[];
    agentUsage: string[];
    sourceCoverage: string[];
    approval: string[];
  };
  labels: Record<string, string>;
  units: Record<string, string>;
  booleans: Record<string, string>;
  messages: Record<string, string>;
  approvalKpis: Record<string, string>;
  statuses: Record<string, string>;
  tiers: Record<string, string>;
  purposes: Record<string, { label: string; description: string }>;
  purposeTemplates: Record<string, string>;
  sourceRows: Record<
    string,
    { label: string; statusLabel: string; tone: 'primary' | 'neutral' | 'warn' }
  >;
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
}

export interface AdminAiUsageModelMetric {
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
  label: string;
  description: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
}

export interface AdminAiUsageSkillMetric {
  skill: string;
  label: string;
  description: string;
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
}

export interface AdminAiUsageApprovalRow {
  status: string;
  label: string;
  calls: number;
  share: number;
  approvalRequired: boolean;
  approvalRequiredLabel: string;
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
}

export interface AdminAiUsageSourceCoverageRow {
  key: string;
  label: string;
  value: number;
  statusLabel: string;
  tone: 'primary' | 'neutral' | 'warn';
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
  rows?: AdminAiUsageSourceCoverageRow[];
}

export interface AdminAiUsageDashboard {
  copy: AdminAiUsageDashboardCopy;
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
