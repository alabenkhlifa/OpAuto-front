import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() estimatedMinutes?: number;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() isCompleted?: boolean;
}
