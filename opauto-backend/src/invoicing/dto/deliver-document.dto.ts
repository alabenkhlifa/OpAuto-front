import { ApiProperty } from '@nestjs/swagger';
import { DeliveryChannel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DeliverDocumentDto — body for `POST /invoices/:id/deliver`,
 * `POST /quotes/:id/deliver` and `POST /credit-notes/:id/deliver`.
 *
 * - `channel`: which transport(s) to use; required.
 * - `to`: optional override (email address for EMAIL, phone for WHATSAPP).
 *   Defaults to the customer's stored email/phone respectively.
 *
 * For BOTH, the `to` override is applied to whichever channel matches
 * the format (email vs phone). In practice the frontend should split
 * its UI into two fields if both need overrides — this DTO keeps the
 * common case (one address) simple.
 */
export class DeliverDocumentDto {
  @ApiProperty({
    enum: DeliveryChannel,
    description: 'Transport channel(s) to use',
  })
  @IsEnum(DeliveryChannel)
  channel!: DeliveryChannel;

  @ApiProperty({
    required: false,
    description: 'Optional recipient override (email or phone)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  to?: string;
}
