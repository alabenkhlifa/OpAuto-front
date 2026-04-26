import { Injectable, Logger } from '@nestjs/common';
import { AgentDefinition, AssistantUserContext } from './types';

/**
 * Stub. Phase 1 Subagent D implements the sub-agent loop reusing the
 * orchestrator iteration but with isolated state and a tool whitelist.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
  }

  list(): { name: string; description: string }[] {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.name,
      description: a.description,
    }));
  }

  async run(
    name: string,
    _input: string,
    _ctx: AssistantUserContext,
  ): Promise<{ result: string }> {
    this.logger.warn(`AgentRunnerService.run(${name}) called on stub`);
    return { result: 'Agent runtime not yet implemented (Phase 1).' };
  }
}
