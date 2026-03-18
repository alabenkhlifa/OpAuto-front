import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalType } from '@prisma/client';

export class CreateApprovalDto {
  @ApiProperty({ enum: ApprovalType }) @IsEnum(ApprovalType) type: ApprovalType;
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() amount?: number;
}
