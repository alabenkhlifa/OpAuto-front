import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMaintenanceDto {
  @ApiProperty() @IsString() carId: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() employeeId?: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() priority?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() estimatedHours?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() estimatedCost?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;
}
