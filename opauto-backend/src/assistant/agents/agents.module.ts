import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant.module';
import { AgentsRegistrar } from './agents.registrar';

/**
 * Registers the v1 sub-agents (analytics, communications, growth) with the
 * AgentRunnerService. AssistantModule re-exports AgentRunnerService, so
 * importing it here is the cleanest way to get the runner without a
 * forwardRef.
 *
 * The parent AssistantModule does NOT import this sub-module — that wiring is
 * added separately once the agent catalog is ready, mirroring the per-domain
 * tool sub-module pattern and avoiding a cyclic import.
 */
@Module({
  imports: [AssistantModule],
  providers: [AgentsRegistrar],
})
export class AgentsModule {}
