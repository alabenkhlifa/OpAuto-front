import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';

@Module({
  controllers: [InvoicingController],
  providers: [InvoicingService, NumberingService, TaxCalculatorService],
  exports: [InvoicingService, NumberingService, TaxCalculatorService],
})
export class InvoicingModule {}
