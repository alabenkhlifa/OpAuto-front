import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceDto } from './create-maintenance.dto';
import { IsEnum, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {
  @ApiProperty({ enum: MaintenanceStatus, required: false })
  @IsEnum(MaintenanceStatus) @IsOptional() status?: MaintenanceStatus;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() actualHours?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() actualCost?: number;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() startDate?: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() completionDate?: string;
}
