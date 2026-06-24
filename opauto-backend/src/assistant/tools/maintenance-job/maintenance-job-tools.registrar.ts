import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToolRegistryService } from '../../tool-registry.service';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { FromJobService } from '../../../invoicing/from-job.service';
import { EmailService } from '../../../email/email.service';
import { InvoiceTokenService } from '../../../public/invoice-token.service';
import { ToolDefinition } from '../../types';
import { buildGetJobTool } from './get-job.tool';
import { buildAddJobPartTool } from './add-job-part.tool';
import { buildRequestJobCustomerApprovalTool } from './request-job-customer-approval.tool';
import { buildRecordJobCustomerAcceptanceTool } from './record-job-customer-acceptance.tool';
import { buildCreateInvoiceFromJobTool } from './create-invoice-from-job.tool';
import { buildSendJobCustomerApprovalEmailTool } from './send-job-customer-approval-email.tool';

@Injectable()
export class MaintenanceJobToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceJobToolsRegistrar.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly maintenanceService: MaintenanceService,
    private readonly fromJobService: FromJobService,
    private readonly emailService: EmailService,
    private readonly tokens: InvoiceTokenService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const tools: ToolDefinition[] = [
      buildGetJobTool(this.maintenanceService),
      buildAddJobPartTool(this.maintenanceService),
      buildRequestJobCustomerApprovalTool(this.maintenanceService, this.tokens),
      buildRecordJobCustomerAcceptanceTool(this.maintenanceService),
      buildCreateInvoiceFromJobTool(this.fromJobService),
      buildSendJobCustomerApprovalEmailTool(
        this.maintenanceService,
        this.emailService,
        this.tokens,
        this.config.get<string>('PUBLIC_BASE_URL') ?? '',
      ),
    ];

    for (const tool of tools) {
      this.registry.register(tool);
    }

    this.logger.log(
      `Registered ${tools.length} maintenance-job tools: ${tools
        .map((tool) => tool.name)
        .join(', ')}`,
    );
  }
}
