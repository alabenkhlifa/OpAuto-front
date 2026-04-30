import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { CreditNotesService } from './credit-notes.service';
import { CreditNotesController } from './credit-notes.controller';

@Module({
  controllers: [InvoicingController, CreditNotesController],
  providers: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
  ],
  exports: [
    InvoicingService,
    NumberingService,
    TaxCalculatorService,
    CreditNotesService,
  ],
})
export class InvoicingModule {}
