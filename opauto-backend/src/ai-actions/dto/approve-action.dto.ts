import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DiscountKind } from '@prisma/client';

export class ApproveActionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  messageBody?: string;

  @ApiProperty({ required: false, enum: DiscountKind })
  @IsEnum(DiscountKind)
  @IsOptional()
  discountKind?: DiscountKind;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100000)
  @IsOptional()
  discountValue?: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
