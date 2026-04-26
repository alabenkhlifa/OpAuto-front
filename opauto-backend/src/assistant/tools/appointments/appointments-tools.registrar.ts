import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service';
import { AppointmentsService } from '../../../appointments/appointments.service';
import { AiService } from '../../../ai/ai.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolDefinition } from '../../types';
import { buildListAppointmentsTool } from './list-appointments.tool';
import { buildFindAvailableSlotTool } from './find-available-slot.tool';
import { buildCreateAppointmentTool } from './create-appointment.tool';
import { buildCancelAppointmentTool } from './cancel-appointment.tool';

@Injectable()
export class AppointmentsToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(AppointmentsToolsRegistrar.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly appointmentsService: AppointmentsService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const tools: ToolDefinition[] = [
      buildListAppointmentsTool(this.appointmentsService) as ToolDefinition,
      buildFindAvailableSlotTool(this.aiService) as ToolDefinition,
      buildCreateAppointmentTool(this.appointmentsService, this.prisma) as ToolDefinition,
      buildCancelAppointmentTool(this.appointmentsService) as ToolDefinition,
    ];

    for (const tool of tools) {
      this.registry.register(tool);
    }
    this.logger.log(`Registered ${tools.length} appointment tools`);
  }
}
