import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServicesCatalogService } from './services-catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServicesCatalogService (unit)', () => {
  const GARAGE_ID = 'garage-1';
  let service: ServicesCatalogService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      serviceCatalog: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesCatalogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ServicesCatalogService);
  });

  // ── findAll defaults to active only ─────────────────────────
  it('findAll returns only isActive entries by default', async () => {
    prisma.serviceCatalog.findMany.mockResolvedValue([]);
    await service.findAll(GARAGE_ID);
    expect(prisma.serviceCatalog.findMany).toHaveBeenCalledWith({
      where: { garageId: GARAGE_ID, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  });

  it('findAll with includeInactive=true returns all entries', async () => {
    prisma.serviceCatalog.findMany.mockResolvedValue([]);
    await service.findAll(GARAGE_ID, true);
    expect(prisma.serviceCatalog.findMany).toHaveBeenCalledWith({
      where: { garageId: GARAGE_ID },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  });

  // ── findOne not-found ───────────────────────────────────────
  it('findOne throws 404 when not found / cross-tenant', async () => {
    prisma.serviceCatalog.findFirst.mockResolvedValue(null);
    await expect(service.findOne('x', GARAGE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── create validation ───────────────────────────────────────
  it('create rejects defaultPrice < 0', async () => {
    await expect(
      service.create(GARAGE_ID, {
        code: 'X',
        name: 'X',
        defaultPrice: -1,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects defaultTvaRate > 50', async () => {
    await expect(
      service.create(GARAGE_ID, {
        code: 'X',
        name: 'X',
        defaultPrice: 10,
        defaultTvaRate: 60,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create maps to a Prisma create with isActive defaulted to true', async () => {
    prisma.serviceCatalog.create.mockResolvedValue({ id: 's1' });
    await service.create(GARAGE_ID, {
      code: 'OIL',
      name: 'Oil change',
      defaultPrice: 100,
    } as any);
    expect(prisma.serviceCatalog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        garageId: GARAGE_ID,
        code: 'OIL',
        name: 'Oil change',
        defaultPrice: 100,
        defaultTvaRate: 19,
        isActive: true,
      }),
    });
  });

  it('create maps duplicate code (P2002) to ConflictException', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: 'x',
    } as any);
    prisma.serviceCatalog.create.mockRejectedValue(error);
    await expect(
      service.create(GARAGE_ID, {
        code: 'DUP',
        name: 'Dup',
        defaultPrice: 1,
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── update validation ───────────────────────────────────────
  it('update rejects negative defaultPrice', async () => {
    prisma.serviceCatalog.findFirst.mockResolvedValue({
      id: 's1',
      garageId: GARAGE_ID,
    });
    await expect(
      service.update('s1', GARAGE_ID, { defaultPrice: -1 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── soft delete vs hard delete ──────────────────────────────
  it('remove (soft) flips isActive=false', async () => {
    prisma.serviceCatalog.findFirst.mockResolvedValue({
      id: 's1',
      garageId: GARAGE_ID,
    });
    prisma.serviceCatalog.update.mockResolvedValue({
      id: 's1',
      isActive: false,
    });
    await service.remove('s1', GARAGE_ID);
    expect(prisma.serviceCatalog.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: false },
    });
    expect(prisma.serviceCatalog.delete).not.toHaveBeenCalled();
  });

  it('remove with hard=true performs an actual delete', async () => {
    prisma.serviceCatalog.findFirst.mockResolvedValue({
      id: 's1',
      garageId: GARAGE_ID,
    });
    prisma.serviceCatalog.delete.mockResolvedValue({ id: 's1' });
    await service.remove('s1', GARAGE_ID, true);
    expect(prisma.serviceCatalog.delete).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });
});
