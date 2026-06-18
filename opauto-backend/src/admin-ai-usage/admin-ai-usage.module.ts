import { Module } from '@nestjs/common';
import { AdminAiUsageController } from './admin-ai-usage.controller';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAiUsageController],
  providers: [AdminAiUsageService],
})
export class AdminAiUsageModule {}
