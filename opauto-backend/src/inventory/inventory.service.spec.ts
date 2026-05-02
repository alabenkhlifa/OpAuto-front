import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Inventory service unit specs — focused on the BUG-096 (Sweep C-18)
 * server-side search + limit contract that the part-picker depends on.
 */
describe('InventoryService (unit)', () => {
  const GARAGE_ID = 'garage-1';
  let service: InventoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      part: {
        findMany: jest.fn(),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(InventoryService);
  });

  describe('BUG-096 (Sweep C-18) — search + limit on findAll', () => {
    it('empty search returns the first 25 rows for the garage', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID);
      const call = prisma.part.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ garageId: GARAGE_ID });
      expect(call.where.OR).toBeUndefined();
      expect(call.take).toBe(25);
      expect(call.orderBy).toEqual({ name: 'asc' });
    });

    it('whitespace-only search is treated as empty (no OR clause)', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, '   ');
      const call = prisma.part.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeUndefined();
    });

    it('search="brake" filters case-insensitively across name and partNumber', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, 'brake');
      const call = prisma.part.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { name: { contains: 'brake', mode: 'insensitive' } },
        { partNumber: { contains: 'brake', mode: 'insensitive' } },
      ]);
      expect(call.where.garageId).toBe(GARAGE_ID);
    });

    it('search trims surrounding whitespace before matching', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, '  brake  ');
      const call = prisma.part.findMany.mock.calls[0][0];
      expect(call.where.OR[0]).toEqual({
        name: { contains: 'brake', mode: 'insensitive' },
      });
    });

    it('limit=5 is honoured', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, undefined, 5);
      expect(prisma.part.findMany.mock.calls[0][0].take).toBe(5);
    });

    it('limit > 100 is clamped to 100 (DoS guard)', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, undefined, 1000);
      expect(prisma.part.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('limit < 1 is clamped up to 1', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, undefined, -5);
      expect(prisma.part.findMany.mock.calls[0][0].take).toBe(1);
    });

    it('NaN limit falls back to default 25', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, undefined, NaN);
      expect(prisma.part.findMany.mock.calls[0][0].take).toBe(25);
    });

    it('still includes supplier relation', async () => {
      prisma.part.findMany.mockResolvedValue([]);
      await service.findAll(GARAGE_ID, 'oil');
      expect(prisma.part.findMany.mock.calls[0][0].include).toEqual({
        supplier: { select: { name: true } },
      });
    });
  });
});
