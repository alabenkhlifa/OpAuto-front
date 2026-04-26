import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AssistantUserContext, Locale, SseEvent } from './types';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { OrchestratorService } from './orchestrator.service';
import { ConversationService } from './conversation.service';
import { ApprovalService } from './approval.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly conversation: ConversationService,
    private readonly approvals: ApprovalService,
    private readonly tools: ToolRegistryService,
    private readonly skills: SkillRegistryService,
    private readonly agents: AgentRunnerService,
  ) {}

  @Post('chat')
  @Sse()
  async chat(
    @CurrentUser() user: any,
    @Body() dto: ChatRequestDto,
  ): Promise<Observable<{ data: SseEvent }>> {
    const ctx: AssistantUserContext = {
      userId: user.userId ?? user.id,
      garageId: user.garageId,
      email: user.email,
      role: user.role,
      enabledModules: user.enabledModules ?? [],
      locale: (dto.locale ?? user.locale ?? 'en') as Locale,
    };
    const conv = await this.conversation.getOrCreate(
      ctx.garageId,
      ctx.userId,
      dto.conversationId,
    );
    return this.orchestrator
      .run(ctx, conv.id, dto.userMessage, dto.pageContext)
      .pipe(map((event) => ({ data: event })));
  }

  @Post('approvals/:id/decide')
  async decide(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
  ) {
    return this.approvals.decide(id, dto.decision, userId, dto.typedConfirmation);
  }

  @Get('conversations')
  async listConversations(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.conversation.listForUser?.(user.garageId, user.userId ?? user.id, Number(limit) || 20);
  }

  @Get('conversations/:id')
  async getConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversation.getById?.(id, user.garageId, user.userId ?? user.id);
  }

  @Delete('conversations/:id')
  async deleteConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversation.softDelete?.(id, user.garageId, user.userId ?? user.id);
  }

  @Post('conversations/:id/clear')
  async clearConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversation.clearMessages?.(id, user.garageId, user.userId ?? user.id);
  }

  @Get('registry')
  registry(@CurrentUser() user: any) {
    const ctx: AssistantUserContext = {
      userId: user.userId ?? user.id,
      garageId: user.garageId,
      email: user.email,
      role: user.role,
      enabledModules: user.enabledModules ?? [],
      locale: 'en',
    };
    return {
      tools: this.tools.listForUser(ctx),
      skills: this.skills.list(),
      agents: this.agents.list(),
    };
  }
}
