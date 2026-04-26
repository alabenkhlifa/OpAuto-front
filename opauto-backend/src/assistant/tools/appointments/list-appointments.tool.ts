import { AssistantBlastTier } from '@prisma/client';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

interface ListAppointmentsArgs {
  from?: string;
  to?: string;
  mechanicId?: string;
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
      'List appointments for the current garage in an optional date range. Use this to see scheduled, ongoing, or completed appointments. Optionally filter by mechanic (employeeId).',
    blastTier: AssistantBlastTier.READ,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: {
          type: 'string',
          format: 'date-time',
          description: 'Inclusive ISO date-time lower bound. If omitted, no lower bound applied.',
        },
        to: {
          type: 'string',
          format: 'date-time',
          description: 'Inclusive ISO date-time upper bound. If omitted, no upper bound applied.',
        },
        mechanicId: {
          type: 'string',
          description: 'Optional employee/mechanic id to filter on.',
        },
      },
    },
    handler: async (args, ctx: AssistantUserContext) => {
      // findAll only applies a date filter when BOTH from and to are present.
      const all = await appointmentsService.findAll(ctx.garageId, args.from, args.to);
      const filtered = args.mechanicId
        ? all.filter((a: any) => a.employeeId === args.mechanicId)
        : all;
      const projected: ListedAppointment[] = filtered.map((a: any) => ({
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
