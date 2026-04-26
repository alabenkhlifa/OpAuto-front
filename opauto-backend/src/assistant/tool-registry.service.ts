import { Injectable, Logger } from '@nestjs/common';
import { AssistantUserContext, ToolDefinition, ToolDescriptor } from './types';

/**
 * Stub. Phase 1 Subagent B fills in registry, registration API, module/role
 * filtering, JSON-schema validation, and blast-tier enforcement.
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listForUser(_ctx: AssistantUserContext): ToolDescriptor[] {
    this.logger.warn('ToolRegistryService.listForUser called on stub');
    return [];
  }
}
