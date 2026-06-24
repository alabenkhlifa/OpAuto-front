import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';

export class RespondMaintenanceJobApprovalDto {
  @ApiProperty({ enum: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED], required: false })
  @IsIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
  @IsOptional()
  status?: ApprovalStatus;

  @ApiProperty({ enum: ['approved', 'rejected'], required: false })
  @IsIn(['approved', 'rejected'])
  @IsOptional()
  decision?: 'approved' | 'rejected';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  responseNote?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  responseChannel?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  channel?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reviewer?: string;
}
