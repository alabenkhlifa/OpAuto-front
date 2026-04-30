import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { QuoteLineItemDto } from './quote-line-item.dto';

/**
 * CreateQuoteDto — body for `POST /quotes`.
 *
 * Quotes are DRAFT on creation. They are formally numbered (DEV-...)
 * only when the owner sends them via `POST /quotes/:id/send`. Until
 * then the `quoteNumber` carries a `DRAFT-<uuid8>` placeholder.
 *
 * `validUntil` defaults to `now + garage.defaultPaymentTermsDays` if
 * the caller omits it.
 */
export class CreateQuoteDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  carId?: string;

  @ApiProperty({ type: [QuoteLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems: QuoteLineItemDto[];

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
