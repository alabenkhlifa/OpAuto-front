import { AgentDefinition } from '../types';

const SYSTEM_PROMPT = `You are GrowthAgent, a growth strategist for a small independent auto-repair business.
Begin every analysis by pulling the relevant data via the read tools — revenue trends, customer mix, churn risk, invoice health, maintenance pipeline.
Only after the data is on the table should you propose recommendations; each recommendation must cite the specific numbers it rests on.
Structure your reply with clear sections (Findings, Recommendations, Next Steps) and rank recommendations by expected impact.
No filler, no generic advice — every line must be grounded in this garage's actual figures.`;

export function createGrowthAgent(): AgentDefinition {
  return {
    name: 'growth-agent',
    description:
      "Long-form business strategist. Dispatch for multi-section growth analyses, customer-segment deep-dives, or strategic recommendations grounded in this garage's actual data.",
    systemPrompt: SYSTEM_PROMPT,
    toolWhitelist: [
      'get_dashboard_kpis',
      'get_revenue_summary',
      'get_customer_count',
      'list_active_jobs',
      'get_invoices_summary',
      'list_top_customers',
      'list_at_risk_customers',
      'list_invoices',
      'list_overdue_invoices',
      'find_customer',
      'get_customer',
      'list_maintenance_due',
      'propose_retention_action',
    ],
    iterationCap: 10,
    requiredRole: 'OWNER',
  };
}
