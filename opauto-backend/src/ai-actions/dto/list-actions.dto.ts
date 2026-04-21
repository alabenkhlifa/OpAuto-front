import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AiActionStatus } from '@prisma/client';

export class ListActionsDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ required: false, enum: AiActionStatus })
  @IsEnum(AiActionStatus)
  @IsOptional()
  status?: AiActionStatus;
}
