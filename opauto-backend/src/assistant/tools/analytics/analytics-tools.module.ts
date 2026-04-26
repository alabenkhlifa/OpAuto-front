import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { ReportsModule } from '../../../reports/reports.module';
import { AnalyticsToolsRegistrar } from './analytics-tools.registrar';

/**
 * Read-only analytics tools (OWNER-only) for the AI assistant.
 *
 * AssistantModule re-exports ToolRegistryService, so importing it here is the
 * cleanest way to get the registry without a forwardRef. PrismaModule is
 * @Global so PrismaService is available without an import.
 *
 * The parent AssistantModule does NOT import this sub-module — that wiring is
 * added separately once all Phase 2 tool registrars exist, to avoid a cyclic
 * import while the catalog is being built piece by piece.
 */
@Module({
  imports: [AssistantModule, ReportsModule],
  providers: [AnalyticsToolsRegistrar],
})
export class AnalyticsToolsModule {}
