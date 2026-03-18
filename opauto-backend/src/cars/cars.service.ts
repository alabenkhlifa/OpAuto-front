import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.car.findMany({
      where: { garageId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const car = await this.prisma.car.findFirst({
      where: { id, garageId },
      include: {
        customer: true,
        appointments: { orderBy: { startTime: 'desc' }, take: 10 },
        maintenanceJobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!car) throw new NotFoundException('Car not found');
    return car;
  }

  async create(garageId: string, dto: CreateCarDto) {
    return this.prisma.car.create({ data: { ...dto, garageId } });
  }

  async update(id: string, garageId: string, dto: UpdateCarDto) {
    await this.findOne(id, garageId);
    return this.prisma.car.update({ where: { id }, data: dto });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.car.delete({ where: { id } });
  }
}
