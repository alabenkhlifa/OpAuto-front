import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';
import { AssistantController } from './assistant.controller';
import { OrchestratorService } from './orchestrator.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { ConversationService } from './conversation.service';
import { AuditService } from './audit.service';

@Module({
  imports: [PrismaModule, AiModule, SmsModule, EmailModule],
  controllers: [AssistantController],
  providers: [
    OrchestratorService,
    LlmGatewayService,
    ToolRegistryService,
    SkillRegistryService,
    AgentRunnerService,
    ApprovalService,
    ConversationService,
    AuditService,
  ],
  exports: [
    OrchestratorService,
    ToolRegistryService,
    SkillRegistryService,
    AgentRunnerService,
  ],
})
export class AssistantModule {}
