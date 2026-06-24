import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateMaintenanceJobPartDto } from './dto/create-maintenance-job-part.dto';
import { UpdateMaintenanceJobPartDto } from './dto/update-maintenance-job-part.dto';
import { CreateMaintenanceJobApprovalDto } from './dto/create-maintenance-job-approval.dto';
import { RespondMaintenanceJobApprovalDto } from './dto/respond-maintenance-job-approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';
import { InvoiceTokenService } from '../public/invoice-token.service';
import { EmailService } from '../email/email.service';
import { createReadStream } from 'fs';
import type { Response } from 'express';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@Controller('maintenance')
export class MaintenanceController {
  private readonly logger = new Logger(MaintenanceController.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly service: MaintenanceService,
    private readonly tokens: InvoiceTokenService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl =
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:4200';
  }

  @Get() findAll(@CurrentUser('garageId') gid: string) {
    return this.service.findAll(gid);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.findOne(id, gid);
  }

  @Post() @RequireModule('maintenance')
  create(@CurrentUser('garageId') gid: string, @Body() dto: CreateMaintenanceDto) {
    return this.service.create(gid, dto);
  }

  @Put(':id') @RequireModule('maintenance')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.service.update(id, gid, dto);
  }

  @Delete(':id') @RequireModule('maintenance') remove(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
  ) {
    return this.service.remove(id, gid);
  }

  // ── Tasks ────────────────────────────────────────────────────────
  @Post(':jobId/tasks') @RequireModule('maintenance')
  addTask(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.addTask(jobId, gid, dto);
  }

  @Put(':jobId/tasks/:taskId') @RequireModule('maintenance')
  updateTask(
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.updateTask(jobId, taskId, gid, dto);
  }

  @Delete(':jobId/tasks/:taskId') @RequireModule('maintenance')
  removeTask(
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
    @CurrentUser('garageId') gid: string,
  ) {
    return this.service.removeTask(jobId, taskId, gid);
  }

  // ── Parts / line-items ────────────────────────────────────────
  @Get(':jobId/parts') @RequireModule('maintenance')
  listParts(@Param('jobId') jobId: string, @CurrentUser('garageId') gid: string) {
    return this.service.listParts(jobId, gid);
  }

  @Post(':jobId/parts') @RequireModule('maintenance')
  addPartLine(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: CreateMaintenanceJobPartDto,
  ) {
    return this.service.addPartLine(jobId, gid, dto);
  }

  @Put(':jobId/parts/:lineId') @RequireModule('maintenance')
  updatePartLine(
    @Param('jobId') jobId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: UpdateMaintenanceJobPartDto,
  ) {
    return this.service.updatePartLine(jobId, lineId, gid, dto);
  }

  @Delete(':jobId/parts/:lineId') @RequireModule('maintenance')
  removePartLine(
    @Param('jobId') jobId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('garageId') gid: string,
  ) {
    return this.service.removePartLine(jobId, lineId, gid);
  }

  // ── Approval requests ─────────────────────────────────────────
  @Get(':jobId/approvals') @RequireModule('maintenance')
  listApprovals(@Param('jobId') jobId: string, @CurrentUser('garageId') gid: string) {
    return this.service.listApprovals(jobId, gid);
  }

  @Post(':jobId/approvals') @RequireModule('maintenance')
  async createApprovalRequest(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') uid: string,
    @CurrentUser('email') userEmail: string | undefined,
    @Body() dto: CreateMaintenanceJobApprovalDto,
  ) {
    const job = await this.service.findOne(jobId, gid);
    const customer = job?.car?.customer;
    const enrichedDto: CreateMaintenanceJobApprovalDto = {
      ...dto,
      customerName: dto.customerName ?? this.customerName(job) ?? undefined,
      customerEmail: dto.customerEmail ?? customer?.email ?? undefined,
      customerPhone: dto.customerPhone ?? customer?.phone ?? undefined,
      sendVia: dto.sendVia ?? this.normalizeSendVia(dto.sentVia),
    };

    const request = await this.service.createApprovalRequest(jobId, gid, uid, enrichedDto);
    const publicToken = this.tokens.sign(request.id, 'jobApproval');
    const publicUrl = this.buildPublicUrl(publicToken);
    const emailDelivery = await this.sendApprovalEmail({
      job,
      request,
      dto: enrichedDto,
      publicUrl,
      replyTo: userEmail,
    });

    return {
      ...request,
      customerName: enrichedDto.customerName,
      customerEmail: enrichedDto.customerEmail,
      customerPhone: enrichedDto.customerPhone,
      sendVia: enrichedDto.sendVia,
      sentVia: enrichedDto.sentVia,
      publicToken,
      publicUrl,
      emailDelivery,
    };
  }

  private async sendApprovalEmail(opts: {
    job: any;
    request: any;
    dto: CreateMaintenanceJobApprovalDto;
    publicUrl: string;
    replyTo?: string;
  }) {
    if (!this.shouldSendEmail(opts.dto)) {
      return { attempted: false, status: 'not_requested' };
    }

    const to = opts.dto.customerEmail?.trim() ?? '';
    if (!this.isValidEmail(to)) {
      return {
        attempted: false,
        status: 'skipped',
        reason: 'missing_customer_email',
      };
    }

    const car = this.carLabel(opts.job);
    const amount = this.toNumber(
      opts.request.requestedAmount ??
        opts.dto.requestedAmount ??
        opts.dto.estimatedPrice ??
        this.estimateTotal(opts.job),
    );
    const subject = `Maintenance approval request${car ? ` for ${car}` : ''}`;
    const name = opts.dto.customerName || this.customerName(opts.job) || 'there';
    const summary =
      opts.request.summary ??
      opts.dto.summary ??
      opts.dto.description ??
      'Please review and approve the requested maintenance work.';
    const note = opts.dto.note ?? opts.dto.comments;

    try {
      const result = await this.email.send({
        to,
        subject,
        html: this.buildApprovalEmailHtml({
          name,
          car,
          amount,
          summary,
          note,
          publicUrl: opts.publicUrl,
        }),
        text: this.buildApprovalEmailText({
          name,
          car,
          amount,
          summary,
          note,
          publicUrl: opts.publicUrl,
        }),
        replyTo: opts.replyTo,
      });

      return {
        attempted: true,
        status: result.status,
        to,
        providerMessageId: result.providerMessageId,
        subject,
        publicUrl: opts.publicUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Approval email send failed to=${to}: ${message}`);
      return {
        attempted: true,
        status: 'failed',
        to,
        subject,
        publicUrl: opts.publicUrl,
        error: message,
      };
    }
  }

  private shouldSendEmail(dto: CreateMaintenanceJobApprovalDto): boolean {
    if (dto.sendVia === 'email' || dto.sendVia === 'both') return true;
    return Array.isArray(dto.sentVia) && dto.sentVia.includes('email');
  }

  private normalizeSendVia(sentVia?: string[]) {
    if (!sentVia?.length) return 'none' as const;
    const hasEmail = sentVia.includes('email');
    const hasSms = sentVia.includes('sms');
    if (hasEmail && hasSms) return 'both' as const;
    if (hasEmail) return 'email' as const;
    if (hasSms) return 'sms' as const;
    return 'none' as const;
  }

  private buildPublicUrl(token: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/public/job-approvals/${token}`;
  }

  private customerName(job: any): string {
    const customer = job?.car?.customer;
    return `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim();
  }

  private carLabel(job: any): string {
    const car = job?.car;
    return [
      car?.year,
      car?.make,
      car?.model,
      car?.licensePlate ? `(${car.licensePlate})` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private estimateTotal(job: any): number {
    const lines = Array.isArray(job?.parts) ? job.parts : [];
    return lines.reduce((sum: number, line: any) => {
      const quantity = this.toNumber(line?.quantity) || 1;
      const unitPrice = this.toNumber(line?.unitPrice);
      const tvaRate = this.toNumber(line?.tvaRate);
      const discountPct = this.toNumber(line?.discountPct);
      const base = quantity * unitPrice;
      const discounted = base * (1 - discountPct / 100);
      return sum + discounted * (1 + tvaRate / 100);
    }, 0);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value && typeof (value as any).toNumber === 'function') {
      return (value as any).toNumber();
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatTnd(value: number): string {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} TND`;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildApprovalEmailHtml(opts: {
    name: string;
    car: string;
    amount: number;
    summary: string;
    note?: string;
    publicUrl: string;
  }): string {
    const safeName = this.escapeHtml(opts.name);
    const safeCar = this.escapeHtml(opts.car || 'your vehicle');
    const safeSummary = this.escapeHtml(opts.summary);
    const safeNote = opts.note?.trim() ? this.escapeHtml(opts.note.trim()) : '';
    const safeUrl = this.escapeHtml(opts.publicUrl);

    return [
      '<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;max-width:640px;">',
      `<p>Hello ${safeName},</p>`,
      `<p>We inspected ${safeCar}. Please review the requested maintenance approval below.</p>`,
      `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;background:#f9fafb;">`,
      `<p style="margin:0 0 8px;"><strong>Request summary</strong></p>`,
      `<p style="margin:0 0 12px;">${safeSummary}</p>`,
      `<p style="margin:0;"><strong>Estimated total:</strong> ${this.escapeHtml(this.formatTnd(opts.amount))}</p>`,
      '</div>',
      safeNote ? `<p>${safeNote}</p>` : '',
      `<p><a href="${safeUrl}" style="display:inline-block;background:#f28c28;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold;">Review and approve</a></p>`,
      `<p style="font-size:13px;color:#6b7280;">If the button does not work, copy this link:<br><a href="${safeUrl}">${safeUrl}</a></p>`,
      '<p>Thank you.</p>',
      '</div>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildApprovalEmailText(opts: {
    name: string;
    car: string;
    amount: number;
    summary: string;
    note?: string;
    publicUrl: string;
  }): string {
    const note = opts.note?.trim() ? `\n\n${opts.note.trim()}` : '';
    return [
      `Hello ${opts.name},`,
      '',
      `We inspected ${opts.car || 'your vehicle'}. Please review the requested maintenance approval below.`,
      '',
      opts.summary,
      '',
      `Estimated total: ${this.formatTnd(opts.amount)}${note}`,
      '',
      `Review and approve here: ${opts.publicUrl}`,
      '',
      'Thank you.',
    ].join('\n');
  }

  @Post(':jobId/approvals/:approvalId/owner-response') @RequireModule('maintenance')
  ownerRespondApproval(
    @Param('jobId') jobId: string,
    @Param('approvalId') approvalId: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') uid: string,
    @Body() dto: RespondMaintenanceJobApprovalDto,
  ) {
    return this.service.ownerRespondToApproval(
      jobId,
      approvalId,
      gid,
      uid,
      dto,
    );
  }

  @Post(':jobId/approvals/:approvalId/response') @RequireModule('maintenance')
  ownerRespondApprovalAlias(
    @Param('jobId') jobId: string,
    @Param('approvalId') approvalId: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') uid: string,
    @Body() dto: RespondMaintenanceJobApprovalDto,
  ) {
    return this.ownerRespondApproval(jobId, approvalId, gid, uid, dto);
  }

  // ── Photos ────────────────────────────────────────────────────────
  @Post(':jobId/photos') @RequireModule('maintenance')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPhoto(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') uid: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: { caption?: string; type?: string },
  ) {
    return this.service.addPhoto(jobId, gid, uid, file, meta);
  }

  @Get(':jobId/photos')
  listPhotos(@Param('jobId') jobId: string, @CurrentUser('garageId') gid: string) {
    return this.service.listPhotos(jobId, gid);
  }

  @Get(':jobId/photos/:photoId/file')
  async getPhotoFile(
    @Param('jobId') jobId: string,
    @Param('photoId') photoId: string,
    @CurrentUser('garageId') gid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fullPath, mimeType, originalName } = await this.service.getPhotoFile(
      jobId,
      photoId,
      gid,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${originalName || 'photo'}"`,
    });
    return new StreamableFile(createReadStream(fullPath));
  }

  @Delete(':jobId/photos/:photoId') @RequireModule('maintenance')
  removePhoto(
    @Param('jobId') jobId: string,
    @Param('photoId') photoId: string,
    @CurrentUser('garageId') gid: string,
  ) {
    return this.service.removePhoto(jobId, photoId, gid);
  }
}
