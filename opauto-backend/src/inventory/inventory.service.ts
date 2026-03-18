import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.part.findMany({ where: { garageId }, include: { supplier: { select: { name: true } } }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string, garageId: string) {
    const part = await this.prisma.part.findFirst({ where: { id, garageId }, include: { supplier: true, stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!part) throw new NotFoundException('Part not found');
    return part;
  }

  async create(garageId: string, dto: CreatePartDto) {
    return this.prisma.part.create({ data: { ...dto, garageId } });
  }

  async update(id: string, garageId: string, dto: UpdatePartDto) {
    await this.findOne(id, garageId);
    return this.prisma.part.update({ where: { id }, data: dto });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.part.delete({ where: { id } });
  }

  async adjustStock(partId: string, garageId: string, quantity: number, type: string, reason?: string) {
    await this.findOne(partId, garageId);
    await this.prisma.stockMovement.create({ data: { partId, quantity, type, reason } });
    const newQty = type === 'in' ? { increment: quantity } : type === 'out' ? { decrement: quantity } : undefined;
    if (newQty) {
      return this.prisma.part.update({ where: { id: partId }, data: { quantity: newQty } });
    }
    return this.prisma.part.update({ where: { id: partId }, data: { quantity } });
  }
}
