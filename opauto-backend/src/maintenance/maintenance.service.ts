import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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
}
