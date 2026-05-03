import { AgentRunnerService } from '../agent-runner.service';
import { AgentDefinition } from '../types';
import { createAnalyticsAgent } from './analytics-agent';
import { createCommunicationsAgent } from './communications-agent';
import { createGrowthAgent } from './growth-agent';
import { createFinanceAgent } from './finance-agent';
import { AgentsRegistrar } from './agents.registrar';

function assertCommonShape(agent: AgentDefinition): void {
  expect(agent.iterationCap).toBeGreaterThan(0);
  expect(agent.requiredRole).toBe('OWNER');
  expect(Array.isArray(agent.toolWhitelist)).toBe(true);
  expect(agent.toolWhitelist.length).toBeGreaterThan(0);
  for (const name of agent.toolWhitelist) {
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  }
  expect(typeof agent.systemPrompt).toBe('string');
  expect(agent.systemPrompt.length).toBeGreaterThanOrEqual(100);
  // Should not end with a stray markdown fence or yaml marker.
  expect(agent.systemPrompt.trimEnd()).not.toMatch(/(```|---)$/);
  expect(typeof agent.description).toBe('string');
  expect(agent.description.length).toBeGreaterThan(0);
}

describe('assistant agents', () => {
  describe('createAnalyticsAgent', () => {
    it('returns an OWNER-only read-only specialist with iteration cap 8', () => {
      const agent = createAnalyticsAgent();
      expect(agent.name).toBe('analytics-agent');
      expect(agent.iterationCap).toBe(8);
      assertCommonShape(agent);
    });

    it('whitelists only read tools (no write tool names)', () => {
      const agent = createAnalyticsAgent();
      const writeIndicators = ['send_', 'create_', 'cancel_', 'record_', 'update_', 'delete_'];
      for (const tool of agent.toolWhitelist) {
        for (const prefix of writeIndicators) {
          expect(tool.startsWith(prefix)).toBe(false);
        }
      }
    });

    it('whitelists the revenue-breakdown-by-service tool so segmentation queries work', () => {
      const agent = createAnalyticsAgent();
      expect(agent.toolWhitelist).toContain('get_revenue_breakdown_by_service');
    });
  });

  describe('createCommunicationsAgent', () => {
    it('returns an OWNER-only drafter with iteration cap 5', () => {
      const agent = createCommunicationsAgent();
      expect(agent.name).toBe('communications-agent');
      expect(agent.iterationCap).toBe(5);
      assertCommonShape(agent);
    });

    it('does not include send_sms or send_email — write tools require approval via the orchestrator', () => {
      const agent = createCommunicationsAgent();
      expect(agent.toolWhitelist).not.toContain('send_sms');
      expect(agent.toolWhitelist).not.toContain('send_email');
    });
  });

  describe('createGrowthAgent', () => {
    it('returns an OWNER-only strategist with iteration cap 10', () => {
      const agent = createGrowthAgent();
      expect(agent.name).toBe('growth-agent');
      expect(agent.iterationCap).toBe(10);
      assertCommonShape(agent);
    });

    it('whitelists at-risk + churn signal tools alongside core analytics reads', () => {
      const agent = createGrowthAgent();
      expect(agent.toolWhitelist).toEqual(
        expect.arrayContaining([
          'get_revenue_summary',
          'list_top_customers',
          'list_at_risk_customers',
          'propose_retention_action',
        ]),
      );
    });
  });

  describe('createFinanceAgent', () => {
    it('whitelists revenue tools including the breakdown-by-service tool', () => {
      const agent = createFinanceAgent();
      expect(agent.name).toBe('finance-agent');
      assertCommonShape(agent);
      expect(agent.toolWhitelist).toEqual(
        expect.arrayContaining([
          'get_revenue_summary',
          'get_revenue_breakdown_by_service',
          'list_overdue_invoices',
          'record_payment',
        ]),
      );
    });
  });

  describe('AgentsRegistrar', () => {
    it('registers exactly 6 agents on module init', () => {
      const register = jest.fn();
      const runner = { register } as unknown as AgentRunnerService;

      const registrar = new AgentsRegistrar(runner);
      registrar.onModuleInit();

      expect(register).toHaveBeenCalledTimes(6);
      const registeredNames = register.mock.calls.map(
        (args) => (args[0] as AgentDefinition).name,
      );
      expect(registeredNames).toEqual(
        expect.arrayContaining([
          'analytics-agent',
          'communications-agent',
          'growth-agent',
          'inventory-agent',
          'scheduling-agent',
          'finance-agent',
        ]),
      );
    });
  });
});
