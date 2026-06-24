import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateMaintenanceJobPartDto } from './dto/create-maintenance-job-part.dto';
import { UpdateMaintenanceJobPartDto } from './dto/update-maintenance-job-part.dto';
import { CreateMaintenanceJobApprovalDto } from './dto/create-maintenance-job-approval.dto';
import { RespondMaintenanceJobApprovalDto } from './dto/respond-maintenance-job-approval.dto';
import { ApprovalStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Root of the uploads dir. Lives outside the package source so it survives
// restarts and isn't bundled. Evaluated lazily (not at module load) so e2e
// tests can redirect it via process.env.UPLOAD_ROOT in beforeAll.
const uploadRoot = () => process.env.UPLOAD_ROOT || path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.maintenanceJob.findMany({
      where: { garageId },
      include: {
        car: {
          select: {
            make: true,
            model: true,
            year: true,
            licensePlate: true,
            mileage: true,
            customer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        employee: { select: { firstName: true, lastName: true } },
        _count: { select: { tasks: true, photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const job = await this.prisma.maintenanceJob.findFirst({
      where: { id, garageId },
      include: {
        car: { include: { customer: true } },
        employee: true,
        appointment: { select: { id: true, title: true, startTime: true, endTime: true } },
        tasks: true,
        photos: true,
        approvals: true,
        parts: {
          include: {
            part: { select: { id: true, name: true, partNumber: true } },
            mechanic: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        approvalRequests: true,
        timelineEvents: true,
      },
    });
    if (!job) throw new NotFoundException('Maintenance job not found');
    return job;
  }

  async create(garageId: string, dto: CreateMaintenanceDto) {
    const job = await this.prisma.maintenanceJob.create({
      data: { ...dto, garageId },
      include: {
        car: {
          select: { make: true, model: true, year: true, licensePlate: true, mileage: true, customer: { select: { id: true, firstName: true, lastName: true } } },
        },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    await this.recordTimelineEvent(job.id, 'job_created', { title: job.title });
    return job;
  }

  async update(id: string, garageId: string, dto: UpdateMaintenanceDto) {
    const existing = await this.findOne(id, garageId);
    const updated = await this.prisma.maintenanceJob.update({
      where: { id },
      data: dto,
      include: {
        car: {
          select: { make: true, model: true, year: true, licensePlate: true, mileage: true, customer: { select: { id: true, firstName: true, lastName: true } } },
        },
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.recordTimelineEvent(id, `status_${dto.status.toLowerCase()}`, {
        from: existing.status,
        to: dto.status,
      });
    }
    return updated;
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.maintenanceJob.delete({ where: { id } });
  }

  // ── Parts/lines ───────────────────────────────────────────────
  async listParts(jobId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    return this.prisma.maintenanceJobLineItem.findMany({
      where: { maintenanceJobId: jobId },
      include: {
        part: { select: { id: true, name: true, partNumber: true } },
        mechanic: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addPartLine(
    jobId: string,
    garageId: string,
    dto: CreateMaintenanceJobPartDto,
  ) {
    await this.findOne(jobId, garageId);

    const type = dto.type ?? 'part';
    const nextType = type === 'labor' ? 'labor' : 'part';

    if (nextType === 'labor' && dto.partId) {
      throw new BadRequestException('Part line cannot set partId');
    }

    let description = dto.description ?? dto.name;
    let unitPrice = dto.unitPrice;
    let partId = dto.partId ?? null;
    if (nextType === 'part') {
      if (dto.partId) {
        const part = await this.prisma.part.findFirst({
          where: { id: dto.partId, garageId },
          select: { id: true, name: true, unitPrice: true },
        });
        if (!part) throw new NotFoundException('Part not found');
        description = description ?? part.name;
        unitPrice = unitPrice ?? part.unitPrice;
      } else if (!description) {
        throw new BadRequestException('description or partId is required for part lines');
      }
    } else {
      partId = null;
    }

    const line = await this.prisma.maintenanceJobLineItem.create({
      data: {
        maintenanceJobId: jobId,
        type: nextType,
        description: description ?? (type === 'part' ? 'Part' : 'Labor'),
        quantity: dto.quantity ?? 1,
        unitPrice: unitPrice ?? 0,
        partId,
        serviceCode: dto.serviceCode,
        mechanicId: dto.mechanicId,
        laborHours: dto.laborHours,
        tvaRate: dto.tvaRate ?? 19,
        discountPct: dto.discountPct,
      },
      include: {
        part: { select: { id: true, name: true, partNumber: true } },
        mechanic: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimelineEvent(jobId, 'part_added', {
      lineId: line.id,
      partId,
      type,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      partNumber: dto.partNumber,
      supplier: dto.supplier,
      notes: dto.notes,
    });
    return line;
  }

  async updatePartLine(
    jobId: string,
    lineId: string,
    garageId: string,
    dto: UpdateMaintenanceJobPartDto,
  ) {
    await this.findOne(jobId, garageId);
    const current = await this.prisma.maintenanceJobLineItem.findFirst({
      where: { id: lineId, maintenanceJobId: jobId },
    });
    if (!current) throw new NotFoundException('Part line not found');

    const nextType = (dto.type ?? current.type) === 'labor' ? 'labor' : 'part';
    const requestedPartId = dto.partId ?? current.partId;
    let nextDescription = dto.description ?? dto.name ?? current.description;
    let nextUnitPrice = dto.unitPrice ?? current.unitPrice;

    if (nextType === 'part' && dto.partId) {
      const part = await this.prisma.part.findFirst({
        where: { id: dto.partId, garageId },
        select: { id: true, name: true, unitPrice: true },
      });
      if (!part) throw new NotFoundException('Part not found');
      if (dto.description === undefined) {
        nextDescription = part.name;
      }
      if (dto.unitPrice === undefined) {
        nextUnitPrice = part.unitPrice;
      }
    }

    if (nextType === 'part' && !requestedPartId && !nextDescription) {
      throw new BadRequestException('Part line requires description or partId');
    }

    if (nextType === 'labor' && dto.partId) {
      throw new BadRequestException('Part line cannot set partId');
    }

    const partId = nextType === 'labor' ? null : requestedPartId ?? null;

    const updated = await this.prisma.maintenanceJobLineItem.update({
      where: { id: lineId },
      data: {
        type: nextType,
        description: nextDescription,
        quantity: dto.quantity ?? current.quantity,
        unitPrice: nextUnitPrice,
        partId,
        serviceCode: dto.serviceCode ?? current.serviceCode,
        mechanicId: dto.mechanicId ?? current.mechanicId,
        laborHours: dto.laborHours ?? current.laborHours,
        tvaRate: dto.tvaRate ?? current.tvaRate,
        discountPct: dto.discountPct ?? current.discountPct,
      },
      include: {
        part: { select: { id: true, name: true, partNumber: true } },
        mechanic: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimelineEvent(jobId, 'part_updated', {
      lineId,
      partId,
      type: nextType,
      description: updated.description,
      quantity: updated.quantity,
      unitPrice: updated.unitPrice,
      partNumber: dto.partNumber,
      supplier: dto.supplier,
      notes: dto.notes,
    });
    return updated;
  }

  async removePartLine(jobId: string, lineId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    const current = await this.prisma.maintenanceJobLineItem.findFirst({
      where: { id: lineId, maintenanceJobId: jobId },
    });
    if (!current) throw new NotFoundException('Part line not found');
    await this.recordTimelineEvent(jobId, 'part_removed', { lineId });
    return this.prisma.maintenanceJobLineItem.delete({ where: { id: lineId } });
  }

  async listApprovals(jobId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    return this.prisma.maintenanceJobApprovalRequest.findMany({
      where: { maintenanceJobId: jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Timeline/events ───────────────────────────────────────────
  async listTimeline(jobId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    return this.prisma.maintenanceJobTimelineEvent.findMany({
      where: { maintenanceJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Approvals ────────────────────────────────────────────────
  async createApprovalRequest(
    jobId: string,
    garageId: string,
    requestedBy: string,
    dto: CreateMaintenanceJobApprovalDto,
  ) {
    await this.findOne(jobId, garageId);

    const requestedAmount = dto.requestedAmount ?? dto.estimatedPrice;
    const summary = dto.summary ?? dto.description;
    const note = dto.note ?? dto.comments;
    const sendVia = dto.sendVia ?? this.normalizeSendVia(dto.sentVia);

    const approval = await this.prisma.maintenanceJobApprovalRequest.create({
      data: {
        maintenanceJobId: jobId,
        requestedBy,
        requestedAmount,
        summary,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
      },
    });

    await this.recordTimelineEvent(jobId, 'approval_requested', {
      approvalId: approval.id,
      status: approval.status,
      requestedAmount,
      summary,
      type: dto.type,
      partName: dto.partName,
      urgency: dto.urgency,
      sendVia,
      note,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
    });
    return approval;
  }

  async respondToApproval(
    requestId: string,
    garageId: string,
    status: ApprovalStatus,
    payload: { responseNote?: string; responseChannel?: string; actorId?: string; force?: boolean },
  ) {
    const request = await this.prisma.maintenanceJobApprovalRequest.findFirst({
      where: { id: requestId, maintenanceJob: { garageId } },
      include: { maintenanceJob: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Approval request not found');

    if (!payload.force && request.status !== ApprovalStatus.PENDING) {
      return request;
    }

    const updated = await this.prisma.maintenanceJobApprovalRequest.update({
      where: { id: requestId },
      data: {
        status,
        responseNote: payload.responseNote ?? null,
        responseChannel: payload.responseChannel ?? null,
        respondedBy: payload.actorId ?? null,
        respondedAt: new Date(),
      },
    });
    await this.recordTimelineEvent(request.maintenanceJob.id, 'approval_responded', {
      approvalId: requestId,
      status,
      responseChannel: payload.responseChannel,
      by: payload.actorId,
    });
    return updated;
  }

  async ownerRespondToApproval(
    jobId: string,
    requestId: string,
    garageId: string,
    actorId: string,
    dto: RespondMaintenanceJobApprovalDto,
  ) {
    await this.findOne(jobId, garageId);
    const request = await this.prisma.maintenanceJobApprovalRequest.findFirst({
      where: { id: requestId, maintenanceJobId: jobId },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval request already closed');
    }

    const status = this.normalizeApprovalStatus(dto.status ?? dto.decision);
    const responseNote = dto.responseNote ?? dto.reason;
    const responseChannel = dto.responseChannel ?? dto.channel ?? 'owner';

    const updated = await this.respondToApproval(requestId, garageId, status, {
      responseNote,
      responseChannel,
      actorId,
    });

    await this.recordTimelineEvent(jobId, 'approval_owner_recorded', {
      approvalId: requestId,
      status,
      actorId,
      reviewer: dto.reviewer,
      responseChannel,
    });
    return updated;
  }

  // ── Tasks ────────────────────────────────────────────────────────
  async addTask(jobId: string, garageId: string, dto: CreateTaskDto) {
    await this.findOne(jobId, garageId);
    return this.prisma.maintenanceTask.create({
      data: { maintenanceJobId: jobId, ...dto },
    });
  }

  async updateTask(jobId: string, taskId: string, garageId: string, dto: UpdateTaskDto) {
    await this.findOne(jobId, garageId);
    const task = await this.prisma.maintenanceTask.findFirst({ where: { id: taskId, maintenanceJobId: jobId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.maintenanceTask.update({ where: { id: taskId }, data: dto });
  }

  async removeTask(jobId: string, taskId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    const task = await this.prisma.maintenanceTask.findFirst({ where: { id: taskId, maintenanceJobId: jobId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.maintenanceTask.delete({ where: { id: taskId } });
  }

  // ── Photos ───────────────────────────────────────────────────────
  /**
   * Save an uploaded file to disk under uploads/<garageId>/ and create a
   * MaintenancePhoto row. We store the filename (not the full path) and
   * serve via a guarded streaming endpoint so one garage can't hotlink
   * another garage's photos.
   */
  async addPhoto(
    jobId: string,
    garageId: string,
    uploaderId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    meta: { caption?: string; type?: string },
  ) {
    await this.findOne(jobId, garageId);
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
    }

    const dir = path.join(uploadRoot(), garageId);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, file.buffer);

    const row = await this.prisma.maintenancePhoto.create({
      data: {
        maintenanceJobId: jobId,
        // `url` kept for backward compat — the streaming route builds the
        // real URL from the id. Store the guarded path for convenience.
        url: `/api/maintenance/${jobId}/photos/placeholder/file`,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: uploaderId,
        caption: meta.caption,
        type: meta.type,
      },
    });
    // Patch url with the actual id now that we have it
    return this.prisma.maintenancePhoto.update({
      where: { id: row.id },
      data: { url: `/api/maintenance/${jobId}/photos/${row.id}/file` },
    });
  }

  async listPhotos(jobId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    return this.prisma.maintenancePhoto.findMany({
      where: { maintenanceJobId: jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPhotoFile(jobId: string, photoId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    const photo = await this.prisma.maintenancePhoto.findFirst({
      where: { id: photoId, maintenanceJobId: jobId },
    });
    if (!photo || !photo.filename) throw new NotFoundException('Photo not found');
    const fullPath = path.join(uploadRoot(), garageId, photo.filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('File missing on disk');
    return { fullPath, mimeType: photo.mimeType || 'application/octet-stream', originalName: photo.originalName };
  }

  async removePhoto(jobId: string, photoId: string, garageId: string) {
    await this.findOne(jobId, garageId);
    const photo = await this.prisma.maintenancePhoto.findFirst({
      where: { id: photoId, maintenanceJobId: jobId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.filename) {
      const fullPath = path.join(uploadRoot(), garageId, photo.filename);
      try { fs.unlinkSync(fullPath); } catch { /* file already gone is fine */ }
    }
    return this.prisma.maintenancePhoto.delete({ where: { id: photoId } });
  }

  // ── helper ───────────────────────────────────────────────────
  private async recordTimelineEvent(
    maintenanceJobId: string,
    eventType: string,
    details?: Record<string, unknown>,
    actorUserId?: string,
  ) {
    await this.prisma.maintenanceJobTimelineEvent.create({
      data: {
        maintenanceJobId,
        eventType,
        actorUserId,
        details: details ? (details as any) : undefined,
      },
    });
  }

  private normalizeApprovalStatus(status: ApprovalStatus | 'approved' | 'rejected' | undefined): ApprovalStatus {
    if (status === ApprovalStatus.APPROVED || status === 'approved') {
      return ApprovalStatus.APPROVED;
    }
    if (status === ApprovalStatus.REJECTED || status === 'rejected') {
      return ApprovalStatus.REJECTED;
    }
    throw new BadRequestException('Approval response must be approved or rejected');
  }

  private normalizeSendVia(sentVia?: Array<'call' | 'sms' | 'email'>): 'none' | 'email' | 'sms' | 'both' {
    if (!sentVia?.length) return 'none';
    const hasEmail = sentVia.includes('email');
    const hasSms = sentVia.includes('sms');
    if (hasEmail && hasSms) return 'both';
    if (hasEmail) return 'email';
    if (hasSms) return 'sms';
    return 'none';
  }
}
