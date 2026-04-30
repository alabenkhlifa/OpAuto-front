import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoicingService } from './invoicing.service';
import { FromJobService } from './from-job.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { CreateFromJobDto } from './dto/create-from-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

/**
 * Phase 3.1 — multi-role unlock:
 *   STAFF can read, create, edit, issue, and create-from-job.
 *   OWNER-only: DELETE /invoices/:id (issued invoices reject delete
 *   regardless of role; the OWNER guard is for the DRAFT/CANCELLED case).
 *   Payments live in PaymentsController so STAFF can record cash without
 *   inheriting the (in future) tighter invoice-edit policies.
 */
@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER, UserRole.STAFF)
@Controller('invoices')
export class InvoicingController {
  constructor(
    private service: InvoicingService,
    private fromJob: FromJobService,
  ) {}

  @Get()
  findAll(@CurrentUser('garageId') gid: string) {
    return this.service.findAll(gid);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.findOne(id, gid);
  }

  @Post()
  @RequireModule('invoicing')
  create(
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(gid, dto, { userId, role });
  }

  @Put(':id')
  @RequireModule('invoicing')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(id, gid, dto, { userId, role });
  }

  @Post(':id/issue')
  @RequireModule('invoicing')
  issue(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') userId: string,
    @Body() _dto: IssueInvoiceDto,
  ) {
    return this.service.issue(id, gid, userId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @RequireModule('invoicing')
  remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.remove(id, gid);
  }

  /**
   * Convert a maintenance job to a DRAFT invoice. The route returns the
   * freshly-created invoice; subsequent edits use the standard
   * `PUT /invoices/:id` and `POST /invoices/:id/issue` endpoints.
   */
  @Post('from-job/:jobId')
  @RequireModule('invoicing')
  createFromJob(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: CreateFromJobDto,
  ) {
    return this.fromJob.createFromJob(jobId, gid, dto ?? {});
  }
}
