import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  AiChatDto,
  AiDiagnoseDto,
  AiEstimateDto,
  AiPredictChurnDto,
  AiPredictMaintenanceDto,
  AiSuggestScheduleDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

  @Post('suggest-schedule')
  suggestSchedule(
    @CurrentUser('garageId') garageId: string,
    @Body() dto: AiSuggestScheduleDto,
  ) {
    return this.aiService.suggestSchedule(garageId, dto);
  }

  @Post('predict-churn')
  predictChurn(
    @CurrentUser('garageId') garageId: string,
    @Body() dto: AiPredictChurnDto,
  ) {
    return this.aiService.predictChurn(garageId, dto);
  }

  @Post('predict-maintenance')
  predictMaintenance(
    @CurrentUser('garageId') garageId: string,
    @Body() dto: AiPredictMaintenanceDto,
  ) {
    return this.aiService.predictMaintenance(garageId, dto);
  }
}
