import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * CreditNoteLineItemDto — one line on an avoir.
 *
 * Mirrors `CreateLineItemDto` but with credit-note specifics:
 *   - `partId` may be set when the line restores a sold part (the service
 *     validates that the partId actually appears on the source invoice).
 *   - `tvaRate` is required because credit notes are not tied to the
 *     garage default — the value must match what the original invoice used.
 *   - `unitPrice` is permitted to be negative for adjustment lines, but
 *     typical use is a positive amount being credited back to the customer.
 */
export class CreditNoteLineItemDto {
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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  tvaRate: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

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

  /**
   * S-EDGE-013 (Sweep C-23) — per-line restock toggle. When true (the
   * default), this line will trigger a `StockMovement` + `Part.quantity`
   * increment at issue time IF the line also carries a `partId`. When
   * false, the line is committed as a paper-credit only — the customer
   * gets the refund without the part returning to inventory. Lines
   * without a partId ignore this flag entirely (nothing to restock).
   */
  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  restockPart?: boolean;
}
