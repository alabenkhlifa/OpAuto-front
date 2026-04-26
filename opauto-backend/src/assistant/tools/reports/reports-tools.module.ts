import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { ReportsModule } from '../../../reports/reports.module';
import { InvoicingModule } from '../../../invoicing/invoicing.module';
import { ReportsToolsRegistrar } from './reports-tools.registrar';

/**
 * Report-generation tools (READ blast tier, OWNER-only) for the AI assistant.
 *
 * AssistantModule re-exports ToolRegistryService, so importing it here is the
 * cleanest way to get the registry without a forwardRef. PrismaModule is
 * @Global so PrismaService is available without an explicit import.
 *
 * ReportsModule + InvoicingModule are imported for symmetry with future
 * Phase 5 work that will assemble actual PDFs/CSVs from those services.
 *
 * The parent AssistantModule does NOT import this sub-module — that wiring
 * is added separately once all Phase 2 tool registrars exist, to avoid a
 * cyclic import while the catalog is being built piece by piece.
 */
@Module({
  imports: [AssistantModule, ReportsModule, InvoicingModule],
  providers: [ReportsToolsRegistrar],
})
export class ReportsToolsModule {}
