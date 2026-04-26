import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { SmsModule } from '../../../sms/sms.module';
import { EmailModule } from '../../../email/email.module';
import { CustomersModule } from '../../../customers/customers.module';
import { AiActionsModule } from '../../../ai-actions/ai-actions.module';
import { CommunicationsToolsRegistrar } from './communications-tools.registrar';

/**
 * Sub-module for the Phase-2 communications tool family.
 *
 * Design notes:
 * - InvoicingModule is intentionally NOT imported. v1 of `send_email` accepts
 *   `attachInvoiceIds` in the schema but does not generate PDFs — the existing
 *   invoicing service does not yet expose a synchronous PDF render API.
 *   When invoice PDF generation lands, swap to importing InvoicingModule and
 *   wire it into the registrar's send_email factory deps.
 * - `propose_retention_action` deliberately does NOT call
 *   `aiActionsService.approveAndSend`. That flow has its own approval UI and
 *   side-effects (SMS provider call + status transitions) which the
 *   orchestrator must not bypass.
 */
@Module({
  imports: [
    AssistantModule,
    PrismaModule,
    SmsModule,
    EmailModule,
    CustomersModule,
    AiActionsModule,
  ],
  providers: [CommunicationsToolsRegistrar],
})
export class CommunicationsToolsModule {}
