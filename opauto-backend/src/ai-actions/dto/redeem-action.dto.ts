import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RedeemActionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  invoiceId?: string;
}
