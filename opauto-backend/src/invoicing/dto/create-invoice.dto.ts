import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLineItemDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() type?: string;
}

export class CreateInvoiceDto {
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() dueDate?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() discount?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;
  @ApiProperty({ type: [CreateLineItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => CreateLineItemDto) lineItems: CreateLineItemDto[];
}
