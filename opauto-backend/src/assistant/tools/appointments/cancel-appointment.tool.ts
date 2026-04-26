import { AssistantBlastTier, AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

interface CancelAppointmentArgs {
  appointmentId: string;
  reason?: string;
}

interface CancelAppointmentResult {
  cancelled: true;
  appointmentId: string;
}

export function buildCancelAppointmentTool(
  appointmentsService: AppointmentsService,
): ToolDefinition<CancelAppointmentArgs, CancelAppointmentResult> {
  return {
    name: 'cancel_appointment',
    description:
      'Cancel an existing appointment by setting its status to CANCELLED. Verifies the appointment belongs to the current garage. Requires user approval before execution.',
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId'],
      properties: {
        appointmentId: { type: 'string', minLength: 1 },
        reason: {
          type: 'string',
          maxLength: 500,
          description: 'Optional reason; appended to the appointment notes.',
        },
      },
    },
    handler: async (args, ctx: AssistantUserContext): Promise<CancelAppointmentResult> => {
      // findOne already enforces garageId ownership and throws NotFoundException otherwise.
      const existing = await appointmentsService.findOne(args.appointmentId, ctx.garageId);

      const notes = args.reason
        ? existing.notes
          ? `${existing.notes}\n[cancelled] ${args.reason}`
          : `[cancelled] ${args.reason}`
        : existing.notes ?? undefined;

      await appointmentsService.update(args.appointmentId, ctx.garageId, {
        status: AppointmentStatus.CANCELLED,
        notes,
      });

      return { cancelled: true, appointmentId: args.appointmentId };
    },
  };
}
