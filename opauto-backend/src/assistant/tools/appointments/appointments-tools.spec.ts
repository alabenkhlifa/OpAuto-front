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
          customer: {
            firstName: 'Ali',
            lastName: 'Ben',
            phone: '+216',
            email: 'ali@example.com',
          },
          car: { make: 'Toyota', model: 'Corolla', licensePlate: 'TUN-1' },
          employee: { firstName: 'Khalil', lastName: 'M' },
        },
      ]);
      const garageFindUnique = jest.fn().mockResolvedValue({
        businessHours: { timezone: 'Africa/Tunis' },
      });
      const tool = buildListAppointmentsTool(
        { findAll } as any,
        { garage: { findUnique: garageFindUnique } } as any,
      );
      const result = await tool.handler(
        { from: '2026-05-01T00:00:00Z', to: '2026-05-02T00:00:00Z' },
        ownerCtx,
      );
      const expectedStartLocal = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Tunis',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date('2026-05-01T09:00:00Z'));

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-05-01T00:00:00Z',
        '2026-05-02T00:00:00Z',
      );
      expect(garageFindUnique).toHaveBeenCalledWith({
        where: { id: 'garage-1' },
        select: { businessHours: true },
      });
      expect(result.count).toBe(1);
      expect(result.appointments[0]).toMatchObject({
        id: 'a1',
        customerId: 'c1',
        customerName: 'Ali Ben',
        customerEmail: 'ali@example.com',
        carLabel: 'Toyota Corolla · TUN-1',
        employeeName: 'Khalil M',
        startTime: '2026-05-01T09:00:00.000Z',
        startTimeLocal: expectedStartLocal,
        timeZone: 'Africa/Tunis',
      });
    });

    it('filters by mechanicId in-memory after fetching', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'a1',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c1',
          carId: 'car1',
          employeeId: 'emp1',
          customer: null,
          car: null,
          employee: null,
        },
        {
          id: 'a2',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c1',
          carId: 'car1',
          employeeId: 'emp2',
          customer: null,
          car: null,
          employee: null,
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({ mechanicId: 'emp2' }, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual(['a2']);
    });

    it('filters by customerId in-memory after fetching', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'a1',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c1',
          carId: 'car1',
          employeeId: null,
          customer: { firstName: 'Khaoula', lastName: 'Khelifi' },
          car: null,
          employee: null,
        },
        {
          id: 'a2',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c2',
          carId: 'car2',
          employeeId: null,
          customer: { firstName: 'Khaoula', lastName: 'Chaabane' },
          car: null,
          employee: null,
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({ customerId: 'c1' }, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual(['a1']);
    });

    it('filters by customerName in-memory after fetching', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'future',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c1',
          carId: 'car1',
          employeeId: null,
          customer: { firstName: 'Khaoula', lastName: 'Khelifi' },
          car: null,
          employee: null,
        },
        {
          id: 'other',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date(),
          endTime: new Date(),
          customerId: 'c2',
          carId: 'car2',
          employeeId: null,
          customer: { firstName: 'Mehdi', lastName: 'Gharbi' },
          car: null,
          employee: null,
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler(
        { customerName: 'khaoula khelifi' },
        ownerCtx,
      );
      expect(result.appointments.map((a) => a.id)).toEqual(['future']);
    });

    it('expands a date-only same-day range to the full UTC day', async () => {
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = buildListAppointmentsTool({ findAll } as any);

      await tool.handler({ from: '2026-07-10', to: '2026-07-10' }, ownerCtx);

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-07-10T00:00:00.000Z',
        '2026-07-10T23:59:59.999Z',
      );
    });

    it('clamps model-emitted today-to-tomorrow ranges to today only', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-23T12:00:00Z'));
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = buildListAppointmentsTool({ findAll } as any);

      await tool.handler(
        { from: '2026-06-23', to: '2026-06-24', orderBy: 'soonest' },
        {
          ...ownerCtx,
          turnState: {
            readToolCallsSoFar: 0,
            userMessage: 'What do we have booked today?',
          },
        },
      );

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-06-23T00:00:00.000Z',
        '2026-06-23T23:59:59.999Z',
      );
      jest.useRealTimers();
    });

    it('supports from-only future ranges for upcoming appointment questions', async () => {
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = buildListAppointmentsTool({ findAll } as any);

      await tool.handler({ from: '2026-06-23', orderBy: 'soonest' }, ownerCtx);

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-06-23T00:00:00.000Z',
        '9999-12-31T23:59:59.999Z',
      );
    });

    it('expands model-emitted today-only ranges for upcoming appointment questions', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-23T12:00:00Z'));
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = buildListAppointmentsTool({ findAll } as any);

      await tool.handler(
        { from: '2026-06-23', to: '2026-06-23', orderBy: 'soonest' },
        {
          ...ownerCtx,
          turnState: {
            readToolCallsSoFar: 0,
            userMessage: 'Show Khaoula Khelifi upcoming appointments.',
          },
        },
      );

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-06-23T00:00:00.000Z',
        '9999-12-31T23:59:59.999Z',
      );
      jest.useRealTimers();
    });

    it('corrects stale past ranges only when the user asked for upcoming appointments', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-23T12:00:00Z'));
      const findAll = jest.fn().mockResolvedValue([]);
      const tool = buildListAppointmentsTool({ findAll } as any);

      await tool.handler(
        { from: '2024-01-01', to: '2024-12-31', orderBy: 'soonest' },
        {
          ...ownerCtx,
          turnState: {
            readToolCallsSoFar: 0,
            userMessage: 'Does Khaoula have upcoming appointments?',
          },
        },
      );

      expect(findAll).toHaveBeenCalledWith(
        'garage-1',
        '2026-06-23T00:00:00.000Z',
        '9999-12-31T23:59:59.999Z',
      );
      jest.useRealTimers();
    });

    it('orders by soonest startTime by default', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'late',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-03T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
        {
          id: 'early',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-01T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
        {
          id: 'mid',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-02T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler({}, ownerCtx);
      expect(result.appointments.map((a) => a.id)).toEqual([
        'early',
        'mid',
        'late',
      ]);
    });

    it('honors orderBy="latest" + limit for "last N appointments"', async () => {
      const findAll = jest.fn().mockResolvedValue([
        {
          id: 'a',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-01T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
        {
          id: 'b',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-02T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
        {
          id: 'c',
          title: 't',
          status: 'SCHEDULED',
          type: null,
          startTime: new Date('2026-05-03T10:00:00Z'),
          endTime: new Date(),
          customerId: 'c',
          carId: 'car',
          employeeId: null,
          customer: null,
          car: null,
          employee: null,
        },
      ]);
      const tool = buildListAppointmentsTool({ findAll } as any);
      const result = await tool.handler(
        { orderBy: 'latest', limit: 2 },
        ownerCtx,
      );
      expect(result.appointments.map((a) => a.id)).toEqual(['c', 'b']);
    });

    it('rejects an invalid orderBy at schema level', () => {
      const tool = buildListAppointmentsTool({ findAll: jest.fn() } as any);
      const registry = new ToolRegistryService();
      registry.register(tool);
      expect(
        registry.validateArgs('list_appointments', { orderBy: 'random' }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('list_appointments', {
          orderBy: 'soonest',
          limit: 5,
          customerName: 'Khaoula Khelifi',
          customerId: 'c1',
          status: 'SCHEDULED',
        }).valid,
      ).toBe(true);
    });
  });

  describe('find_available_slot', () => {
    it('wraps suggestSchedule with locale, duration, preferredDate', async () => {
      const suggestSchedule = jest.fn().mockResolvedValue({
        suggestedSlots: [
          {
            start: 's1',
            end: 'e1',
            mechanicId: 'm1',
            mechanicName: 'M1',
            score: 0.9,
            reason: 'r',
          },
          {
            start: 's2',
            end: 'e2',
            mechanicId: 'm2',
            mechanicName: 'M2',
            score: 0.8,
            reason: 'r',
          },
          {
            start: 's3',
            end: 'e3',
            mechanicId: 'm3',
            mechanicName: 'M3',
            score: 0.7,
            reason: 'r',
          },
          {
            start: 's4',
            end: 'e4',
            mechanicId: 'm4',
            mechanicName: 'M4',
            score: 0.6,
            reason: 'r',
          },
        ],
        provider: 'mock',
      });
      const tool = buildFindAvailableSlotTool({ suggestSchedule } as any);
      const result = await tool.handler(
        {
          date: '2026-05-01T09:00:00Z',
          durationMinutes: 60,
          appointmentType: 'oil-change',
        },
        ownerCtx,
      );

      expect(suggestSchedule).toHaveBeenCalledWith('garage-1', {
        appointmentType: 'oil-change',
        estimatedDuration: 60,
        preferredDate: '2026-05-01T09:00:00Z',
        language: 'en',
      });
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.slots).toHaveLength(3);
      expect(result.provider).toBe('mock');
    });

    it('rejects relative date text at schema level', () => {
      const tool = buildFindAvailableSlotTool({
        suggestSchedule: jest.fn(),
      } as any);
      const registry = new ToolRegistryService();
      registry.register(tool);

      expect(
        registry.validateArgs('find_available_slot', {
          date: 'this Friday',
          durationMinutes: 120,
          appointmentType: 'brake-inspection',
        }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('find_available_slot', {
          date: '2026-06-26',
          durationMinutes: 120,
          appointmentType: 'brake-inspection',
        }).valid,
      ).toBe(true);
    });

    it('corrects next-weekday dates from the user message and requests exact-day search', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-23T12:00:00Z'));
      const suggestSchedule = jest.fn().mockResolvedValue({
        suggestedSlots: [
          {
            start: '2026-06-30T08:00:00.000Z',
            end: '2026-06-30T08:30:00.000Z',
            mechanicId: 'm1',
            mechanicName: 'M1',
            score: 0.95,
            reason: 'r',
          },
        ],
        provider: 'mock',
      });
      const tool = buildFindAvailableSlotTool({ suggestSchedule } as any);

      await tool.handler(
        {
          date: '2026-06-28',
          durationMinutes: 30,
          appointmentType: 'quick-service',
        },
        {
          ...ownerCtx,
          turnState: {
            readToolCallsSoFar: 0,
            userMessage:
              'Find me a free slot next Tuesday morning for a quick service.',
          },
        },
      );

      expect(suggestSchedule).toHaveBeenCalledWith('garage-1', {
        appointmentType: 'quick-service',
        estimatedDuration: 30,
        preferredDate: '2026-06-30',
        exactDateOnly: true,
        language: 'en',
      });
      jest.useRealTimers();
    });

    it('returns invalid_date without calling suggestSchedule for direct invalid-date invocation', async () => {
      const suggestSchedule = jest.fn();
      const tool = buildFindAvailableSlotTool({ suggestSchedule } as any);

      const result = await tool.handler(
        {
          date: 'this Friday',
          durationMinutes: 120,
          appointmentType: 'brake-inspection',
        },
        ownerCtx,
      );

      expect(result).toEqual({
        error: 'invalid_date',
        message: expect.stringMatching(/concrete YYYY-MM-DD/i),
      });
      expect(suggestSchedule).not.toHaveBeenCalled();
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

      expect(create).toHaveBeenCalledWith(
        'garage-1',
        expect.objectContaining({
          customerId: 'c1',
          carId: 'car1',
          startTime: '2026-05-01T09:00:00.000Z',
          endTime: '2026-05-01T10:30:00.000Z',
          type: 'oil-change',
          title: 'oil-change',
        }),
      );
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
      const findOne = jest
        .fn()
        .mockRejectedValue(new Error('Appointment not found'));
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
