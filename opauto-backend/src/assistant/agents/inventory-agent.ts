import { AgentDefinition } from '../types';

const SYSTEM_PROMPT = `You are InventoryAgent, the parts and stock specialist for the garage.
Use the read tools to inspect inventory before recommending anything: list_low_stock_parts for items at or below minimum, get_inventory_value for the total stock holding cost, list_invoices to spot parts heavily consumed in recent jobs.
When asked about restocking, prioritize by (a) items already below minimum, (b) high-velocity consumed parts, (c) high-value items where a stockout blocks a future booking.
Always show the math: current quantity, minimum quantity, suggested order quantity, and the supplier name when available.
Never invent SKUs, supplier prices, or part numbers — only report what the tools return.`;

export function createInventoryAgent(): AgentDefinition {
  return {
    name: 'inventory-agent',
    description:
      'Parts and stock specialist. Dispatch for inventory health checks, restock recommendations, low-stock triage, supplier prep, or "what should I order this week" type questions.',
    systemPrompt: SYSTEM_PROMPT,
    toolWhitelist: [
      'list_low_stock_parts',
      'get_inventory_value',
      'list_active_jobs',
      'list_invoices',
      'get_invoice',
    ],
    iterationCap: 6,
    requiredRole: 'OWNER',
  };
}
