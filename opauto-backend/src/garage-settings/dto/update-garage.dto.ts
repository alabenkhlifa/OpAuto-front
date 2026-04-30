import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NumberingResetPolicy } from '@prisma/client';

// Tunisian matricule fiscal — e.g. "1234567/A/B/000"
export const MF_NUMBER_REGEX = /^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/;
// Tunisian RIB — exactly 20 digits
export const RIB_REGEX = /^\d{20}$/;

export class UpdateGarageDto {
  // ── Existing fields ──────────────────────────────────────────
  @ApiProperty({ required: false }) @IsString() @IsOptional() name?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() address?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() phone?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() email?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() logo?: string;
  @ApiProperty({ required: false }) @IsArray() @IsOptional() specializations?: string[];
  @ApiProperty({ required: false }) @IsObject() @IsOptional() businessHours?: Record<string, any>;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() taxRate?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() currency?: string;

  // ── Fiscal identity (Task 1.5) ───────────────────────────────
  @ApiProperty({
    required: false,
    description: 'Tunisian matricule fiscal in NNNNNNN/L/L/NNN format',
    example: '1234567/A/B/000',
  })
  @IsOptional()
  @IsString()
  @Matches(MF_NUMBER_REGEX, {
    message: 'mfNumber must match Tunisian matricule fiscal format NNNNNNN/L/L/NNN',
  })
  mfNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Tunisian RIB — exactly 20 digits',
    example: '12345678901234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(RIB_REGEX, { message: 'rib must be exactly 20 digits' })
  rib?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() bankName?: string;

  @ApiProperty({ required: false, description: 'Logo URL or relative asset path' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 365, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  defaultPaymentTermsDays?: number;

  @ApiProperty({ required: false, maxLength: 10, default: 'INV' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  numberingPrefix?: string;

  @ApiProperty({ required: false, enum: NumberingResetPolicy })
  @IsOptional()
  @IsEnum(NumberingResetPolicy)
  numberingResetPolicy?: NumberingResetPolicy;

  @ApiProperty({ required: false, minimum: 3, maximum: 8, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(8)
  numberingDigitCount?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 50, default: 19 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  defaultTvaRate?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  fiscalStampEnabled?: boolean;
}
