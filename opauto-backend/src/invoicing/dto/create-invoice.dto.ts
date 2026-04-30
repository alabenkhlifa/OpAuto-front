import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLineItemDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() type?: string;

  /**
   * Per-line TVA rate (Tunisia: 7 / 13 / 19 / 0 for exempt). When omitted
   * the service falls back to `garage.defaultTvaRate`. Source of truth for
   * fiscal totals — the calculator groups by rate to produce the per-rate
   * TVA breakdown printed on the invoice.
   */
  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tvaRate?: number;

  @ApiProperty({ required: false }) @IsString() @IsOptional() partId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() serviceCode?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() mechanicId?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() laborHours?: number;

  /**
   * Phase 3.2 — line-level discount percentage. Crossing the
   * garage threshold triggers the audit-trail requirement on the
   * parent invoice (one DiscountAuditLog per discounted line).
   */
  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPct?: number;
}

export class CreateInvoiceDto {
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carId?: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() dueDate?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() discount?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;

  /**
   * Phase 3.2 — required when any discount on the invoice exceeds
   * the garage's `discountAuditThresholdPct` (default 5%).
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  discountReason?: string;

  /**
   * Phase 3.2 — userId of an OWNER who approved the discount.
   * Validated server-side: must exist, must belong to the same
   * garage, must have role OWNER. Required alongside `discountReason`
   * when the threshold is crossed.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  discountApprovedBy?: string;

  @ApiProperty({ type: [CreateLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems: CreateLineItemDto[];
}
