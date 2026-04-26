import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicingService } from '../../../invoicing/invoicing.service';
import { ToolRegistryService } from '../../tool-registry.service';
import { buildListInvoicesTool } from './list-invoices.tool';
import { buildGetInvoiceTool } from './get-invoice.tool';
import { buildListOverdueInvoicesTool } from './list-overdue-invoices.tool';
import { buildRecordPaymentTool } from './record-payment.tool';
import { buildListLowStockPartsTool } from './list-low-stock-parts.tool';
import { buildGetInventoryValueTool } from './get-inventory-value.tool';

/**
 * Registers all invoicing + inventory tools into the global tool registry on
 * NestJS module init. Kept as a thin OnModuleInit hook so adding/removing
 * tools is a one-line change here.
 */
@Injectable()
export class InvoicingInventoryToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(InvoicingInventoryToolsRegistrar.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly prisma: PrismaService,
    private readonly invoicing: InvoicingService,
  ) {}

  onModuleInit(): void {
    const tools = [
      buildListInvoicesTool(this.prisma),
      buildGetInvoiceTool(this.invoicing),
      buildListOverdueInvoicesTool(this.prisma),
      buildRecordPaymentTool(this.prisma, this.invoicing),
      buildListLowStockPartsTool(this.prisma),
      buildGetInventoryValueTool(this.prisma),
    ];

    for (const tool of tools) {
      this.registry.register(tool);
    }

    this.logger.log(
      `Registered ${tools.length} invoicing/inventory tools: ${tools
        .map((t) => t.name)
        .join(', ')}`,
    );
  }
}
