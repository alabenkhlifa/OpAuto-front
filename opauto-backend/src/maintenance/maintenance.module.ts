import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { forwardRef } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [forwardRef(() => PublicModule)],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
