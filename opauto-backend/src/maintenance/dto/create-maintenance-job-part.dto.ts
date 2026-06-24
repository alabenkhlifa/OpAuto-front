import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMaintenanceJobPartDto {
  @ApiProperty({ required: false })
  @ValidateIf((obj) => obj.type === 'part')
  @IsUUID()
  @IsOptional()
  partId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  supplier?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, enum: ['part', 'labor'] })
  @IsIn(['part', 'labor'])
  @IsOptional()
  type: 'part' | 'labor' = 'part';

  @ApiProperty() @IsNumber() @Type(() => Number) @Transform(({ value }) => Number(value)) @Min(0.001)
  @IsOptional()
  quantity: number = 1;

  @ApiProperty({ required: false })
  @IsNumber() @Type(() => Number) @Transform(({ value }) => Number(value))
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  serviceCode?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  mechanicId?: string;

  @ApiProperty({ required: false })
  @IsNumber() @Type(() => Number) @Transform(({ value }) => Number(value))
  @Min(0)
  @IsOptional()
  laborHours?: number;

  @ApiProperty({ required: false })
  @IsNumber() @Type(() => Number) @Transform(({ value }) => Number(value))
  @Min(0)
  @Max(100)
  @IsOptional()
  tvaRate?: number;

  @ApiProperty({ required: false })
  @IsNumber() @Type(() => Number) @Transform(({ value }) => Number(value))
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPct?: number;
}
