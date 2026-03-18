import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiProperty({ enum: EmployeeStatus, required: false })
  @IsEnum(EmployeeStatus) @IsOptional() status?: EmployeeStatus;
}
