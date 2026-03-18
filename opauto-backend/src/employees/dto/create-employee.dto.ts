import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeeRole, EmployeeDepartment } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() email?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() phone?: string;
  @ApiProperty({ enum: EmployeeRole }) @IsEnum(EmployeeRole) role: EmployeeRole;
  @ApiProperty({ enum: EmployeeDepartment }) @IsEnum(EmployeeDepartment) department: EmployeeDepartment;
  @ApiProperty() @IsDateString() hireDate: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() hourlyRate?: number;
  @ApiProperty({ required: false }) @IsArray() @IsOptional() skills?: string[];
}
