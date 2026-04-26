import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReportsService } from '../../../reports/reports.service';
import { ToolRegistryService } from '../../tool-registry.service';
import { ToolDefinition } from '../../types';
import { buildGetDashboardKpisTool } from './dashboard-kpis.tool';
import { buildGetRevenueSummaryTool } from './revenue-summary.tool';
import { buildGetCustomerCountTool } from './customer-count.tool';
import { buildListActiveJobsTool } from './active-jobs.tool';
import { buildGetInvoicesSummaryTool } from './invoices-summary.tool';

/**
 * Registers all analytics tools (read, OWNER-only) with the assistant tool
 * registry at module init. Lives in a sub-module so the tool catalog can grow
 * without bloating AssistantModule.
 */
@Injectable()
export class AnalyticsToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsToolsRegistrar.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const tools: ToolDefinition[] = [
      buildGetDashboardKpisTool(this.reports) as ToolDefinition,
      buildGetRevenueSummaryTool(this.prisma) as ToolDefinition,
      buildGetCustomerCountTool(this.prisma) as ToolDefinition,
      buildListActiveJobsTool(this.prisma) as ToolDefinition,
      buildGetInvoicesSummaryTool(this.prisma) as ToolDefinition,
    ];

    for (const tool of tools) {
      this.toolRegistry.register(tool);
    }

    this.logger.log(`Registered ${tools.length} analytics tools`);
  }
}
