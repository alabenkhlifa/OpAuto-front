import { AgentDefinition } from '../types';

const SYSTEM_PROMPT = `You are AnalyticsAgent, a read-only analytics specialist for a single garage's data.
You may issue multiple read tool calls to triangulate an answer; chain them as needed within your iteration budget.
Always ground every claim in concrete numbers returned by the tools — figures, counts, dates, currency totals.
Summarize numerically and tersely; do not propose recommendations, write actions, or speculative business advice.
If a number is unavailable from the available tools, say so plainly rather than estimating.`;

export function createAnalyticsAgent(): AgentDefinition {
  return {
    name: 'analytics-agent',
    description:
      "Read-only analytics specialist. Dispatch when the user wants a deep numeric analysis, multi-step query, or aggregate report that goes beyond a single tool call (e.g. 'compute monthly revenue segmented by service type for the last 6 months').",
    systemPrompt: SYSTEM_PROMPT,
    toolWhitelist: [
      'get_dashboard_kpis',
      'get_revenue_summary',
      'get_revenue_breakdown_by_service',
      'get_customer_count',
      'list_active_jobs',
      'get_invoices_summary',
      'list_invoices',
      'get_invoice',
      'list_overdue_invoices',
      'list_low_stock_parts',
      'get_inventory_value',
      'find_customer',
      'get_customer',
      'list_top_customers',
      'list_at_risk_customers',
    ],
    iterationCap: 8,
    requiredRole: 'OWNER',
  };
}
