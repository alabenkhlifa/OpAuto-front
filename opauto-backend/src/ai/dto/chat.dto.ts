import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty() @IsString() role: string;
  @ApiProperty() @IsString() content: string;
}

export class AiChatDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  messages: ChatMessageDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  context?: string;
}

export class AiDiagnoseDto {
  @ApiProperty() @IsString() symptoms: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carMake?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carModel?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carYear?: string;
}

export class AiEstimateDto {
  @ApiProperty() @IsString() serviceType: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carMake?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() carModel?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
}
