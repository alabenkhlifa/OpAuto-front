import { AssistantBlastTier, AppointmentStatus } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { buildListAppointmentsTool } from './list-appointments.tool';
import { buildFindAvailableSlotTool } from './find-available-slot.tool';
import { buildCreateAppointmentTool } from './create-appointment.tool';
import { buildCancelAppointmentTool } from './cancel-appointment.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['appointments'],
  locale: 'en',
};

describe('Appointments tools', () => {
  describe('list_appointments', () => {
    it('returns the projected list scoped by garageId', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'a1',
          title: 'Oil change',
          status: 'SCHEDULED',
          type: 'oil-change',
          startTime: new Date('2026-05-01T09:00:00Z'),
          endTime: new Date('2026-05-01T10:00:00Z'),
          customerId: 'c1',
          carId: 'car1',
          employeeId: 'emp1',
          customer: { firstName: 'Ali', lastName: 'Ben', phone: '+216' },
          car: { make: 'Toyota', model: 'Corolla', licensePlate: 'TUN-1' },
          employee: { firstName: 'Khalil', lastName: 'M' },
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler(
        { from: '2026-05-01T00:00:00Z', to: '2026-05-02T00:00:00Z' },
        ownerCtx,
      );

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-05-01T00:00:00Z',
        '2026-05-02T00:00:00Z',
      );
      expect(result.count).toBe(1);
      expect(result.appointments[0]).toMatchObject({
        id: 'a1',
        customerId: 'c1',
        customerName: 'Ali Ben',
        carLabel: 'Toyota Corolla · TUN-1',
        employeeName: 'Khalil M',
        startTime: '2026-05-01T09:00:00.000Z',
      });
    });

    it('filters by mechanicId in-memory after fetching', async () => {
      const findAll = jest.fn().mockResolvedValue([
        { id: 'a1', title: 't', status: 'SCHEDULED', type: null, startTime: new Date(), endTime: new Date(), customerId: 'c1', carId: 'car1', employeeId: 'emp1', customer: null, car: null, employee: null },
        { id: 'a2', title: 't', status: 'SCHEDULED', type: null, startTime: new Date(), endTime: new Date(), customerId: 'c1', carId: 'car1', employeeId: 'emp2', customer: null, car: null, employee: null },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({ mechanicId: 'emp2' }, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual(['a2']);
    });

    it('orders by soonest startTime by default', async () => {
      const findAll = jest.fn().mockResolvedValue([
        { id: 'late', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-03T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
        { id: 'early', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-01T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
        { id: 'mid', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-02T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({}, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual(['early', 'mid', 'late']);
    });

    it('honors orderBy="latest" + limit for "last N appointments"', async () => {
      const findAll = jest.fn().mockResolvedValue([
        { id: 'a', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-01T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
        { id: 'b', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-02T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
        { id: 'c', title: 't', status: 'SCHEDULED', type: null, startTime: new Date('2026-05-03T10:00:00Z'), endTime: new Date(), customerId: 'c', carId: 'car', employeeId: null, customer: null, car: null, employee: null },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({ orderBy: 'latest', limit: 2 }, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual(['c', 'b']);
    });

    it('rejects an invalid orderBy at schema level', () => {
      const tool = buildListAppointmentsTool({ findAll: jest.fn() } as any);
      const registry = new ToolRegistryService();
      registry.register(tool);
      expect(registry.validateArgs('list_appointments', { orderBy: 'random' }).valid).toBe(false);
      expect(registry.validateArgs('list_appointments', { orderBy: 'soonest', limit: 5 }).valid).toBe(true);
    });
  });

  describe('find_available_slot', () => {
    it('wraps suggestSchedule with locale, duration, preferredDate', async () => {
      const suggestSchedule = jest.fn().mockResolvedValue({
        suggestedSlots: [
          { start: 's1', end: 'e1', mechanicId: 'm1', mechanicName: 'M1', score: 0.9, reason: 'r' },
          { start: 's2', end: 'e2', mechanicId: 'm2', mechanicName: 'M2', score: 0.8, reason: 'r' },
          { start: 's3', end: 'e3', mechanicId: 'm3', mechanicName: 'M3', score: 0.7, reason: 'r' },
          { start: 's4', end: 'e4', mechanicId: 'm4', mechanicName: 'M4', score: 0.6, reason: 'r' },
        ],
        provider: 'mock',
      });
      const tool = buildFindAvailableSlotTool({ suggestSchedule } as any);
      const result = await tool.handler(
        { date: '2026-05-01T09:00:00Z', durationMinutes: 60, appointmentType: 'oil-change' },
        ownerCtx,
      );

      expect(suggestSchedule).toHaveBeenCalledWith('garage-1', {
        appointmentType: 'oil-change',
        estimatedDuration: 60,
        preferredDate: '2026-05-01T09:00:00Z',
        language: 'en',
      });
      expect(result.slots).toHaveLength(3);
      expect(result.provider).toBe('mock');
    });
  });

  describe('create_appointment', () => {
    function setup() {
      const customerFindFirst = jest.fn();
      const carFindFirst = jest.fn();
      const create = jest.fn();
      const prisma = {
        customer: { findFirst: customerFindFirst },
        car: { findFirst: carFindFirst },
      } as any;
      const appointmentsService = { create } as any;
      const tool = buildCreateAppointmentTool(appointmentsService, prisma);
      return { tool, customerFindFirst, carFindFirst, create };
    }

    it('creates an appointment with computed endTime = start + duration', async () => {
      const { tool, customerFindFirst, carFindFirst, create } = setup();
      customerFindFirst.mockResolvedValue({ id: 'c1' });
      carFindFirst.mockResolvedValue({ id: 'car1' });
      create.mockResolvedValue({
        id: 'a1',
        customerId: 'c1',
        carId: 'car1',
        startTime: new Date('2026-05-01T09:00:00Z'),
        endTime: new Date('2026-05-01T10:30:00Z'),
        status: 'SCHEDULED',
        title: 'oil-change',
      });

      const result = await tool.handler(
        {
          customerId: 'c1',
          carId: 'car1',
          scheduledAt: '2026-05-01T09:00:00Z',
          durationMinutes: 90,
          type: 'oil-change',
        },
        ownerCtx,
      );

      expect(create).toHaveBeenCalledWith('garage-1', expect.objectContaining({
        customerId: 'c1',
        carId: 'car1',
        startTime: '2026-05-01T09:00:00.000Z',
        endTime: '2026-05-01T10:30:00.000Z',
        type: 'oil-change',
        title: 'oil-change',
      }));
      expect(result.appointmentId).toBe('a1');
    });

    it('rejects a customerId from another garage', async () => {
      const { tool, customerFindFirst } = setup();
      customerFindFirst.mockResolvedValue(null);

      await expect(
        tool.handler(
          {
            customerId: 'foreign-customer',
            carId: 'car1',
            scheduledAt: '2026-05-01T09:00:00Z',
            durationMinutes: 60,
          },
          ownerCtx,
        ),
      ).rejects.toThrow(/Customer foreign-customer not found/);
    });

    it('rejects a carId not belonging to the customer', async () => {
      const { tool, customerFindFirst, carFindFirst } = setup();
      customerFindFirst.mockResolvedValue({ id: 'c1' });
      carFindFirst.mockResolvedValue(null);

      await expect(
        tool.handler(
          {
            customerId: 'c1',
            carId: 'foreign-car',
            scheduledAt: '2026-05-01T09:00:00Z',
            durationMinutes: 60,
          },
          ownerCtx,
        ),
      ).rejects.toThrow(/Car foreign-car not found/);
    });

    it('has CONFIRM_WRITE blast tier', () => {
      const { tool } = setup();
      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
    });
  });

  describe('cancel_appointment', () => {
    it('refuses an appointment from another garage (findOne throws)', async () => {
      const findOne = jest.fn().mockRejectedValue(new Error('Appointment not found'));
      const update = jest.fn();
      const tool = buildCancelAppointmentTool({ findOne, update } as any);

      await expect(
        tool.handler({ appointmentId: 'foreign-appt' }, ownerCtx),
      ).rejects.toThrow(/not found/);
      expect(update).not.toHaveBeenCalled();
    });

    it('cancels an appointment and appends a reason note', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'a1',
        notes: 'pre-existing',
      });
      const update = jest.fn().mockResolvedValue({});
      const tool = buildCancelAppointmentTool({ findOne, update } as any);

      const result = await tool.handler(
        { appointmentId: 'a1', reason: 'customer requested' },
        ownerCtx,
      );

      expect(findOne).toHaveBeenCalledWith('a1', 'garage-1');
      expect(update).toHaveBeenCalledWith('a1', 'garage-1', {
        status: AppointmentStatus.CANCELLED,
        notes: 'pre-existing\n[cancelled] customer requested',
      });
      expect(result).toEqual({ cancelled: true, appointmentId: 'a1' });
    });
  });

  describe('Ajv schema validation via ToolRegistryService', () => {
    let registry: ToolRegistryService;
    beforeEach(() => {
      registry = new ToolRegistryService();
    });

    function register<T = unknown>(tool: ToolDefinition<T, unknown>) {
      registry.register(tool as unknown as ToolDefinition);
    }

    it('rejects negative durationMinutes for find_available_slot', () => {
      register(buildFindAvailableSlotTool({} as any));
      const v = registry.validateArgs('find_available_slot', {
        date: '2026-05-01T09:00:00Z',
        durationMinutes: -10,
      });
      expect(v.valid).toBe(false);
      expect(v.errors!.join(' ')).toMatch(/duration|minimum/i);
    });

    it('rejects missing required fields for create_appointment', () => {
      register(buildCreateAppointmentTool({} as any, {} as any));
      const v = registry.validateArgs('create_appointment', {
        customerId: 'c1',
      });
      expect(v.valid).toBe(false);
      expect(v.errors!.join(' ')).toMatch(/required/i);
    });

    it('accepts a valid list_appointments call with no args', () => {
      register(buildListAppointmentsTool({} as any));
      const v = registry.validateArgs('list_appointments', {});
      expect(v.valid).toBe(true);
    });

    it('rejects unknown additional properties', () => {
      register(buildCancelAppointmentTool({} as any));
      const v = registry.validateArgs('cancel_appointment', {
        appointmentId: 'a1',
        bogus: 'x',
      });
      expect(v.valid).toBe(false);
    });
  });
});
