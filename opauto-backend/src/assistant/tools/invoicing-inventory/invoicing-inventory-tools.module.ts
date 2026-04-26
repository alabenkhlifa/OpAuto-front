import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicingModule } from '../../../invoicing/invoicing.module';
import { InventoryModule } from '../../../inventory/inventory.module';
import { InvoicingInventoryToolsRegistrar } from './invoicing-inventory-tools.registrar';

/**
 * Sub-module wiring the invoicing/inventory tool registrar into the assistant.
 * AssistantModule must be imported (not re-declared) so we share the singleton
 * ToolRegistryService instance with every other tool sub-module.
 */
@Module({
  imports: [AssistantModule, PrismaModule, InvoicingModule, InventoryModule],
  providers: [InvoicingInventoryToolsRegistrar],
})
export class InvoicingInventoryToolsModule {}
