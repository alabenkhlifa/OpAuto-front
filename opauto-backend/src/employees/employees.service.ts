import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.employee.findMany({
      where: { garageId },
      include: { _count: { select: { appointments: true, maintenanceJobs: true } } },
      orderBy: { firstName: 'asc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, garageId },
      include: { appointments: { orderBy: { startTime: 'desc' }, take: 10 }, maintenanceJobs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async create(garageId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({ data: { ...dto, garageId, hireDate: new Date(dto.hireDate) } });
  }

  async update(id: string, garageId: string, dto: UpdateEmployeeDto) {
    await this.findOne(id, garageId);
    const data: any = { ...dto };
    if (dto.hireDate) data.hireDate = new Date(dto.hireDate);
    return this.prisma.employee.update({ where: { id }, data });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.employee.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
