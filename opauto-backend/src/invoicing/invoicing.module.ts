import { Module, forwardRef } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { CreditNotesService } from './credit-notes.service';
import { CreditNotesController } from './credit-notes.controller';
import { FromJobService } from './from-job.service';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { PaymentsController } from './payments.controller';
import { PdfRendererService } from './pdf-renderer.service';
import { DeliveryService } from './delivery.service';
import { EmailModule } from '../email/email.module';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [EmailModule, forwardRef(() => PublicModule)],
  controllers: [
    InvoicingController,
    CreditNotesController,
    QuotesController,
    PaymentsController,
  ],
  providers: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
    FromJobService,
    QuotesService,
    PdfRendererService,
    DeliveryService,
  ],
  exports: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
    FromJobService,
    QuotesService,
    PdfRendererService,
    DeliveryService,
  ],
})
export class InvoicingModule {}
