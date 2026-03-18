import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiChatDto, AiDiagnoseDto, AiEstimateDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto);
  }

  @Post('diagnose')
  diagnose(@Body() dto: AiDiagnoseDto) {
    return this.aiService.diagnose(dto);
  }

  @Post('estimate')
  estimate(@Body() dto: AiEstimateDto) {
    return this.aiService.estimate(dto);
  }
}
