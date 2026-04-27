import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: { customer: { findMany } },
        },
      ],
    }).compile();
    service = module.get(CustomersService);
  });

  describe('findAll', () => {
    it('scopes by garageId without a search filter', async () => {
      await service.findAll('garage-1');
      const where = findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ garageId: 'garage-1' });
      expect(where.AND).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });

    it('matches a single-word search across four fields (OR)', async () => {
      await service.findAll('garage-1', 'Ali');
      const where = findMany.mock.calls[0][0].where;
      expect(where.garageId).toBe('garage-1');
      expect(where.AND).toHaveLength(1);
      expect(where.AND[0].OR).toEqual([
        { firstName: { contains: 'Ali', mode: 'insensitive' } },
        { lastName: { contains: 'Ali', mode: 'insensitive' } },
        { phone: { contains: 'Ali' } },
        { email: { contains: 'Ali', mode: 'insensitive' } },
      ]);
    });

    it('tokenises a multi-word search and AND-matches each token (regression: "Ali Ben Salah" missed customer with firstName=Ali, lastName="Ben Salah")', async () => {
      await service.findAll('garage-1', 'Ali Ben Salah');
      const where = findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(3);
      // each AND clause is an OR over the 4 searchable fields for one token
      expect(where.AND[0].OR[0]).toEqual({
        firstName: { contains: 'Ali', mode: 'insensitive' },
      });
      expect(where.AND[1].OR[0]).toEqual({
        firstName: { contains: 'Ben', mode: 'insensitive' },
      });
      expect(where.AND[2].OR[0]).toEqual({
        firstName: { contains: 'Salah', mode: 'insensitive' },
      });
    });

    it('collapses extra whitespace into clean tokens', async () => {
      await service.findAll('garage-1', '  Ali   Ben  Salah  ');
      const where = findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(3);
    });

    it('treats a whitespace-only search as no filter', async () => {
      await service.findAll('garage-1', '   ');
      const where = findMany.mock.calls[0][0].where;
      expect(where.AND).toBeUndefined();
    });
  });
});
