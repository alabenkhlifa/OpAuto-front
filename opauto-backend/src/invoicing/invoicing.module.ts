import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { NumberingService } from './numbering.service';

@Module({
  controllers: [InvoicingController],
  providers: [InvoicingService, NumberingService],
  exports: [InvoicingService, NumberingService],
})
export class InvoicingModule {}
