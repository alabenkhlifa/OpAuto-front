import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service';
import { SkillRegistryService } from '../../skill-registry.service';
import { AgentRunnerService } from '../../agent-runner.service';
import { SmsService } from '../../../sms/sms.service';
import { EmailService } from '../../../email/email.service';
import { CustomersService } from '../../../customers/customers.service';
import { AiActionsService } from '../../../ai-actions/ai-actions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { createSendSmsTool } from './send-sms.tool';
import { createSendEmailTool } from './send-email.tool';
import { createProposeRetentionActionTool } from './propose-retention-action.tool';

/**
 * Registers the communications tool family on module init. Each tool is
 * created via a factory so dependencies can be unit-tested in isolation
 * (factories accept plain deps; the registrar wires real Nest providers).
 */
@Injectable()
export class CommunicationsToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(CommunicationsToolsRegistrar.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly skills: SkillRegistryService,
    private readonly agents: AgentRunnerService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly customersService: CustomersService,
    private readonly aiActionsService: AiActionsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      createSendSmsTool({
        smsService: this.smsService,
        customersService: this.customersService,
      }),
    );
    this.registry.register(
      createSendEmailTool({
        emailService: this.emailService,
        prisma: this.prisma,
        getKnownNames: () => this.collectKnownNames(),
      }),
    );
    this.registry.register(
      createProposeRetentionActionTool({
        aiActionsService: this.aiActionsService,
      }),
    );
    this.logger.log('Registered communications tools (send_sms, send_email, propose_retention_action)');
  }

  /**
   * Snapshot every name the LLM is allowed to invoke this turn — real tools,
   * skills, agents, plus the two reserved pseudo-tools the orchestrator
   * intercepts (`load_skill`, `dispatch_agent`). Cached per-call (cheap; sets
   * are tiny) so the leak detector sees the live registry, not a stale copy.
   */
  private collectKnownNames(): ReadonlySet<string> {
    const names = new Set<string>();
    for (const n of this.registry.listAllNames()) names.add(n);
    for (const s of this.skills.listAll()) names.add(s.name);
    for (const a of this.agents.list()) names.add(a.name);
    names.add('load_skill');
    names.add('dispatch_agent');
    return names;
  }
}
