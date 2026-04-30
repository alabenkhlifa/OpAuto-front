import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ArAgingService } from './ar-aging.service';
import { CustomerStatementService } from './customer-statement.service';
import { ZReportService } from './z-report.service';
import { AccountantExportService } from './accountant-export.service';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ArAgingService,
    CustomerStatementService,
    ZReportService,
    AccountantExportService,
  ],
  exports: [
    ReportsService,
    ArAgingService,
    CustomerStatementService,
    ZReportService,
    AccountantExportService,
  ],
})
export class ReportsModule {}
