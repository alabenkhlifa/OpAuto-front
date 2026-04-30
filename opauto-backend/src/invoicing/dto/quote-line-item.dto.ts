import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * QuoteLineItemDto — one line on a devis (quote).
 *
 * Mirrors the shape of `InvoiceLineItem` so a quote can be projected
 * 1:1 onto a DRAFT invoice when the customer approves.
 */
export class QuoteLineItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001, { message: 'quantity must be > 0' })
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tvaRate?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string; // labor, part, service

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serviceCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  mechanicId?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  laborHours?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPct?: number;
}
