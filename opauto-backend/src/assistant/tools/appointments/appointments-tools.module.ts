import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { AppointmentsModule } from '../../../appointments/appointments.module';
import { AiModule } from '../../../ai/ai.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AppointmentsToolsRegistrar } from './appointments-tools.registrar';

@Module({
  imports: [AssistantModule, AppointmentsModule, AiModule, PrismaModule],
  providers: [AppointmentsToolsRegistrar],
})
export class AppointmentsToolsModule {}
