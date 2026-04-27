import { NotFoundException } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { createFindCustomerTool } from './find-customer.tool';
import { createGetCustomerTool } from './get-customer.tool';
import { createListAtRiskCustomersTool } from './list-at-risk-customers.tool';
import { createListTopCustomersTool } from './list-top-customers.tool';
import { createFindCarTool } from './find-car.tool';
import { createGetCarTool } from './get-car.tool';
import { createListMaintenanceDueTool } from './list-maintenance-due.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['customers', 'cars'],
  locale: 'en',
};

const otherGarageCtx: AssistantUserContext = {
  ...ownerCtx,
  userId: 'user-2',
  garageId: 'garage-2',
};

const fakeNow = new Date('2026-04-26T12:00:00.000Z');

describe('Customers + Cars tools', () => {
  describe('find_customer', () => {
    it('forwards garageId from ctx and caps at 5 results', async () => {
      const findAll = jest.fn().mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => ({
          id: `cust-${i}`,
          firstName: 'Ali',
          lastName: `Ben${i}`,
          email: `ali${i}@example.com`,
          phone: `+216${i}`,
          status: 'ACTIVE',
          totalSpent: 100 * i,
          visitCount: i,
        })),
      );
      const tool = createFindCustomerTool({
        customersService: { findAll } as any,
      });

      const result = await tool.handler({ query: 'ali' }, ownerCtx);

      expect(findAll).toHaveBeenCalledWith('garage-1', 'ali');
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: 'cust-0',
        displayName: 'Ali Ben0',
        phone: '+2160',
        email: 'ali0@example.com',
        status: 'ACTIVE',
        totalSpent: 0,
        visitCount: 0,
      });
    });

    it('never trusts garageId from args (no such field) — handler signature pins ctx.garageId', async () => {
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = createFindCustomerTool({
        customersService: { findAll } as any,
      });
      await tool.handler({ query: 'x' }, otherGarageCtx);
      expect(findAll).toHaveBeenCalledWith('garage-2', 'x');
    });
  });

  describe('get_customer', () => {
    it('returns the customer with cars and recent invoices', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'cust-1',
        firstName: 'Sami',
        lastName: 'B',
        email: 'sami@x.com',
        phone: '+216123',
        address: '1 rue',
        status: 'ACTIVE',
        loyaltyTier: 'gold',
        totalSpent: 1500,
        visitCount: 6,
        smsOptIn: true,
        notes: null,
        createdAt: fakeNow,
        cars: Array.from({ length: 7 }, (_, i) => ({
          id: `car-${i}`,
          make: 'Peugeot',
          model: '208',
          year: 2020 + i,
          licensePlate: `123 TUN ${i}`,
          mileage: 1000 * i,
        })),
        invoices: Array.from({ length: 7 }, (_, i) => ({
          id: `inv-${i}`,
          total: 100 * i,
          status: 'PAID',
          createdAt: fakeNow,
          paidAt: fakeNow,
        })),
      });
      const tool = createGetCustomerTool({
        customersService: { findOne } as any,
      });

      const result = await tool.handler({ customerId: 'cust-1' }, ownerCtx);

      expect(findOne).toHaveBeenCalledWith('cust-1', 'garage-1');
      if ('error' in result) throw new Error('expected success');
      expect(result.id).toBe('cust-1');
      expect(result.displayName).toBe('Sami B');
      expect(result.cars).toHaveLength(5);
      expect(result.recentInvoices).toHaveLength(5);
      expect(result.createdAt).toBe(fakeNow.toISOString());
    });

    it('returns {error:"not_found"} for foreign-garage id (CustomersService throws NotFound)', async () => {
      const findOne = jest
        .fn()
        .mockRejectedValue(new NotFoundException('Customer not found'));
      const tool = createGetCustomerTool({
        customersService: { findOne } as any,
      });

      const result = await tool.handler(
        { customerId: 'foreign-id' },
        ownerCtx,
      );

      expect(findOne).toHaveBeenCalledWith('foreign-id', 'garage-1');
      expect(result).toEqual({
        error: 'not_found',
        message: expect.stringContaining('foreign-id'),
      });
    });

    it('rethrows non-NotFound errors', async () => {
      const findOne = jest.fn().mockRejectedValue(new Error('db down'));
      const tool = createGetCustomerTool({
        customersService: { findOne } as any,
      });
      await expect(
        tool.handler({ customerId: 'x' }, ownerCtx),
      ).rejects.toThrow('db down');
    });
  });

  describe('list_at_risk_customers', () => {
    it('passes ctx.garageId and ctx.locale to AiService.predictChurn and slices to limit', async () => {
      const predictChurn = jest.fn().mockResolvedValue({
        provider: 'mock',
        predictions: Array.from({ length: 12 }, (_, i) => ({
          customerId: `c-${i}`,
          customerName: `Cust ${i}`,
          churnRisk: 0.9 - i * 0.05,
          riskLevel: 'high' as const,
          factors: ['inactive'],
          suggestedAction: 'reach out',
        })),
      });
      const tool = createListAtRiskCustomersTool({
        aiService: { predictChurn } as any,
      });

      const result = await tool.handler({ limit: 3 }, ownerCtx);

      expect(predictChurn).toHaveBeenCalledWith('garage-1', { language: 'en' });
      expect(result).toHaveLength(3);
      expect(result[0].customerId).toBe('c-0');
    });

    it('uses default limit when not provided', async () => {
      const predictChurn = jest.fn().mockResolvedValue({
        provider: 'mock',
        predictions: Array.from({ length: 50 }, (_, i) => ({
          customerId: `c-${i}`,
          customerName: 'x',
          churnRisk: 0.5,
          riskLevel: 'medium' as const,
          factors: [],
          suggestedAction: '',
        })),
      });
      const tool = createListAtRiskCustomersTool({
        aiService: { predictChurn } as any,
      });
      const result = await tool.handler({}, ownerCtx);
      expect(result).toHaveLength(10);
    });

    it('is gated to OWNER role', () => {
      const tool = createListAtRiskCustomersTool({
        aiService: { predictChurn: jest.fn() } as any,
      });
      expect(tool.requiredRole).toBe('OWNER');
    });
  });

  describe('list_top_customers', () => {
    it('queries Prisma scoped by garageId, ordered by totalSpent for revenue', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'c1',
          firstName: 'A',
          lastName: 'B',
          phone: '+1',
          email: 'a@b',
          totalSpent: 5000,
          visitCount: 10,
          loyaltyTier: 'platinum',
        },
      ]);
      const tool = createListTopCustomersTool({
        prisma: { customer: { findMany } } as any,
      });

      const result = await tool.handler(
        { by: 'revenue', limit: 5 },
        ownerCtx,
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { garageId: 'garage-1' },
          orderBy: { totalSpent: 'desc' },
          take: 5,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('A B');
    });

    it('orders by visitCount when by="visit_count"', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const tool = createListTopCustomersTool({
        prisma: { customer: { findMany } } as any,
      });
      await tool.handler({ by: 'visit_count' }, ownerCtx);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { visitCount: 'desc' },
          where: { garageId: 'garage-1' },
        }),
      );
    });

    it('is OWNER-gated', () => {
      const tool = createListTopCustomersTool({ prisma: {} as any });
      expect(tool.requiredRole).toBe('OWNER');
    });
  });

  describe('find_car', () => {
    it('queries cars by plate/vin/make/model in ctx.garageId only', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'car-1',
          customerId: 'cust-1',
          customer: { firstName: 'Ali', lastName: 'B' },
          make: 'Peugeot',
          model: '208',
          year: 2022,
          licensePlate: '1234 TUN 56',
          mileage: 35000,
        },
      ]);
      const tool = createFindCarTool({
        prisma: { car: { findMany } } as any,
      });

      const result = await tool.handler({ query: '208' }, ownerCtx);

      const callArgs = findMany.mock.calls[0][0];
      expect(callArgs.where.garageId).toBe('garage-1');
      expect(callArgs.where.OR).toEqual(
        expect.arrayContaining([
          { licensePlate: { contains: '208', mode: 'insensitive' } },
          { vin: { contains: '208', mode: 'insensitive' } },
          { make: { contains: '208', mode: 'insensitive' } },
          { model: { contains: '208', mode: 'insensitive' } },
        ]),
      );
      expect(callArgs.take).toBe(5);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'car-1',
        plate: '1234 TUN 56',
        customerName: 'Ali B',
      });
    });

    it('uses garageId from a different ctx without leaking across tenants', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const tool = createFindCarTool({
        prisma: { car: { findMany } } as any,
      });
      await tool.handler({ query: 'x' }, otherGarageCtx);
      expect(findMany.mock.calls[0][0].where.garageId).toBe('garage-2');
    });
  });

  describe('get_car', () => {
    it('returns the car with recent maintenance jobs', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'car-1',
        customerId: 'cust-1',
        customer: { firstName: 'Sami', lastName: 'B' },
        make: 'Renault',
        model: 'Clio',
        year: 2021,
        vin: 'VINX',
        licensePlate: 'PL 1',
        color: 'red',
        mileage: 50000,
        engineType: 'petrol',
        transmission: 'manual',
        lastServiceDate: fakeNow,
        nextServiceDate: null,
        notes: 'note',
        maintenanceJobs: Array.from({ length: 7 }, (_, i) => ({
          id: `job-${i}`,
          title: 'Oil change',
          status: 'COMPLETED',
          createdAt: fakeNow,
          completionDate: fakeNow,
        })),
      });
      const tool = createGetCarTool({ carsService: { findOne } as any });

      const result = await tool.handler({ carId: 'car-1' }, ownerCtx);

      expect(findOne).toHaveBeenCalledWith('car-1', 'garage-1');
      if ('error' in result) throw new Error('expected success');
      expect(result.id).toBe('car-1');
      expect(result.plate).toBe('PL 1');
      expect(result.customerName).toBe('Sami B');
      expect(result.recentMaintenanceJobs).toHaveLength(5);
      expect(result.lastServiceDate).toBe(fakeNow.toISOString());
    });

    it('returns {error:"not_found"} when foreign-garage car is requested', async () => {
      const findOne = jest
        .fn()
        .mockRejectedValue(new NotFoundException('Car not found'));
      const tool = createGetCarTool({ carsService: { findOne } as any });
      const result = await tool.handler({ carId: 'foreign' }, ownerCtx);
      expect(findOne).toHaveBeenCalledWith('foreign', 'garage-1');
      expect(result).toEqual({
        error: 'not_found',
        message: expect.stringContaining('foreign'),
      });
    });
  });

  describe('list_maintenance_due', () => {
    it('forwards garageId+locale and computes dueWithinDays from predictedDate', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow.getTime());
      const inFiveDays = new Date(
        fakeNow.getTime() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const inSixtyDays = new Date(
        fakeNow.getTime() + 60 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const overdue = new Date(
        fakeNow.getTime() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const predictMaintenance = jest.fn().mockResolvedValue({
        provider: 'mock',
        predictions: [
          {
            carId: 'c1',
            carLabel: 'Peugeot',
            service: 'oil-change',
            predictedDate: inFiveDays,
            confidence: 0.85,
            urgency: 'medium' as const,
            reason: 'due',
          },
          {
            carId: 'c2',
            carLabel: 'Renault',
            service: 'brake-service',
            predictedDate: inSixtyDays,
            confidence: 0.6,
            urgency: 'low' as const,
            reason: 'soon',
          },
          {
            carId: 'c3',
            carLabel: 'Clio',
            service: 'tire-rotation',
            predictedDate: overdue,
            confidence: 0.85,
            urgency: 'high' as const,
            reason: 'past',
          },
        ],
      });
      const tool = createListMaintenanceDueTool({
        aiService: { predictMaintenance } as any,
      });

      const all = await tool.handler({}, ownerCtx);
      expect(predictMaintenance).toHaveBeenCalledWith('garage-1', {
        language: 'en',
      });
      expect(all).toHaveLength(3);
      expect(all.find((p) => p.carId === 'c1')!.dueWithinDays).toBe(5);
      expect(all.find((p) => p.carId === 'c3')!.dueWithinDays).toBeLessThan(0);

      const filtered = await tool.handler({ withinDays: 30 }, ownerCtx);
      // Keeps overdue + within-30 (c1, c3); excludes c2 (60 days out).
      expect(filtered.map((p) => p.carId).sort()).toEqual(['c1', 'c3']);
    });

    it('orders by soonest dueWithinDays by default and respects limit', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow.getTime());
      const inFive = new Date(fakeNow.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const inSixty = new Date(fakeNow.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const overdue = new Date(fakeNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const predictMaintenance = jest.fn().mockResolvedValue({
        provider: 'mock',
        predictions: [
          { carId: 'far', carLabel: 'A', service: 's', predictedDate: inSixty, confidence: 0.5, urgency: 'low' as const, reason: 'r' },
          { carId: 'overdue', carLabel: 'B', service: 's', predictedDate: overdue, confidence: 0.8, urgency: 'high' as const, reason: 'r' },
          { carId: 'near', carLabel: 'C', service: 's', predictedDate: inFive, confidence: 0.7, urgency: 'medium' as const, reason: 'r' },
        ],
      });
      const tool = createListMaintenanceDueTool({ aiService: { predictMaintenance } as any });

      const result = await tool.handler({ limit: 2 }, ownerCtx);

      // Default sort = soonest (ascending dueWithinDays). Overdue (-3) first, then near (5).
      expect(result.map((p) => p.carId)).toEqual(['overdue', 'near']);
    });

    it('honors orderBy="most_urgent" → high before medium before low', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow.getTime());
      const future = new Date(fakeNow.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const sooner = new Date(fakeNow.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const predictMaintenance = jest.fn().mockResolvedValue({
        provider: 'mock',
        predictions: [
          { carId: 'lowSoon', carLabel: 'A', service: 's', predictedDate: sooner, confidence: 0.5, urgency: 'low' as const, reason: 'r' },
          { carId: 'highLater', carLabel: 'B', service: 's', predictedDate: future, confidence: 0.9, urgency: 'high' as const, reason: 'r' },
          { carId: 'medSoon', carLabel: 'C', service: 's', predictedDate: sooner, confidence: 0.7, urgency: 'medium' as const, reason: 'r' },
        ],
      });
      const tool = createListMaintenanceDueTool({ aiService: { predictMaintenance } as any });

      const result = await tool.handler({ orderBy: 'most_urgent' }, ownerCtx);

      expect(result.map((p) => p.carId)).toEqual(['highLater', 'medSoon', 'lowSoon']);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });
  });

  // Ensures every tool registers cleanly and validateArgs rejects bad input.
  describe('registry validation', () => {
    let registry: ToolRegistryService;
    let allTools: ToolDefinition<any, any>[];

    beforeEach(() => {
      registry = new ToolRegistryService();
      const customersService: any = { findAll: jest.fn(), findOne: jest.fn() };
      const carsService: any = { findOne: jest.fn() };
      const aiService: any = {
        predictChurn: jest.fn(),
        predictMaintenance: jest.fn(),
      };
      const prisma: any = { car: {}, customer: {} };
      allTools = [
        createFindCustomerTool({ customersService }),
        createGetCustomerTool({ customersService }),
        createListAtRiskCustomersTool({ aiService }),
        createListTopCustomersTool({ prisma }),
        createFindCarTool({ prisma }),
        createGetCarTool({ carsService }),
        createListMaintenanceDueTool({ aiService }),
      ];
      for (const t of allTools) registry.register(t);
    });

    it('all 7 tools are registered with READ blast tier', () => {
      for (const t of allTools) {
        expect(t.blastTier).toBe(AssistantBlastTier.READ);
        expect(registry.get(t.name)).toBe(t);
      }
    });

    it('OWNER-only tools are gated (list_at_risk_customers, list_top_customers)', () => {
      const ownerOnly = allTools.filter((t) => t.requiredRole === 'OWNER').map((t) => t.name);
      expect(ownerOnly.sort()).toEqual([
        'list_at_risk_customers',
        'list_top_customers',
      ]);
    });

    it('rejects find_customer with empty query', () => {
      expect(registry.validateArgs('find_customer', { query: '' }).valid).toBe(false);
      expect(registry.validateArgs('find_customer', {}).valid).toBe(false);
      expect(registry.validateArgs('find_customer', { query: 'ok' }).valid).toBe(true);
    });

    it('rejects get_customer without customerId', () => {
      expect(registry.validateArgs('get_customer', {}).valid).toBe(false);
      expect(registry.validateArgs('get_customer', { customerId: 'x' }).valid).toBe(true);
    });

    it('rejects list_at_risk_customers with invalid limit', () => {
      expect(registry.validateArgs('list_at_risk_customers', { limit: 0 }).valid).toBe(false);
      expect(registry.validateArgs('list_at_risk_customers', { limit: 1000 }).valid).toBe(false);
      expect(registry.validateArgs('list_at_risk_customers', {}).valid).toBe(true);
    });

    it('rejects list_top_customers without by, or with bad enum', () => {
      expect(registry.validateArgs('list_top_customers', {}).valid).toBe(false);
      expect(
        registry.validateArgs('list_top_customers', { by: 'profit' }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('list_top_customers', { by: 'revenue' }).valid,
      ).toBe(true);
    });

    it('rejects find_car with empty query', () => {
      expect(registry.validateArgs('find_car', { query: '' }).valid).toBe(false);
      expect(registry.validateArgs('find_car', { query: 'ab' }).valid).toBe(true);
    });

    it('rejects get_car without carId', () => {
      expect(registry.validateArgs('get_car', {}).valid).toBe(false);
      expect(registry.validateArgs('get_car', { carId: 'x' }).valid).toBe(true);
    });

    it('rejects list_maintenance_due with non-integer or out-of-range withinDays', () => {
      expect(
        registry.validateArgs('list_maintenance_due', { withinDays: 0 }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('list_maintenance_due', { withinDays: 1.5 }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('list_maintenance_due', { withinDays: 99999 }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('list_maintenance_due', { withinDays: 30 }).valid,
      ).toBe(true);
      expect(registry.validateArgs('list_maintenance_due', {}).valid).toBe(true);
    });
  });
});
