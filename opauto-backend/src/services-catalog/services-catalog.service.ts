import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';

/**
 * ServicesCatalogService — CRUD over the per-garage service catalog
 * (`ServiceCatalog` table). Used by quote/invoice forms to autocomplete
 * common services with a default price + TVA rate + labor hours.
 *
 * Soft delete: `DELETE` flips `isActive=false` so historical references
 * are preserved. A `?hard=true` flag triggers an actual row delete for
 * owners who need to clean up genuine mistakes.
 */
@Injectable()
export class ServicesCatalogService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string, includeInactive = false) {
    return this.prisma.serviceCatalog.findMany({
      where: includeInactive ? { garageId } : { garageId, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, garageId: string) {
    const row = await this.prisma.serviceCatalog.findFirst({
      where: { id, garageId },
    });
    if (!row) throw new NotFoundException('Service catalog entry not found');
    return row;
  }

  async create(garageId: string, dto: CreateServiceCatalogDto) {
    if (dto.defaultPrice < 0) {
      throw new BadRequestException('defaultPrice must be >= 0');
    }
    const tva = dto.defaultTvaRate ?? 19;
    if (tva < 0 || tva > 50) {
      throw new BadRequestException('defaultTvaRate must be 0..50');
    }
    try {
      return await this.prisma.serviceCatalog.create({
        data: {
          garageId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          defaultPrice: dto.defaultPrice,
          defaultLaborHours: dto.defaultLaborHours,
          defaultTvaRate: tva,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A service with code "${dto.code}" already exists in this garage`,
        );
      }
      throw err;
    }
  }

  async update(id: string, garageId: string, dto: UpdateServiceCatalogDto) {
    const existing = await this.findOne(id, garageId);
    if (dto.defaultPrice !== undefined && dto.defaultPrice < 0) {
      throw new BadRequestException('defaultPrice must be >= 0');
    }
    if (dto.defaultTvaRate !== undefined) {
      if (dto.defaultTvaRate < 0 || dto.defaultTvaRate > 50) {
        throw new BadRequestException('defaultTvaRate must be 0..50');
      }
    }
    try {
      return await this.prisma.serviceCatalog.update({
        where: { id: existing.id },
        data: dto,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A service with code "${dto.code}" already exists in this garage`,
        );
      }
      throw err;
    }
  }

  async remove(id: string, garageId: string, hard = false) {
    const existing = await this.findOne(id, garageId);
    if (hard) {
      return this.prisma.serviceCatalog.delete({ where: { id: existing.id } });
    }
    return this.prisma.serviceCatalog.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }
}
