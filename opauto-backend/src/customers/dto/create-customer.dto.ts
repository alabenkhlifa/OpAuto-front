import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: CustomerStatus, required: false })
  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;
}
