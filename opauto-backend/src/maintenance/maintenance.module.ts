import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { forwardRef } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => PublicModule), EmailModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
