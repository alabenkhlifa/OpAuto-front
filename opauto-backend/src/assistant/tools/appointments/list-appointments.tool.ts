import { AssistantBlastTier } from '@prisma/client';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

type ListAppointmentsOrder = 'soonest' | 'latest';

interface ListAppointmentsArgs {
  from?: string;
  to?: string;
  mechanicId?: string;
  orderBy?: ListAppointmentsOrder;
  limit?: number;
}

interface ListedAppointment {
  id: string;
  title: string;
  status: string;
  type: string | null;
  startTime: string;
  endTime: string;
  customerId: string;
  customerName: string;
  carId: string;
  carLabel: string;
  employeeId: string | null;
  employeeName: string | null;
}

export function buildListAppointmentsTool(
  appointmentsService: AppointmentsService,
): ToolDefinition<ListAppointmentsArgs, { appointments: ListedAppointment[]; count: number }> {
  return {
    name: 'list_appointments',
    description:
      'List appointments for the current garage in an optional date range. Use this to see scheduled, ongoing, or completed appointments. Optionally filter by mechanic (employeeId). ' +
      'IMPORTANT — ORDERING: pass `orderBy: "soonest"` (default) for "next/upcoming/first appointment(s)"; ' +
      '`orderBy: "latest"` for "last/most recent" appointments. Combine with `limit` to answer ' +
      '"first/next/last N appointments" (e.g. "next 3 appointments today" → ' +
      '{from:"2026-04-27", to:"2026-04-28", orderBy:"soonest", limit:3}).',
    blastTier: AssistantBlastTier.READ,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: {
          type: 'string',
          description: 'Inclusive lower bound. Accepts YYYY-MM-DD or full ISO 8601.',
        },
        to: {
          type: 'string',
          description: 'Inclusive upper bound. Accepts YYYY-MM-DD or full ISO 8601.',
        },
        mechanicId: {
          type: 'string',
          description: 'Optional employee/mechanic id to filter on.',
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
      // findAll only applies a date filter when BOTH from and to are present.
      const all = await appointmentsService.findAll(ctx.garageId, args.from, args.to);
      const filtered = args.mechanicId
        ? all.filter((a: any) => a.employeeId === args.mechanicId)
        : all;
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
        customerId: a.customerId,
        customerName: a.customer
          ? `${a.customer.firstName ?? ''} ${a.customer.lastName ?? ''}`.trim()
          : '',
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
