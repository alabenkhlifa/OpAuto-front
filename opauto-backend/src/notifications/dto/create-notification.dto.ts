import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType }) @IsEnum(NotificationType) type: NotificationType;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() message: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() userId?: string;
}
