import { AssistantBlastTier } from '@prisma/client';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

interface CreateAppointmentArgs {
  customerId: string;
  carId: string;
  scheduledAt: string;
  durationMinutes: number;
  notes?: string;
  type?: string;
  title?: string;
}

interface CreateAppointmentResult {
  appointmentId: string;
  customerId: string;
  carId: string;
  startTime: string;
  endTime: string;
  status: string;
  title: string;
}

export function buildCreateAppointmentTool(
  appointmentsService: AppointmentsService,
  prisma: PrismaService,
): ToolDefinition<CreateAppointmentArgs, CreateAppointmentResult> {
  return {
    name: 'create_appointment',
    description:
      'Create a new appointment. Verifies the customer and car belong to the garage. Computes endTime from scheduledAt + durationMinutes. Requires user approval before execution.',
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'carId', 'scheduledAt', 'durationMinutes'],
      properties: {
        customerId: { type: 'string', minLength: 1 },
        carId: { type: 'string', minLength: 1 },
        scheduledAt: {
          type: 'string',
          description:
            'Appointment start time. Accepts YYYY-MM-DDTHH:mm or full ISO 8601 (e.g. 2026-04-30T14:30:00Z).',
        },
        durationMinutes: {
          type: 'integer',
          minimum: 15,
          maximum: 600,
          description: 'Duration in minutes; endTime is computed as start + duration.',
        },
        notes: { type: 'string', maxLength: 2000 },
        type: {
          type: 'string',
          description: 'Service type slug (oil-change, brake-service, etc.).',
        },
        title: {
          type: 'string',
          maxLength: 200,
          description: 'Short title; defaults to type or "Appointment" if omitted.',
        },
      },
    },
    handler: async (args, ctx: AssistantUserContext): Promise<CreateAppointmentResult> => {
      // Multi-tenancy ownership checks: customer and car must belong to ctx.garageId.
      // appointmentsService.create() trusts the DTO, so we verify here.
      const customer = await prisma.customer.findFirst({
        where: { id: args.customerId, garageId: ctx.garageId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error(`Customer ${args.customerId} not found in this garage`);
      }
      const car = await prisma.car.findFirst({
        where: { id: args.carId, garageId: ctx.garageId, customerId: args.customerId },
        select: { id: true },
      });
      if (!car) {
        throw new Error(
          `Car ${args.carId} not found for customer ${args.customerId} in this garage`,
        );
      }

      const start = new Date(args.scheduledAt);
      if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid scheduledAt: ${args.scheduledAt}`);
      }
      const end = new Date(start.getTime() + args.durationMinutes * 60_000);

      const created = await appointmentsService.create(ctx.garageId, {
        customerId: args.customerId,
        carId: args.carId,
        title: args.title ?? args.type ?? 'Appointment',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        type: args.type,
        notes: args.notes,
      });

      return {
        appointmentId: created.id,
        customerId: created.customerId,
        carId: created.carId,
        startTime: new Date(created.startTime).toISOString(),
        endTime: new Date(created.endTime).toISOString(),
        status: created.status,
        title: created.title,
      };
    },
  };
}
