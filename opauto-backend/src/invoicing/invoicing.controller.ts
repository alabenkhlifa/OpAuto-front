import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client';
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
   *
   * S-PERF-001 (Sweep C-20) — server-side pagination via `?page=` /
   * `?limit=`. Defaults: page=1, limit=25. `limit` is clamped to
   * [1, 100] and `page` to [1, ∞) so callers cannot force full-table
   * scans. The response shape is now an envelope —
   * `{ items, total, page, limit }` — with `total` reflecting the
   * post-search row count (i.e. search filters are applied BEFORE
   * pagination). NaN / invalid values fall back to defaults.
   *
   * Sweep C-24 — server-side `?status=` / `?paymentMethod=` filters +
   * `?sort=` / `?dir=` ordering. All four params are optional and
   * combine with `?search=` via AND in the WHERE clause so the count
   * (and therefore the FE pagination footer) reflects the filtered
   * total. Unknown enum / sort / dir values throw 400 — never silently
   * default — so a typo'd UI state surfaces loudly instead of lying
   * about the result count. `paymentMethod` filters by *any* recorded
   * payment matching that method (the Invoice model has no direct
   * paymentMethod column; it's derived from the Payments relation).
   */
  @Get()
  findAll(
    @CurrentUser('garageId') gid: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
  ) {
    return this.service.findAll(gid, {
      search,
      page: parsePage(page),
      limit: parseLimit(limit),
      status: parseStatus(status),
      paymentMethod: parsePaymentMethod(paymentMethod),
      sort: parseSort(sort),
      dir: parseDir(dir),
    });
  }

  /**
   * S-PERF-005 (Sweep C-22) — dev-only PDF LRU cache observability.
   * Exposes hit/miss counters from `PdfRendererService` so the
   * `perf-cache-hitratio.ts` benchmark can compute the steady-state
   * hit ratio without intrusive log scraping.
   *
   * Hard-gated to non-production environments: `NODE_ENV === 'production'`
   * surfaces a 404 (NotFoundException) so the route is invisible in prod.
   * Owner-only via the controller-level `@Roles(OWNER, STAFF)` plus an
   * explicit `@Roles(OWNER)` override.
   *
   * Note: this route is registered BEFORE `@Get(':id')` so the
   * literal `_debug/pdf-cache-stats` segment doesn't collide with the
   * id-param route. Optional `?reset=true` zeroes the counters in place
   * (used by the bench script to start from a known state).
   */
  @Get('_debug/pdf-cache-stats')
  @Roles(UserRole.OWNER)
  pdfCacheStats(@Query('reset') reset?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (reset === 'true' || reset === '1') {
      this.pdf.resetCacheStats();
    }
    return this.pdf.getCacheStats();
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

/**
 * S-PERF-001 (Sweep C-20) — query-param coercion for pagination.
 * Both helpers are tolerant of `undefined`, NaN, decimals, and
 * negatives so a malformed query string never throws — instead the
 * service receives sane defaults.
 */
const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 25;
const LIMIT_MAX = 100;

function parsePage(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return PAGE_DEFAULT;
  const floored = Math.floor(n);
  return floored >= 1 ? floored : PAGE_DEFAULT;
}

function parseLimit(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return LIMIT_DEFAULT;
  const floored = Math.floor(n);
  if (floored < 1) return LIMIT_DEFAULT;
  if (floored > LIMIT_MAX) return LIMIT_MAX;
  return floored;
}

/**
 * Sweep C-24 — strict-validation parsers for the new filter / sort
 * params. Empty / undefined returns `undefined` (no filter); a
 * non-empty value that doesn't match the allow-list throws 400. Status
 * + paymentMethod parsing is case-insensitive so `?status=overdue` and
 * `?status=OVERDUE` both work — the FE invoice-list ships uppercase,
 * but allowing lower case keeps curl / external integrations friendly.
 */
const SORT_FIELDS = ['createdAt', 'dueDate', 'total', 'invoiceNumber'] as const;
type SortField = typeof SORT_FIELDS[number];

const DIR_VALUES = ['asc', 'desc'] as const;
type SortDir = typeof DIR_VALUES[number];

function parseStatus(raw?: string): InvoiceStatus | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const upper = String(raw).toUpperCase();
  const allowed = Object.values(InvoiceStatus) as string[];
  if (!allowed.includes(upper)) {
    throw new BadRequestException(
      `Invalid status '${raw}'. Allowed: ${allowed.join(', ')}`,
    );
  }
  return upper as InvoiceStatus;
}

function parsePaymentMethod(raw?: string): PaymentMethod | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const upper = String(raw).toUpperCase();
  const allowed = Object.values(PaymentMethod) as string[];
  if (!allowed.includes(upper)) {
    throw new BadRequestException(
      `Invalid paymentMethod '${raw}'. Allowed: ${allowed.join(', ')}`,
    );
  }
  return upper as PaymentMethod;
}

function parseSort(raw?: string): SortField | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (!SORT_FIELDS.includes(raw as SortField)) {
    throw new BadRequestException(
      `Invalid sort '${raw}'. Allowed: ${SORT_FIELDS.join(', ')}`,
    );
  }
  return raw as SortField;
}

function parseDir(raw?: string): SortDir | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const lower = String(raw).toLowerCase();
  if (!DIR_VALUES.includes(lower as SortDir)) {
    throw new BadRequestException(
      `Invalid dir '${raw}'. Allowed: ${DIR_VALUES.join(', ')}`,
    );
  }
  return lower as SortDir;
}
