import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string, startDate?: string, endDate?: string) {
    const where: any = { garageId };
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        customer: {
          select: { firstName: true, lastName: true, phone: true },
        },
        car: { select: { make: true, model: true, licensePlate: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, garageId },
      include: { customer: true, car: true, employee: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async create(garageId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        ...dto,
        garageId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        car: { select: { make: true, model: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, garageId: string, dto: UpdateAppointmentDto) {
    await this.findOne(id, garageId);
    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);
    return this.prisma.appointment.update({ where: { id }, data });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.appointment.delete({ where: { id } });
  }
}
