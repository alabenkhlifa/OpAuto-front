import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMaintenanceDto {
  @ApiProperty({ required: false }) @IsUUID() @IsOptional() appointmentId?: string;
  @ApiProperty() @IsString() carId: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() employeeId?: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() priority?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() estimatedHours?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() estimatedCost?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;
}
