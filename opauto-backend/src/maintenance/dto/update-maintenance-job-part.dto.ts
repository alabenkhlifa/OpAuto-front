import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceJobPartDto } from './create-maintenance-job-part.dto';

export class UpdateMaintenanceJobPartDto extends PartialType(CreateMaintenanceJobPartDto) {}
