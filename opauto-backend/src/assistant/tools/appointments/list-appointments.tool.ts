import { AppointmentStatus, AssistantBlastTier } from '@prisma/client';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

type ListAppointmentsOrder = 'soonest' | 'latest';
type ListAppointmentsStatus = AppointmentStatus;

interface ListAppointmentsArgs {
  from?: string;
  to?: string;
  customerId?: string;
  customerName?: string;
  mechanicId?: string;
  status?: ListAppointmentsStatus;
  orderBy?: ListAppointmentsOrder;
  limit?: number;
}

interface ListedAppointment {
  id: string;
  title: string;
  status: string;
  type: string | null;
  /**
   * UTC ISO timestamps. Kept for machine chaining and backwards
   * compatibility; user-facing replies should use the local display fields.
   */
  startTime: string;
  endTime: string;
  startTimeLocal: string;
  endTimeLocal: string;
  timeZone: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  carId: string;
  carLabel: string;
  employeeId: string | null;
  employeeName: string | null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FAR_FUTURE = '9999-12-31T23:59:59.999Z';
const FAR_PAST = '1970-01-01T00:00:00.000Z';
const DEFAULT_TIME_ZONE = 'Africa/Tunis';

type GarageTimeZoneReader = Pick<PrismaService, 'garage'>;

function startOfUtcDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfUtcDate(date: string): string {
  return `${date}T23:59:59.999Z`;
}

function nextUtcDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function normaliseBound(
  value: string | undefined,
  edge: 'from' | 'to',
): string | undefined {
  if (!value) return undefined;
  if (DATE_ONLY_RE.test(value)) {
    return edge === 'from' ? startOfUtcDate(value) : endOfUtcDate(value);
  }
  return value;
}

function startOfTodayUtc(): string {
  return startOfUtcDate(new Date().toISOString().slice(0, 10));
}

function endOfTodayUtc(): string {
  return endOfUtcDate(new Date().toISOString().slice(0, 10));
}

function isPastRange(to: string | undefined): boolean {
  return Boolean(
    to && new Date(to).getTime() < new Date(startOfTodayUtc()).getTime(),
  );
}

function asksForFuture(message: string | undefined): boolean {
  return /\b(upcoming|future|later|coming up|booked later|next appointment|next appointments)\b/i.test(
    message ?? '',
  );
}

function asksForToday(message: string | undefined): boolean {
  return /\b(today|this morning|this afternoon|this evening)\b/i.test(
    message ?? '',
  );
}

function normaliseDateRange(
  args: ListAppointmentsArgs,
  ctx: AssistantUserContext,
): { from?: string; to?: string } {
  let from = normaliseBound(args.from, 'from');
  let to = normaliseBound(args.to, 'to');

  if (
    asksForToday(ctx.turnState?.userMessage) &&
    args.from &&
    args.to &&
    DATE_ONLY_RE.test(args.from) &&
    DATE_ONLY_RE.test(args.to) &&
    args.to === nextUtcDate(args.from)
  ) {
    to = endOfUtcDate(args.from);
  }

  if (from && !to) {
    to = FAR_FUTURE;
  } else if (!from && to) {
    from = FAR_PAST;
  }

  if (
    asksForFuture(ctx.turnState?.userMessage) &&
    !asksForToday(ctx.turnState?.userMessage) &&
    to &&
    new Date(to).getTime() <= new Date(endOfTodayUtc()).getTime()
  ) {
    from = startOfTodayUtc();
    to = FAR_FUTURE;
  } else if (asksForFuture(ctx.turnState?.userMessage) && isPastRange(to)) {
    from = startOfTodayUtc();
    to = FAR_FUTURE;
  }

  return { from, to };
}

function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function appointmentCustomerName(appointment: any): string {
  return appointment.customer
    ? `${appointment.customer.firstName ?? ''} ${appointment.customer.lastName ?? ''}`.trim()
    : '';
}

function appointmentCustomerEmail(appointment: any): string | null {
  const email = appointment.customer?.email;
  return typeof email === 'string' && email.trim().length > 0
    ? email.trim()
    : null;
}

function normaliseTimeZone(value: unknown): string {
  const zone = typeof value === 'string' ? value.trim() : '';
  if (!zone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date(0));
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function extractBusinessHoursTimeZone(businessHours: unknown): string | null {
  if (!businessHours) return null;
  if (typeof businessHours === 'string') {
    try {
      return extractBusinessHoursTimeZone(JSON.parse(businessHours));
    } catch {
      return null;
    }
  }
  if (typeof businessHours !== 'object' || Array.isArray(businessHours)) {
    return null;
  }
  const timeZone = (businessHours as { timezone?: unknown; timeZone?: unknown })
    .timezone;
  if (typeof timeZone === 'string') return timeZone;
  const camelCaseZone = (
    businessHours as { timezone?: unknown; timeZone?: unknown }
  ).timeZone;
  return typeof camelCaseZone === 'string' ? camelCaseZone : null;
}

async function resolveGarageTimeZone(
  prisma: GarageTimeZoneReader | undefined,
  garageId: string,
): Promise<string> {
  if (!prisma) return DEFAULT_TIME_ZONE;
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: { businessHours: true },
  });
  return normaliseTimeZone(extractBusinessHoursTimeZone(garage?.businessHours));
}

function localeTag(locale: AssistantUserContext['locale']): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-TN';
  return 'en-US';
}

function formatLocalDateTime(
  value: unknown,
  timeZone: string,
  locale: AssistantUserContext['locale'],
): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

const APPOINTMENT_STATUSES: ListAppointmentsStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export function buildListAppointmentsTool(
  appointmentsService: AppointmentsService,
  prisma?: GarageTimeZoneReader,
): ToolDefinition<
  ListAppointmentsArgs,
  { appointments: ListedAppointment[]; count: number }
> {
  return {
    name: 'list_appointments',
    description:
      'List appointments for the current garage in an optional date range. Use this to see scheduled, ongoing, or completed appointments. Optionally filter by mechanic (employeeId). ' +
      'When the user asks about a named customer, pass customerName from the user prompt or customerId from find_customer; do not run a garage-wide appointment scan for a customer-specific question. ' +
      'For "upcoming", "later", or "future" appointments, use a from date of today or later; never pass a past year for an upcoming question. ' +
      'A date-only from/to such as 2026-07-10 covers the full calendar day. ' +
      'For "today", pass the same YYYY-MM-DD as both from and to; do not pass tomorrow as the upper bound. ' +
      'Results include UTC ISO fields (`startTime`, `endTime`) and garage-local fields (`startTimeLocal`, `endTimeLocal`, `timeZone`); use the local fields in user-facing answers and emails. ' +
      'IMPORTANT — ORDERING: pass `orderBy: "soonest"` (default) for "next/upcoming/first appointment(s)"; ' +
      '`orderBy: "latest"` for "last/most recent" appointments. Combine with `limit` to answer ' +
      '"first/next/last N appointments" (e.g. "next 3 appointments today" → ' +
      '{from:"2026-04-27", to:"2026-04-27", orderBy:"soonest", limit:3}).',
    blastTier: AssistantBlastTier.READ,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: {
          type: 'string',
          description:
            'Inclusive lower bound. Accepts YYYY-MM-DD or full ISO 8601.',
        },
        to: {
          type: 'string',
          description:
            'Inclusive upper bound. Accepts YYYY-MM-DD or full ISO 8601.',
        },
        customerId: {
          type: 'string',
          description:
            'Optional customer id from find_customer. Use this for customer-specific appointment questions.',
        },
        customerName: {
          type: 'string',
          description:
            'Optional customer full or partial name from the user prompt. Use when the user names a customer and no id is available.',
        },
        mechanicId: {
          type: 'string',
          description: 'Optional employee/mechanic id to filter on.',
        },
        status: {
          type: 'string',
          enum: APPOINTMENT_STATUSES,
          description: 'Optional appointment status filter.',
        },
        orderBy: {
          type: 'string',
          enum: ['soonest', 'latest'],
          description:
            'Sort by startTime. "soonest" (default) returns earliest first — use for "next/upcoming/first"; ' +
            '"latest" returns most recent first — use for "last/recent".',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description:
            'Max number of appointments to return (1-100). Use with orderBy for "first/last N" requests.',
        },
      },
    },
    handler: async (args, ctx: AssistantUserContext) => {
      const { from, to } = normaliseDateRange(args, ctx);
      const timeZone = await resolveGarageTimeZone(prisma, ctx.garageId);
      const all = await appointmentsService.findAll(ctx.garageId, from, to);
      const requestedCustomerName = args.customerName
        ? normaliseName(args.customerName)
        : null;
      const filtered = all.filter((a: any) => {
        if (args.customerId && a.customerId !== args.customerId) return false;
        if (requestedCustomerName) {
          const actual = normaliseName(appointmentCustomerName(a));
          if (!actual.includes(requestedCustomerName)) return false;
        }
        if (args.mechanicId && a.employeeId !== args.mechanicId) return false;
        if (args.status && a.status !== args.status) return false;
        return true;
      });
      const direction = args.orderBy === 'latest' ? -1 : 1;
      const sorted = [...filtered].sort((a: any, b: any) => {
        const ta = new Date(a.startTime).getTime();
        const tb = new Date(b.startTime).getTime();
        return (ta - tb) * direction;
      });
      const sliced = args.limit ? sorted.slice(0, args.limit) : sorted;
      const projected: ListedAppointment[] = sliced.map((a: any) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        type: a.type ?? null,
        startTime: new Date(a.startTime).toISOString(),
        endTime: new Date(a.endTime).toISOString(),
        startTimeLocal: formatLocalDateTime(a.startTime, timeZone, ctx.locale),
        endTimeLocal: formatLocalDateTime(a.endTime, timeZone, ctx.locale),
        timeZone,
        customerId: a.customerId,
        customerName: appointmentCustomerName(a),
        customerEmail: appointmentCustomerEmail(a),
        carId: a.carId,
        carLabel: a.car
          ? `${a.car.make ?? ''} ${a.car.model ?? ''}${a.car.licensePlate ? ` · ${a.car.licensePlate}` : ''}`.trim()
          : '',
        employeeId: a.employeeId ?? null,
        employeeName: a.employee
          ? `${a.employee.firstName ?? ''} ${a.employee.lastName ?? ''}`.trim()
          : null,
      }));
      return { appointments: projected, count: projected.length };
    },
  };
}
