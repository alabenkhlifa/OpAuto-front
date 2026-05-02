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
/**
 * Default page size for catalog list endpoints. Picker dropdowns render
 * 25 rows; we mirror that here so a blank `?search=` returns exactly the
 * slice the picker needs without dumping the entire catalog.
 */
export const SERVICES_CATALOG_DEFAULT_LIMIT = 25;
/**
 * Hard cap on `?limit=` to prevent malicious clients from forcing a
 * full-table scan. 100 is generous for autocomplete and admin views.
 */
export const SERVICES_CATALOG_MAX_LIMIT = 100;

@Injectable()
export class ServicesCatalogService {
  constructor(private prisma: PrismaService) {}

  /**
   * BUG-096 (Sweep C-18) — server-side search + limit.
   *
   * `search` is a case-insensitive substring match across `name`, `code`,
   * and `category`. Empty / whitespace-only `search` returns the first
   * `limit` rows so the picker dropdown still works on cold open.
   * `limit` defaults to 25 and is clamped to [1, 100].
   */
  async findAll(
    garageId: string,
    includeInactive = false,
    search?: string,
    limit?: number,
  ) {
    const trimmed = (search ?? '').trim();
    const cap = this.clampLimit(limit);
    const baseWhere: any = includeInactive
      ? { garageId }
      : { garageId, isActive: true };
    const where = trimmed
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { code: { contains: trimmed, mode: 'insensitive' } },
            { category: { contains: trimmed, mode: 'insensitive' } },
          ],
        }
      : baseWhere;
    return this.prisma.serviceCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: cap,
    });
  }

  private clampLimit(limit?: number): number {
    if (limit === undefined || limit === null || Number.isNaN(limit)) {
      return SERVICES_CATALOG_DEFAULT_LIMIT;
    }
    if (limit < 1) return 1;
    if (limit > SERVICES_CATALOG_MAX_LIMIT) return SERVICES_CATALOG_MAX_LIMIT;
    return Math.floor(limit);
  }

  private clampPage(page?: number): number {
    if (page === undefined || page === null || Number.isNaN(page)) return 1;
    const floored = Math.floor(page);
    return floored >= 1 ? floored : 1;
  }

  /**
   * Sweep C-21 (S-CAT-009) — paginated catalog list for the new admin
   * UI. Returns the BE envelope `{ items, total, page, limit }` so the
   * admin page can drive its pagination footer off a stable
   * BE-authoritative count. `findMany` + `count` run inside a single
   * `prisma.$transaction([])` so the slice and total stay consistent
   * under concurrent inserts (mirrors the C-20 invoicing pattern).
   *
   * Search semantics match `findAll` — case-insensitive substring
   * match across `name` / `code` / `category`. `includeInactive=true`
   * widens the where-clause to expose soft-deleted rows so the admin
   * can restore them. `limit` is clamped `[1, 100]` (default 25);
   * `page` is clamped to `[1, ∞)` (default 1).
   */
  async findAllPaginated(
    garageId: string,
    opts: {
      includeInactive?: boolean;
      search?: string;
      limit?: number;
      page?: number;
    } = {},
  ) {
    const trimmed = (opts.search ?? '').trim();
    const cap = this.clampLimit(opts.limit);
    const page = this.clampPage(opts.page);
    const baseWhere: any = opts.includeInactive
      ? { garageId }
      : { garageId, isActive: true };
    const where = trimmed
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { code: { contains: trimmed, mode: 'insensitive' } },
            { category: { contains: trimmed, mode: 'insensitive' } },
          ],
        }
      : baseWhere;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceCatalog.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * cap,
        take: cap,
      }),
      this.prisma.serviceCatalog.count({ where }),
    ]);
    return { items, total, page, limit: cap };
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
