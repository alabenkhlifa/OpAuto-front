import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCarDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsString()
  make: string;

  @ApiProperty()
  @IsString()
  model: string;

  @ApiProperty()
  @IsInt()
  year: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  vin?: string;

  @ApiProperty()
  @IsString()
  licensePlate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  mileage?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  engineType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transmission?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
