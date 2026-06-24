import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { MaintenanceModule } from '../../../maintenance/maintenance.module';
import { InvoicingModule } from '../../../invoicing/invoicing.module';
import { PublicModule } from '../../../public/public.module';
import { EmailModule } from '../../../email/email.module';
import { MaintenanceJobToolsRegistrar } from './maintenance-job-tools.registrar';

@Module({
  imports: [
    AssistantModule,
    MaintenanceModule,
    InvoicingModule,
    PublicModule,
    EmailModule,
  ],
  providers: [MaintenanceJobToolsRegistrar],
})
export class MaintenanceJobToolsModule {}
