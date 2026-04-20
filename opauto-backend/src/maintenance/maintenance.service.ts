import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
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
      include: { car: { include: { customer: true } }, employee: true, tasks: true, photos: true, approvals: true },
    });
    if (!job) throw new NotFoundException('Maintenance job not found');
    return job;
  }

  async create(garageId: string, dto: CreateMaintenanceDto) {
    return this.prisma.maintenanceJob.create({
      data: { ...dto, garageId },
      include: {
        car: {
          select: { make: true, model: true, year: true, licensePlate: true, mileage: true, customer: { select: { id: true, firstName: true, lastName: true } } },
        },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, garageId: string, dto: UpdateMaintenanceDto) {
    await this.findOne(id, garageId);
    return this.prisma.maintenanceJob.update({
      where: { id },
      data: dto,
      include: {
        car: {
          select: { make: true, model: true, year: true, licensePlate: true, mileage: true, customer: { select: { id: true, firstName: true, lastName: true } } },
        },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.maintenanceJob.delete({ where: { id } });
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
}
