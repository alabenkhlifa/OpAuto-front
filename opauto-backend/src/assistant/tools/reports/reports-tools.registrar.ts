import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolRegistryService } from '../../tool-registry.service';
import { ToolDefinition } from '../../types';
import { buildGenerateInvoicesPdfTool } from './generate-invoices-pdf.tool';
import { buildGeneratePeriodReportTool } from './generate-period-report.tool';

/**
 * Registers the report-generation tools (READ blast tier, OWNER-only) with
 * the assistant tool registry at module init. Both tools are v1 stubs that
 * validate inputs and return a placeholder signed URL — actual file
 * rendering is a Phase 5 hardening task.
 */
@Injectable()
export class ReportsToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ReportsToolsRegistrar.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const tools: ToolDefinition[] = [
      buildGenerateInvoicesPdfTool(this.prisma, this.logger) as ToolDefinition,
      buildGeneratePeriodReportTool(this.logger) as ToolDefinition,
    ];

    for (const tool of tools) {
      this.toolRegistry.register(tool);
    }

    this.logger.log(`Registered ${tools.length} reports tools (stubbed; real generation lands in Phase 5)`);
  }
}
