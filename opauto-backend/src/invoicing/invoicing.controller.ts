import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicingService } from './invoicing.service';
import { FromJobService } from './from-job.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { CreateFromJobDto } from './dto/create-from-job.dto';
import { DeliverDocumentDto } from './dto/deliver-document.dto';
import { DeliveryService } from './delivery.service';
import { PdfRendererService } from './pdf-renderer.service';
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
    private delivery: DeliveryService,
    private pdf: PdfRendererService,
  ) {}

  /**
   * S-PERF-002 (Sweep C-18) — server-side `?search=` filter so the
   * invoice list scales beyond the FE's pre-fetched cache. `search` is
   * a case-insensitive substring match across `invoiceNumber`,
   * customer first/last name, and license plate; empty / whitespace
   * `search` returns the full set as before so existing callers stay
   * compatible.
   */
  @Get()
  findAll(
    @CurrentUser('garageId') gid: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(gid, search);
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

  /**
   * BUG-097 (Sweep C-16) — REST contract: DELETE returns 204 No Content
   * with an empty body. The frontend `InvoiceService.deleteInvoice()`
   * already calls `http.delete<void>(...)` and ignores the body, so this
   * is a backend-side correctness fix only.
   */
  @Delete(':id')
  @Roles(UserRole.OWNER)
  @RequireModule('invoicing')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
  ): Promise<void> {
    await this.service.remove(id, gid);
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

  /**
   * Stream the rendered PDF inline. Useful for the in-app preview pane;
   * the public token-gated route is in `InvoicePublicController`.
   */
  @Get(':id/pdf')
  @RequireModule('invoicing')
  async getPdf(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Res() res: Response,
  ): Promise<void> {
    const invoice = await this.service.findOne(id, gid);
    const buf = await this.pdf.renderInvoice(id, gid);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }

  /**
   * Trigger delivery of an issued invoice via email and/or WhatsApp.
   * The PDF is rendered server-side and embedded as an attachment for
   * email; for WhatsApp the response carries a wa.me link the frontend
   * opens in a new tab. DeliveryLog rows are written for every attempt
   * (one per channel) regardless of success/failure.
   */
  @Post(':id/deliver')
  @RequireModule('invoicing')
  deliver(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: DeliverDocumentDto,
  ) {
    return this.delivery.deliverInvoice(id, gid, dto);
  }
}
