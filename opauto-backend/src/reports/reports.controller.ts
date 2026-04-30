import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ArAgingService } from './ar-aging.service';
import { CustomerStatementService } from './customer-statement.service';
import { ZReportService } from './z-report.service';
import { AccountantExportService } from './accountant-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER)
@RequireModule('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private service: ReportsService,
    private arAging: ArAgingService,
    private statements: CustomerStatementService,
    private zReport: ZReportService,
    private accountantExport: AccountantExportService,
  ) {}

  @Get('dashboard')
  getDashboardStats(@CurrentUser('garageId') gid: string) {
    return this.service.getDashboardStats(gid);
  }

  @Get('revenue')
  getRevenueByMonth(@CurrentUser('garageId') gid: string) {
    return this.service.getRevenueByMonth(gid);
  }

  /**
   * Phase 3.3 — AR aging report. JSON by default, CSV when
   * `?format=csv`. The CSV variant ships with the right headers so
   * browsers prompt a download instead of rendering inline.
   */
  @Get('ar-aging')
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getArAging(
    @CurrentUser('garageId') gid: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.arAging.generate(gid);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ar-aging-${report.asOf}.csv"`,
      );
      return this.arAging.toCsv(report);
    }
    return report;
  }

  /**
   * Phase 3.4 — customer statement (JSON only for now; PDF rendering
   * is owned by Phase 4).
   */
  @Get('customer-statement')
  @ApiQuery({ name: 'customerId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async getCustomerStatement(
    @CurrentUser('garageId') gid: string,
    @Query('customerId') customerId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!customerId) throw new BadRequestException('customerId is required');
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'from/to must be valid YYYY-MM-DD strings',
      );
    }
    return this.statements.generate(gid, customerId, fromDate, toDate);
  }

  /**
   * Phase 3.5 — daily Z-report. Defaults to "today" if no date passed.
   */
  @Get('z-report')
  @ApiQuery({ name: 'date', required: false })
  async getZReport(
    @CurrentUser('garageId') gid: string,
    @Query('date') date: string | undefined,
  ) {
    const target = date ? new Date(date) : new Date();
    if (Number.isNaN(target.getTime())) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD string');
    }
    return this.zReport.generate(gid, target);
  }

  /**
   * Phase 3.6 — monthly accountant CSV export. Always returns CSV;
   * browsers download it via the attachment Content-Disposition.
   */
  @Get('accountant-export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiQuery({ name: 'month', required: true })
  async getAccountantExport(
    @CurrentUser('garageId') gid: string,
    @Query('month') month: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!month) throw new BadRequestException('month is required (YYYY-MM)');
    const csv = await this.accountantExport.generateCsv(gid, month);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="accountant-${month}.csv"`,
    );
    return csv;
  }
}
