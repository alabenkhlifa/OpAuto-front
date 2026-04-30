import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreditNoteLineItemDto } from './credit-note-line-item.dto';

/**
 * CreateCreditNoteDto — body for `POST /credit-notes`.
 *
 * Issues an immutable credit note (avoir) tied to a source invoice. The
 * service layer enforces:
 *   - the source invoice exists in the caller's garage
 *   - the source invoice is in a credit-noteable state
 *   - any partId on a line corresponds to a partId on the source invoice
 *   - if `restockParts=true`, every line with a partId restores stock via
 *     a StockMovement row + Part.quantity increment
 */
export class CreateCreditNoteDto {
  @ApiProperty()
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;

  @ApiProperty({ type: [CreditNoteLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineItemDto)
  lineItems: CreditNoteLineItemDto[];

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  restockParts?: boolean;
}
