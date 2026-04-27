import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentRunnerService } from '../agent-runner.service';
import { AgentDefinition } from '../types';
import { createAnalyticsAgent } from './analytics-agent';
import { createCommunicationsAgent } from './communications-agent';
import { createGrowthAgent } from './growth-agent';
import { createInventoryAgent } from './inventory-agent';
import { createSchedulingAgent } from './scheduling-agent';
import { createFinanceAgent } from './finance-agent';

/**
 * Registers all v1 sub-agents with AgentRunnerService at module init. Mirrors
 * the per-domain tool registrar pattern so the agent catalog can grow without
 * touching the parent AssistantModule wiring.
 */
@Injectable()
export class AgentsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(AgentsRegistrar.name);

  constructor(private readonly runner: AgentRunnerService) {}

  onModuleInit(): void {
    const agents: AgentDefinition[] = [
      createAnalyticsAgent(),
      createCommunicationsAgent(),
      createGrowthAgent(),
      createInventoryAgent(),
      createSchedulingAgent(),
      createFinanceAgent(),
    ];

    for (const agent of agents) {
      this.runner.register(agent);
    }

    this.logger.log(`Registered ${agents.length} assistant agents`);
  }
}
