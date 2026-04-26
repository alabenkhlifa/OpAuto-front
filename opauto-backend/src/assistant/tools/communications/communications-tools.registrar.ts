import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service';
import { SmsService } from '../../../sms/sms.service';
import { EmailService } from '../../../email/email.service';
import { CustomersService } from '../../../customers/customers.service';
import { AiActionsService } from '../../../ai-actions/ai-actions.service';
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
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly customersService: CustomersService,
    private readonly aiActionsService: AiActionsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      createSendSmsTool({
        smsService: this.smsService,
        customersService: this.customersService,
      }),
    );
    this.registry.register(
      createSendEmailTool({ emailService: this.emailService }),
    );
    this.registry.register(
      createProposeRetentionActionTool({
        aiActionsService: this.aiActionsService,
      }),
    );
    this.logger.log('Registered communications tools (send_sms, send_email, propose_retention_action)');
  }
}
