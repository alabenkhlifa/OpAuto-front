import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() emailNotifications?: boolean;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() smsNotifications?: boolean;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() browserNotifications?: boolean;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @IsIn(['en', 'fr', 'ar']) language?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @IsIn(['dark', 'light']) theme?: string;
}
