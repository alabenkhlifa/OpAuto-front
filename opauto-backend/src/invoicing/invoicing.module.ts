import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { CreditNotesService } from './credit-notes.service';
import { CreditNotesController } from './credit-notes.controller';
import { FromJobService } from './from-job.service';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';

@Module({
  controllers: [InvoicingController, CreditNotesController, QuotesController],
  providers: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
    FromJobService,
    QuotesService,
  ],
  exports: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
    FromJobService,
    QuotesService,
  ],
})
export class InvoicingModule {}
