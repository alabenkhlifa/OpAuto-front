import { AgentDefinition } from '../types';

const SYSTEM_PROMPT = `You are FinanceAgent, the invoicing and revenue specialist for this garage.
You always anchor on TODAY (the date placed in the system context by the orchestrator). When the user asks about a relative window — "last 3 months", "this quarter", "since March" — translate it into explicit YYYY-MM-DD from/to dates relative to today, never to a year from your training data.
For revenue: use get_revenue_summary with from/to (or the named period if it fits). For collections: list_overdue_invoices, list_invoices(status=SENT), list_invoices(status=OVERDUE).
When summarising, always include the absolute amount, the number of invoices, and the period boundaries you used. If the tool returns 0, say so explicitly — never invent figures.
Recording payments goes through record_payment which requires typed user confirmation; surface the right invoice id and amount but let the orchestrator handle the approval.`;

export function createFinanceAgent(): AgentDefinition {
  return {
    name: 'finance-agent',
    description:
      "Invoicing, revenue, and collections specialist. Dispatch for revenue reports over arbitrary windows, overdue triage, collection prioritization, or 'who owes me what' questions.",
    systemPrompt: SYSTEM_PROMPT,
    toolWhitelist: [
      'get_revenue_summary',
      'get_revenue_breakdown_by_service',
      'get_invoices_summary',
      'list_invoices',
      'get_invoice',
      'list_overdue_invoices',
      'find_customer',
      'get_customer',
      'list_top_customers',
      'record_payment',
    ],
    iterationCap: 8,
    requiredRole: 'OWNER',
  };
}
