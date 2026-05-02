import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';

/** Default page size for the inventory list endpoint (matches the picker dropdown). */
export const INVENTORY_DEFAULT_LIMIT = 25;
/** Hard cap on `?limit=` to prevent forced full-table scans. */
export const INVENTORY_MAX_LIMIT = 100;

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * BUG-096 (Sweep C-18) — server-side search + limit on the inventory
   * list. `search` is a case-insensitive substring match across `name`
   * and `partNumber` (the two fields the part-picker also matches on).
   * Empty / whitespace `search` returns the first `limit` rows so the
   * picker dropdown still has something to show on cold open. `limit`
   * defaults to 25 and is clamped to [1, 100].
   */
  async findAll(garageId: string, search?: string, limit?: number) {
    const trimmed = (search ?? '').trim();
    const cap = this.clampLimit(limit);
    const where: any = trimmed
      ? {
          garageId,
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { partNumber: { contains: trimmed, mode: 'insensitive' } },
          ],
        }
      : { garageId };
    return this.prisma.part.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: cap,
    });
  }

  private clampLimit(limit?: number): number {
    if (limit === undefined || limit === null || Number.isNaN(limit)) {
      return INVENTORY_DEFAULT_LIMIT;
    }
    if (limit < 1) return 1;
    if (limit > INVENTORY_MAX_LIMIT) return INVENTORY_MAX_LIMIT;
    return Math.floor(limit);
  }

  async findSuppliers(garageId: string) {
    return this.prisma.supplier.findMany({ where: { garageId }, orderBy: { name: 'asc' } });
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

  async adjustStock(partId: string, garageId: string, quantity: number, type: string, reason?: string, reference?: string) {
    await this.findOne(partId, garageId);
    await this.prisma.stockMovement.create({ data: { partId, quantity, type, reason, reference } });
    const newQty = type === 'in' ? { increment: quantity } : type === 'out' ? { decrement: quantity } : undefined;
    if (newQty) {
      return this.prisma.part.update({ where: { id: partId }, data: { quantity: newQty } });
    }
    return this.prisma.part.update({ where: { id: partId }, data: { quantity } });
  }
}
