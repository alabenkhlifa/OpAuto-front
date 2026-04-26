import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatRequestDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  userMessage!: string;

  @IsOptional()
  @IsString()
  locale?: 'en' | 'fr' | 'ar';

  @IsOptional()
  @IsObject()
  pageContext?: {
    route?: string;
    params?: Record<string, string>;
    selectedEntity?: { type: string; id: string; displayName?: string };
  };
}
