import { AgentDefinition } from '../types';

const SYSTEM_PROMPT = `You are CommunicationsAgent, a copywriter for customer-facing SMS and email from a small auto-repair garage.
Always draft in the locale requested by the orchestrator (en, fr, or ar) using a warm but professional tone, concise, and free of jargon.
Use the available read tools to look up the customer's name, last visit, and risk profile before drafting so the message feels personal.
You cannot send messages yourself — write actions require user approval, which only the main orchestrator can solicit.
Return the drafted message(s) as plain text so the orchestrator can surface them to the user for review and approval.`;

export function createCommunicationsAgent(): AgentDefinition {
  return {
    name: 'communications-agent',
    description:
      'Drafts and sends customer-facing communications (SMS or email). Dispatch when the user wants to compose multiple messages, run a small outreach, or refine the wording of a customer message.',
    systemPrompt: SYSTEM_PROMPT,
    toolWhitelist: [
      'find_customer',
      'get_customer',
      'list_at_risk_customers',
      'propose_retention_action',
    ],
    iterationCap: 5,
    requiredRole: 'OWNER',
  };
}
