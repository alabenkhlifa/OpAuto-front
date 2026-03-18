import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePartDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() partNumber?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() category?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() quantity?: number;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() minQuantity?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() unitPrice?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() costPrice?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() supplierId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() location?: string;
}
