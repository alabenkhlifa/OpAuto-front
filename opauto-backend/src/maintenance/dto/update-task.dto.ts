import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() title?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() estimatedMinutes?: number;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() actualMinutes?: number;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() isCompleted?: boolean;
}
