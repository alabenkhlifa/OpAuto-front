import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GarageSettingsService } from './garage-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGarageDto } from './dto/update-garage.dto';

/**
 * Unit tests — Task 1.5
 * Verifies the service layer round-trips the new fiscal fields
 * through Prisma without mutating shape.
 */
describe('GarageSettingsService (unit)', () => {
  let service: GarageSettingsService;
  let prisma: { garage: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      garage: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(GarageSettingsService);
  });

  describe('getSettings', () => {
    it('returns the garage including all fiscal fields', async () => {
      const garage = {
        id: 'g-1',
        name: 'Test Garage',
        mfNumber: '1234567/A/B/000',
        rib: '12345678901234567890',
        bankName: 'BIAT',
        logoUrl: '/uploads/logo.png',
        defaultPaymentTermsDays: 30,
        numberingPrefix: 'INV',
        numberingResetPolicy: 'YEARLY',
        numberingDigitCount: 4,
        defaultTvaRate: 19,
        fiscalStampEnabled: true,
      };
      prisma.garage.findUnique.mockResolvedValue(garage);

      const result = await service.getSettings('g-1');

      expect(prisma.garage.findUnique).toHaveBeenCalledWith({ where: { id: 'g-1' } });
      expect(result).toEqual(garage);
      // All fiscal fields surface in the GET response
      expect(result.mfNumber).toBe('1234567/A/B/000');
      expect(result.rib).toBe('12345678901234567890');
      expect(result.numberingResetPolicy).toBe('YEARLY');
      expect(result.numberingDigitCount).toBe(4);
      expect(result.defaultTvaRate).toBe(19);
      expect(result.fiscalStampEnabled).toBe(true);
    });

    it('throws NotFoundException when garage missing', async () => {
      prisma.garage.findUnique.mockResolvedValue(null);
      await expect(service.getSettings('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('passes all fiscal fields straight through to prisma.update', async () => {
      const dto: UpdateGarageDto = {
        mfNumber: '7654321/Z/Y/999',
        rib: '98765432109876543210',
        bankName: 'Attijari Bank',
        logoUrl: 'https://cdn.example.com/garage.png',
        defaultPaymentTermsDays: 45,
        numberingPrefix: 'FACT',
        numberingResetPolicy: 'MONTHLY',
        numberingDigitCount: 6,
        defaultTvaRate: 13,
        fiscalStampEnabled: false,
      };
      prisma.garage.update.mockImplementation(async ({ data }) => ({ id: 'g-1', ...data }));

      const result = await service.updateSettings('g-1', dto);

      expect(prisma.garage.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: dto,
      });
      // Round-trip: every fiscal field comes back exactly as sent
      expect(result.mfNumber).toBe('7654321/Z/Y/999');
      expect(result.rib).toBe('98765432109876543210');
      expect(result.bankName).toBe('Attijari Bank');
      expect(result.logoUrl).toBe('https://cdn.example.com/garage.png');
      expect(result.defaultPaymentTermsDays).toBe(45);
      expect(result.numberingPrefix).toBe('FACT');
      expect(result.numberingResetPolicy).toBe('MONTHLY');
      expect(result.numberingDigitCount).toBe(6);
      expect(result.defaultTvaRate).toBe(13);
      expect(result.fiscalStampEnabled).toBe(false);
    });

    it('supports partial fiscal updates (only the supplied fields are written)', async () => {
      const dto: UpdateGarageDto = { numberingResetPolicy: 'NEVER' };
      prisma.garage.update.mockResolvedValue({ id: 'g-1', numberingResetPolicy: 'NEVER' });

      await service.updateSettings('g-1', dto);

      expect(prisma.garage.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: { numberingResetPolicy: 'NEVER' },
      });
    });

    it('preserves coexistence with legacy fields (name, address, taxRate)', async () => {
      const dto: UpdateGarageDto = {
        name: 'New Name',
        address: '12 Rue Habib Bourguiba, Tunis',
        taxRate: 19,
        mfNumber: '1234567/A/B/000',
      };
      prisma.garage.update.mockResolvedValue({ id: 'g-1', ...dto });

      const result = await service.updateSettings('g-1', dto);

      expect(prisma.garage.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: dto,
      });
      expect(result.name).toBe('New Name');
      expect(result.mfNumber).toBe('1234567/A/B/000');
    });
  });
});
