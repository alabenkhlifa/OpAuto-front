import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const sendModes = ['none', 'email', 'sms', 'both'] as const;
type SendMode = typeof sendModes[number];
const approvalTypes = [
  'part-purchase',
  'additional-work',
  'cost-estimate',
  'price-change',
  'parts-request',
] as const;
type ApprovalRequestType = typeof approvalTypes[number];
const approvalUrgencies = ['low', 'medium', 'high'] as const;
type ApprovalUrgency = typeof approvalUrgencies[number];
const approvalChannels = ['call', 'sms', 'email'] as const;
type ApprovalChannel = typeof approvalChannels[number];

export class CreateMaintenanceJobApprovalDto {
  @ApiProperty({ required: false, enum: approvalTypes })
  @IsIn(approvalTypes)
  @IsOptional()
  type?: ApprovalRequestType;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  requestedAmount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  estimatedPrice?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partName?: string;

  @ApiProperty({ required: false, enum: approvalUrgencies })
  @IsIn(approvalUrgencies)
  @IsOptional()
  urgency?: ApprovalUrgency;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  requestedBy?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  requestedAt?: string;

  @ApiProperty({ required: false, enum: sendModes })
  @IsIn(sendModes)
  @IsOptional()
  sendVia?: SendMode;

  @ApiProperty({ required: false, enum: approvalChannels, isArray: true })
  @IsArray()
  @IsIn(approvalChannels, { each: true })
  @IsOptional()
  sentVia?: ApprovalChannel[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comments?: string;
}
