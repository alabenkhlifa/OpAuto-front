import { Module } from '@nestjs/common';
import { AiActionsController } from './ai-actions.controller';
import { AiActionsService } from './ai-actions.service';
import { AiModule } from '../ai/ai.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AiModule, SmsModule],
  controllers: [AiActionsController],
  providers: [AiActionsService],
  exports: [AiActionsService],
})
export class AiActionsModule {}
