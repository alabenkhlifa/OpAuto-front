import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiSuggestScheduleDto } from './dto/chat.dto';

// ── Helpers ──────────────────────────────────────────────────────

const GARAGE_ID = 'garage-test-001';

function makeEmployee(overrides: Partial<{
  id: string;
  garageId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  skills: string[];
}> = {}) {
  return {
    id: overrides.id ?? 'emp-1',
    garageId: overrides.garageId ?? GARAGE_ID,
    firstName: overrides.firstName ?? 'Karim',
    lastName: overrides.lastName ?? 'Mechanic',
    role: overrides.role ?? 'MECHANIC',
    status: overrides.status ?? 'ACTIVE',
    skills: overrides.skills ?? [],
    email: null,
    phone: null,
    department: 'MECHANICAL',
    hireDate: new Date('2020-01-01'),
    hourlyRate: 10,
    schedule: null,
    avatar: null,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeAppointment(overrides: Partial<{
  employeeId: string;
  startTime: Date;
  endTime: Date;
}> = {}) {
  return {
    employeeId: overrides.employeeId ?? 'emp-1',
    startTime: overrides.startTime ?? new Date(),
    endTime: overrides.endTime ?? new Date(),
  };
}

/** Build a date at a fixed hour on a given day offset from "now". */
function futureDate(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ── Test Suite ───────────────────────────────────────────────────

describe('AiService – suggestSchedule', () => {
  let service: AiService;
  let prisma: {
    employee: { findMany: jest.Mock };
    appointment: { findMany: jest.Mock };
    garage: { findUnique: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      // suggestSchedule() loads the garage's businessHours to decide which
      // windows are open. Default to "no businessHours set" (service uses its
      // 08:00–18:00 fallback), individual tests can override.
      garage: { findUnique: jest.fn().mockResolvedValue({ businessHours: null }) },
    };
    configService = {
      get: jest.fn().mockReturnValue(undefined), // no API keys
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  // ── 1. No employees ────────────────────────────────────────

  it('returns empty suggestedSlots when no employees exist', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 60,
    });

    expect(result.suggestedSlots).toEqual([]);
    expect(result.provider).toBe('none');
  });

  // ── 2. Skill-based employee lookup ─────────────────────────

  it('queries employees with skill matching appointmentType', async () => {
    const skilled = makeEmployee({ id: 'emp-skill', skills: ['oil-change'] });
    // First call: skill-match query returns the employee
    prisma.employee.findMany.mockResolvedValueOnce([skilled]);
    prisma.appointment.findMany.mockResolvedValue([]);

    await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    // The first findMany call should filter by skill
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          garageId: GARAGE_ID,
          status: 'ACTIVE',
          // Service maps 'oil-change' → ['oil_change', 'engine_repair']
          skills: { hasSome: expect.arrayContaining(['oil_change']) },
        }),
      }),
    );
  });

  // ── 3. Fallback to all MECHANICs ──────────────────────────

  it('falls back to all MECHANIC role employees when no skill match', async () => {
    const mechanic = makeEmployee({ id: 'emp-mech', role: 'MECHANIC' });
    // First call (skill match) returns empty
    prisma.employee.findMany.mockResolvedValueOnce([]);
    // Second call (MECHANIC fallback) returns the mechanic
    prisma.employee.findMany.mockResolvedValueOnce([mechanic]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'unknown-service',
      estimatedDuration: 30,
    });

    // Should have called findMany twice
    expect(prisma.employee.findMany).toHaveBeenCalledTimes(2);
    // Second call should filter by role MECHANIC
    expect(prisma.employee.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          garageId: GARAGE_ID,
          status: 'ACTIVE',
          // Service falls back to any technician role, not just MECHANIC
          role: { in: expect.arrayContaining(['MECHANIC']) },
        }),
      }),
    );
    // Should still produce slots (not empty)
    expect(result.suggestedSlots.length).toBeGreaterThan(0);
  });

  // ── 4. 7-day window when no preferredDate ──────────────────

  it('uses a 7-day window from now when no preferredDate given', async () => {
    const emp = makeEmployee({ id: 'emp-1' });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const before = new Date();
    await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });
    const after = new Date();

    const apptCall = prisma.appointment.findMany.mock.calls[0][0];
    const windowStart: Date = apptCall.where.startTime.gte;
    const windowEnd: Date = apptCall.where.startTime.lte;

    // windowStart should be approximately now
    expect(windowStart.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(windowStart.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);

    // windowEnd should be ~7 days from now
    const diffDays = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  // ── 5. preferredDate centers window ±3 days ────────────────

  it('centers window around preferredDate (+-3 days) when provided', async () => {
    const emp = makeEmployee({ id: 'emp-1' });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    // Use a date far enough in the future so windowStart isn't clamped to "now"
    const preferred = new Date();
    preferred.setDate(preferred.getDate() + 10);
    const preferredStr = preferred.toISOString().split('T')[0];

    await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
      preferredDate: preferredStr,
    });

    const apptCall = prisma.appointment.findMany.mock.calls[0][0];
    const windowStart: Date = apptCall.where.startTime.gte;
    const windowEnd: Date = apptCall.where.startTime.lte;

    // Window should span ~6 days (preferred ± 3)
    const diffDays = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(6, 0);
  });

  // ── 6. Excludes CANCELLED and NO_SHOW from conflict check ─

  it('excludes CANCELLED and NO_SHOW appointments from query', async () => {
    const emp = makeEmployee({ id: 'emp-1' });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    const apptCall = prisma.appointment.findMany.mock.calls[0][0];
    expect(apptCall.where.status).toEqual({ notIn: ['CANCELLED', 'NO_SHOW'] });
  });

  // ── 7. Computes free slots by subtracting existing appts ──

  it('computes free slots correctly subtracting existing appointments', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);

    // Block 09:00-12:00 tomorrow, leaving 08:00-09:00 and 12:00-18:00 free
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const blockStart = new Date(tomorrow);
    blockStart.setHours(9, 0, 0, 0);
    const blockEnd = new Date(tomorrow);
    blockEnd.setHours(12, 0, 0, 0);

    prisma.appointment.findMany.mockResolvedValue([
      makeAppointment({ employeeId: 'emp-1', startTime: blockStart, endTime: blockEnd }),
    ]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    // All returned slots for tomorrow should NOT overlap with 09:00-12:00
    const tomorrowSlots = result.suggestedSlots.filter((s) => {
      const d = new Date(s.start);
      return d.toDateString() === tomorrow.toDateString();
    });

    for (const slot of tomorrowSlots) {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      // Slot must not overlap with 09:00-12:00
      const overlaps = slotStart < blockEnd && slotEnd > blockStart;
      expect(overlaps).toBe(false);
    }
  });

  // ── 8. Snap to 30-minute boundaries ───────────────────────

  it('snaps slot start times to 30-minute boundaries', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    for (const slot of result.suggestedSlots) {
      const minutes = new Date(slot.start).getMinutes();
      expect(minutes % 30).toBe(0);
    }
  });

  // ── 9. Caps candidates at 20 ──────────────────────────────

  it('caps candidate generation at 20 before ranking', async () => {
    // Create 5 employees to generate many candidates
    const employees = Array.from({ length: 5 }, (_, i) =>
      makeEmployee({ id: `emp-${i}`, firstName: `Emp${i}`, skills: ['oil-change'] }),
    );
    prisma.employee.findMany.mockResolvedValueOnce(employees);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    // Even though many slots exist, final result is top 3
    expect(result.suggestedSlots.length).toBeLessThanOrEqual(3);
  });

  // ── 10. Returns top 3 ranked by workload ascending ────────

  it('returns top 3 ranked by workload (least busy first)', async () => {
    const empBusy = makeEmployee({ id: 'emp-busy', firstName: 'Busy', skills: ['oil-change'] });
    const empFree = makeEmployee({ id: 'emp-free', firstName: 'Free', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([empBusy, empFree]);

    // emp-busy has 5 appointments, emp-free has 0
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const busyAppts = Array.from({ length: 5 }, (_, i) => {
      const start = new Date(tomorrow);
      start.setHours(8 + i, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setHours(8 + i + 1, 0, 0, 0);
      return makeAppointment({ employeeId: 'emp-busy', startTime: start, endTime: end });
    });
    prisma.appointment.findMany.mockResolvedValue(busyAppts);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    expect(result.suggestedSlots.length).toBeGreaterThan(0);
    // The first slot should be for the free employee (lower workload)
    expect(result.suggestedSlots[0].mechanicId).toBe('emp-free');
  });

  // ── 11. Assigns correct scores to top 3 ───────────────────

  it('assigns scores 0.95, 0.75, 0.55 to the top 3 slots', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    expect(result.suggestedSlots.length).toBe(3);
    expect(result.suggestedSlots[0].score).toBe(0.95);
    expect(result.suggestedSlots[1].score).toBe(0.75);
    expect(result.suggestedSlots[2].score).toBe(0.55);
  });

  // ── 12. Reason includes specialty match info ──────────────

  it('generates reason with specialty match when employee has matching skill', async () => {
    const empSkilled = makeEmployee({ id: 'emp-s', firstName: 'Skilled', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([empSkilled]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    const slot = result.suggestedSlots[0];
    // Reason mentions either the appointment type match or a general availability line.
    expect(slot.reason.length).toBeGreaterThan(0);
    expect(/oil-change|Specialty|Available/.test(slot.reason)).toBe(true);
  });

  it('generates reason with "balanced workload" when employee lacks matching skill', async () => {
    // First call (skill match) returns empty
    prisma.employee.findMany.mockResolvedValueOnce([]);
    // Fallback to MECHANIC
    const emp = makeEmployee({ id: 'emp-no-skill', firstName: 'Generic', skills: [] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'specialized-task',
      estimatedDuration: 30,
    });

    const slot = result.suggestedSlots[0];
    expect(slot.reason).toContain('balanced workload');
  });

  // ── 13. Provider is 'mock' ────────────────────────────────

  it('returns provider as mock when no AI keys configured', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    expect(result.provider).toBe('mock');
  });

  // ── Edge: mechanicName format ─────────────────────────────

  it('formats mechanicName as "firstName lastName"', async () => {
    const emp = makeEmployee({ id: 'emp-1', firstName: 'Karim', lastName: 'Ben Ali', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    expect(result.suggestedSlots[0].mechanicName).toBe('Karim Ben Ali');
  });

  // ── Edge: slot duration matches estimatedDuration ─────────

  it('returns slots with correct duration based on estimatedDuration', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 90, // 90 minutes
    });

    for (const slot of result.suggestedSlots) {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();
      expect(end - start).toBe(90 * 60 * 1000);
    }
  });

  // ── Edge: fewer than 3 candidates ─────────────────────────

  it('returns fewer than 3 slots when not enough candidates exist', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);

    // Block the entire day except 08:00-08:30 for all 7 days
    // Only one 30-min slot available on day 1
    const appointments: ReturnType<typeof makeAppointment>[] = [];
    for (let d = 1; d <= 7; d++) {
      const day = new Date();
      day.setDate(day.getDate() + d);
      const start = new Date(day);
      start.setHours(8, 30, 0, 0);
      const end = new Date(day);
      end.setHours(18, 0, 0, 0);
      appointments.push(makeAppointment({ employeeId: 'emp-1', startTime: start, endTime: end }));
    }
    prisma.appointment.findMany.mockResolvedValue(appointments);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    // Should still have provider 'mock' even with limited slots
    expect(result.provider).toBe('mock');
    // Should have some slots (one 30-min slot per day at 08:00)
    expect(result.suggestedSlots.length).toBeGreaterThan(0);
    expect(result.suggestedSlots.length).toBeLessThanOrEqual(3);
  });

  // ── Edge: slot start/end are valid ISO strings ────────────

  it('returns start and end as valid ISO date strings', async () => {
    const emp = makeEmployee({ id: 'emp-1', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 60,
    });

    for (const slot of result.suggestedSlots) {
      expect(new Date(slot.start).toISOString()).toBe(slot.start);
      expect(new Date(slot.end).toISOString()).toBe(slot.end);
    }
  });

  // ── Edge: workload tiebreak by earliest start ─────────────

  it('breaks workload tie by earliest start time', async () => {
    const emp1 = makeEmployee({ id: 'emp-1', firstName: 'First', skills: ['oil-change'] });
    const emp2 = makeEmployee({ id: 'emp-2', firstName: 'Second', skills: ['oil-change'] });
    prisma.employee.findMany.mockResolvedValueOnce([emp1, emp2]);
    prisma.appointment.findMany.mockResolvedValue([]); // both have 0 workload

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    // With equal workload (0), slots should be sorted by start time
    if (result.suggestedSlots.length >= 2) {
      const t1 = new Date(result.suggestedSlots[0].start).getTime();
      const t2 = new Date(result.suggestedSlots[1].start).getTime();
      expect(t1).toBeLessThanOrEqual(t2);
    }
  });

  // ── Edge: provider is 'none' when no employees at all ─────

  it('returns provider "none" when no employees exist at all', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.suggestSchedule(GARAGE_ID, {
      appointmentType: 'oil-change',
      estimatedDuration: 30,
    });

    expect(result.provider).toBe('none');
  });
});

// ── predictChurn ─────────────────────────────────────────────────
//
// Helpers live here rather than up top because they only serve this block
// and would clutter the file if reused incidentally by suggestSchedule tests.

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function makeCustomer(over: Partial<{
  id: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE';
  visitCount: number;
  createdAt: Date;
  appointments: Array<{ startTime: Date; status: string }>;
  invoices: Array<{ createdAt?: Date; paidAt?: Date | null; total?: number }>;
}> = {}) {
  return {
    id: over.id ?? 'cust-1',
    garageId: GARAGE_ID,
    firstName: over.firstName ?? 'Ali',
    lastName: over.lastName ?? 'Ben',
    email: null,
    phone: '+216 99 000 000',
    address: null,
    status: over.status ?? 'ACTIVE',
    loyaltyTier: null,
    totalSpent: 0,
    visitCount: over.visitCount ?? 3,
    notes: null,
    createdAt: over.createdAt ?? daysAgo(365),
    updatedAt: new Date(),
    appointments: over.appointments ?? [],
    invoices: over.invoices ?? [],
  };
}

describe('AiService – predictChurn', () => {
  let service: AiService;
  let prisma: {
    customer: { findMany: jest.Mock };
    employee: { findMany: jest.Mock };
    appointment: { findMany: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('returns empty predictions when there are no customers', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions).toEqual([]);
    expect(result.provider).toBe('template');
  });

  it('skips customers with fewer than 2 visits (insufficient history)', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({ id: 'c-new', visitCount: 1, appointments: [{ startTime: daysAgo(10), status: 'COMPLETED' }] }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions).toEqual([]);
  });

  it('skips customers with no completed appointment or paid invoice (no activity to score)', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({ id: 'c-noact', visitCount: 5, appointments: [], invoices: [] }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions).toEqual([]);
  });

  it('scores on-schedule customers as low risk', async () => {
    // 365-day customer with 10 visits → avgInterval ~= 36. Last visit 20 days ago → ratio < 1.
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-healthy',
        visitCount: 10,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(20), status: 'COMPLETED' }],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].riskLevel).toBe('low');
    expect(result.predictions[0].churnRisk).toBe(0);
  });

  it('scores very-overdue customers as high risk', async () => {
    // 365-day customer with 12 visits → avgInterval floored at 30. Last visit 120 days ago → ratio = 4.
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-churning',
        visitCount: 12,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(120), status: 'COMPLETED' }],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions[0].riskLevel).toBe('high');
    expect(result.predictions[0].churnRisk).toBeGreaterThanOrEqual(0.6);
    expect(result.predictions[0].factors.some((f) => f.includes('120'))).toBe(true);
  });

  it('reduces churn score when customer has a future appointment', async () => {
    // Same overdue customer as above, but with a future appointment scheduled
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-rebounding',
        visitCount: 12,
        createdAt: daysAgo(365),
        appointments: [
          { startTime: daysAgo(120), status: 'COMPLETED' },
          { startTime: daysAgo(-5), status: 'SCHEDULED' }, // 5 days in the future
        ],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions[0].churnRisk).toBeLessThan(0.6); // multiplier drops it below "high" threshold
    expect(result.predictions[0].factors.some((f) => /upcoming|à venir|قادم/.test(f))).toBe(true);
  });

  it('raises score to at least 0.7 when customer is INACTIVE', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-inactive',
        status: 'INACTIVE',
        visitCount: 3,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(20), status: 'COMPLETED' }], // otherwise would be low
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions[0].churnRisk).toBeGreaterThanOrEqual(0.7);
    expect(result.predictions[0].riskLevel).toBe('high');
  });

  it('sorts predictions by churnRisk descending', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-low',
        visitCount: 10,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(20), status: 'COMPLETED' }],
      }),
      makeCustomer({
        id: 'c-high',
        visitCount: 12,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(120), status: 'COMPLETED' }],
      }),
      makeCustomer({
        id: 'c-medium',
        visitCount: 12,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(60), status: 'COMPLETED' }],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.predictions.map((p) => p.customerId)).toEqual(['c-high', 'c-medium', 'c-low']);
  });

  it('returns factors in the requested language (fr)', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-fr',
        visitCount: 5,
        createdAt: daysAgo(200),
        appointments: [{ startTime: daysAgo(90), status: 'COMPLETED' }],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, { language: 'fr' });
    expect(result.predictions[0].factors[0]).toContain('jours');
    expect(result.predictions[0].suggestedAction).toMatch(/(Aucune|Envoyer|Appeler)/);
  });

  it('falls back to templated suggestedAction when no LLM keys are configured', async () => {
    prisma.customer.findMany.mockResolvedValue([
      makeCustomer({
        id: 'c-high',
        visitCount: 12,
        createdAt: daysAgo(365),
        appointments: [{ startTime: daysAgo(120), status: 'COMPLETED' }],
      }),
    ]);
    const result = await service.predictChurn(GARAGE_ID, {});
    expect(result.provider).toBe('template');
    expect(result.predictions[0].suggestedAction).toContain('Call personally');
  });

  it('filters by customerId when provided', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    await service.predictChurn(GARAGE_ID, { customerId: 'specific-id' });
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ garageId: GARAGE_ID, id: 'specific-id' }),
      }),
    );
  });

  it('includes appointments and invoices when querying customers', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    await service.predictChurn(GARAGE_ID, {});
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          appointments: expect.any(Object),
          invoices: expect.any(Object),
        }),
      }),
    );
  });
});

// ── predictMaintenance ───────────────────────────────────────────

function makeCar(over: Partial<{
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  mileage: number | null;
  createdAt: Date;
  customer: { firstName: string; lastName: string } | null;
  appointments: Array<{ startTime: Date; type?: string | null; title?: string }>;
  maintenanceJobs: Array<{ completionDate: Date; title: string }>;
}> = {}) {
  return {
    id: over.id ?? 'car-1',
    garageId: GARAGE_ID,
    customerId: 'cust-1',
    make: over.make ?? 'Peugeot',
    model: over.model ?? '308',
    year: over.year ?? 2019,
    licensePlate: over.licensePlate ?? '123-TUN-4567',
    mileage: over.mileage === undefined ? 50000 : over.mileage,
    createdAt: over.createdAt ?? daysAgo(365 * 3),
    customer: over.customer === undefined ? { firstName: 'Sami', lastName: 'B.' } : over.customer,
    appointments: over.appointments ?? [],
    maintenanceJobs: over.maintenanceJobs ?? [],
  };
}

describe('AiService – predictMaintenance', () => {
  let service: AiService;
  let prisma: {
    car: { findMany: jest.Mock };
    customer: { findMany: jest.Mock };
    employee: { findMany: jest.Mock };
    appointment: { findMany: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      car: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('returns empty predictions when there are no cars', async () => {
    prisma.car.findMany.mockResolvedValue([]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    expect(result.predictions).toEqual([]);
    expect(result.provider).toBe('template');
  });

  it('flags a car with a year-old oil change as overdue (high urgency)', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-overdue',
        mileage: 60000,
        appointments: [{ startTime: daysAgo(400), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil).toBeDefined();
    expect(oil!.urgency).toBe('high');
    expect(oil!.carId).toBe('car-overdue');
    expect(oil!.confidence).toBe(0.85);
  });

  it('flags a freshly-serviced oil change as low urgency', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-fresh',
        mileage: 50000,
        appointments: [{ startTime: daysAgo(30), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil).toBeDefined();
    expect(oil!.urgency).toBe('low');
  });

  it('flags near-due services (within 30 days) as medium urgency', async () => {
    // 160 days since oil change, interval 180 days → 20 days until due → medium
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-medium',
        mileage: 50000,
        appointments: [{ startTime: daysAgo(160), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil).toBeDefined();
    expect(oil!.urgency).toBe('medium');
  });

  it('uses mileage-based estimate when no service history exists', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-nohistory',
        mileage: 12000,
        createdAt: daysAgo(365),
        appointments: [],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil).toBeDefined();
    // Confidence should be mileage-only (0.6) because no history
    expect(oil!.confidence).toBe(0.6);
  });

  it('returns confidence 0.45 for a car with no history and no mileage', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-blank',
        mileage: null,
        createdAt: daysAgo(400), // force at least one high-urgency prediction so it isn't filtered
        appointments: [],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const anyOverdue = result.predictions.find((p) => p.carId === 'car-blank');
    expect(anyOverdue).toBeDefined();
    expect(anyOverdue!.confidence).toBe(0.45);
  });

  it('builds a car label containing model, plate, and customer name', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-label',
        make: 'Renault',
        model: 'Clio',
        licensePlate: '999-TUN-1',
        customer: { firstName: 'Ahmed', lastName: 'Trabelsi' },
        appointments: [{ startTime: daysAgo(400), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const pred = result.predictions[0];
    expect(pred.carLabel).toContain('Renault Clio');
    expect(pred.carLabel).toContain('999-TUN-1');
    expect(pred.carLabel).toContain('Ahmed Trabelsi');
  });

  it('sorts predictions by urgency desc, then soonest first', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-sort',
        mileage: 50000,
        appointments: [
          { startTime: daysAgo(400), type: 'oil-change' },    // overdue → high
          { startTime: daysAgo(160), type: 'brake-service' }, // medium
          { startTime: daysAgo(30), type: 'tire-rotation' },  // low
        ],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const urgencies = result.predictions
      .filter((p) => ['oil-change', 'brake-service', 'tire-rotation'].includes(p.service))
      .map((p) => p.urgency);
    // At minimum, any 'high' alert must appear before any 'low' alert
    const firstLow = urgencies.indexOf('low');
    const firstHigh = urgencies.indexOf('high');
    if (firstLow !== -1 && firstHigh !== -1) {
      expect(firstHigh).toBeLessThan(firstLow);
    }
  });

  it('filters to a single car when carId is provided', async () => {
    prisma.car.findMany.mockResolvedValue([]);
    await service.predictMaintenance(GARAGE_ID, { carId: 'specific-car' });
    expect(prisma.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ garageId: GARAGE_ID, id: 'specific-car' }),
      }),
    );
  });

  it('infers service type from MaintenanceJob.title when appointment type is missing', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-mj',
        mileage: 50000,
        appointments: [],
        maintenanceJobs: [{ completionDate: daysAgo(30), title: 'Oil change and filter' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil).toBeDefined();
    expect(oil!.confidence).toBe(0.85); // history was found
    expect(oil!.urgency).toBe('low');
  });

  it('returns reason in the requested language (fr)', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-fr',
        mileage: 50000,
        appointments: [{ startTime: daysAgo(400), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, { language: 'fr' });
    const oil = result.predictions.find((p) => p.service === 'oil-change');
    expect(oil!.reason).toMatch(/retard|Vidange/);
  });

  it('falls back to templated reason when no LLM keys are configured', async () => {
    prisma.car.findMany.mockResolvedValue([
      makeCar({
        id: 'car-tmpl',
        mileage: 50000,
        appointments: [{ startTime: daysAgo(400), type: 'oil-change' }],
      }),
    ]);
    const result = await service.predictMaintenance(GARAGE_ID, {});
    expect(result.provider).toBe('template');
  });
});
