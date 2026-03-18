import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGarageDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() name?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() address?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() phone?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() email?: string;
  @ApiProperty({ required: false }) @IsArray() @IsOptional() specializations?: string[];
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() taxRate?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() currency?: string;
}
