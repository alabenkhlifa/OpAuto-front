import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';

export class RespondApprovalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsEnum(ApprovalStatus) status: ApprovalStatus;
  @ApiProperty({ required: false }) @IsString() @IsOptional() responseNote?: string;
}
