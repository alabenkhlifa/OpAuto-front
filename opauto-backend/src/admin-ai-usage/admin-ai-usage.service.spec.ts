import { Test, TestingModule } from '@nestjs/testing';
import { AssistantMessageRole, AssistantToolCallStatus } from '@prisma/client';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageRangeKey } from './dto/admin-ai-usage-query.dto';

describe('AdminAiUsageService', () => {
  let service: AdminAiUsageService;
  let prisma: any;
  const NOW = new Date('2026-06-18T12:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      assistantMessage: {
        findMany: jest.fn(),
      },
      assistantToolCall: {
        findMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAiUsageService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AdminAiUsageService);
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('aggregates OVH usage and costs from persisted messages and tool calls', async () => {
    prisma.assistantMessage.findMany.mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'c1',
        role: AssistantMessageRole.ASSISTANT,
        content: 'ok',
        toolCallId: 't1',
        tokensIn: 1000,
        tokensOut: 100,
        llmProvider: 'ovh',
        llmModel: 'Meta-Llama-3_3-70B-Instruct',
        llmPurpose: 'agent_runner:analytics-agent',
        skillUsed: 'analytics',
        createdAt: new Date('2026-06-18T06:00:00.000Z'),
        conversation: {
          userId: 'u1',
          user: {
            id: 'u1',
            firstName: 'Ana',
            lastName: 'Analytic',
            email: 'ana@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
      },
      {
        id: 'm2',
        conversationId: 'c2',
        role: AssistantMessageRole.ASSISTANT,
        content: 'ok',
        toolCallId: null,
        tokensIn: 500,
        tokensOut: 20,
        llmProvider: 'ovh',
        llmModel: 'mistral-small-latest',
        llmPurpose: 'maintenance-check',
        skillUsed: null,
        createdAt: new Date('2026-06-18T06:20:00.000Z'),
        conversation: {
          userId: 'u2',
          user: {
            id: 'u2',
            firstName: 'Mia',
            lastName: 'Tools',
            email: 'mia@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
      },
      {
        id: 'm3',
        conversationId: 'c3',
        role: AssistantMessageRole.ASSISTANT,
        content: 'ok',
        toolCallId: null,
        tokensIn: null,
        tokensOut: null,
        llmProvider: 'ovh',
        llmModel: null,
        llmPurpose: null,
        skillUsed: null,
        createdAt: new Date('2026-06-18T07:00:00.000Z'),
        conversation: {
          userId: 'u2',
          user: {
            id: 'u2',
            firstName: 'Mia',
            lastName: 'Tools',
            email: 'mia@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
      },
    ]);

    prisma.assistantToolCall.findMany.mockResolvedValue([
      {
        id: 't1',
        conversationId: 'c1',
        toolName: 'get_revenue_summary',
        status: AssistantToolCallStatus.APPROVED,
        blastTier: 'READ',
        durationMs: 120,
        approvedAt: new Date('2026-06-18T06:01:00.000Z'),
        createdAt: new Date('2026-06-18T06:00:20.000Z'),
        conversation: {
          userId: 'u1',
          user: {
            id: 'u1',
            firstName: 'Ana',
            lastName: 'Analytic',
            email: 'ana@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
        emitter: {
          llmPurpose: 'agent_runner:analytics-agent',
          llmModel: 'Meta-Llama-3_3-70B-Instruct',
        },
      },
      {
        id: 't2',
        conversationId: 'c2',
        toolName: 'list_maintenance',
        status: AssistantToolCallStatus.DENIED,
        blastTier: 'CONFIRM_WRITE',
        durationMs: 40,
        approvedAt: new Date('2026-06-18T07:00:22.000Z'),
        createdAt: new Date('2026-06-18T07:00:10.000Z'),
        conversation: {
          userId: 'u2',
          user: {
            id: 'u2',
            firstName: 'Mia',
            lastName: 'Tools',
            email: 'mia@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
        emitter: {
          llmPurpose: 'maintenance-check',
          llmModel: 'mistral-small-latest',
        },
      },
      {
        id: 't3',
        conversationId: 'c2',
        toolName: 'get_revenue_summary',
        status: AssistantToolCallStatus.EXECUTED,
        blastTier: 'READ',
        durationMs: 45,
        approvedAt: null,
        createdAt: new Date('2026-06-18T07:30:00.000Z'),
        conversation: {
          userId: 'u2',
          user: {
            id: 'u2',
            firstName: 'Mia',
            lastName: 'Tools',
            email: 'mia@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
        emitter: {
          llmPurpose: 'maintenance-check',
          llmModel: 'mistral-small-latest',
        },
      },
    ]);

    const result = await service.getOvhUsage('garage-1', AiUsageRangeKey.TODAY);

    expect(prisma.assistantMessage.findMany).toHaveBeenCalled();
    expect(prisma.assistantToolCall.findMany).toHaveBeenCalled();

    expect(result.summary.assistantMessages).toBe(3);
    expect(result.summary.toolCalls).toBe(3);
    expect(result.summary.uniqueUsers).toBe(2);
    expect(result.summary.ovhMessagesPriced).toBe(2);
    expect(result.summary.ovhMessagesUnpriced).toBe(1);
    expect(result.summary.rowsWithMissingPurpose).toBe(1);
    expect(result.summary.rowsWithMissingModel).toBe(1);
    expect(result.summary.rowsWithMissingPurpose).toBe(1);
    expect(result.summary.tokensIn).toBe(1500);
    expect(result.summary.tokensOut).toBe(120);
    expect(result.summary.estimatedCost).toBeCloseTo(
      (1100 * 0.74 + 500 * 0.1) / 1_000_000,
      10,
    );

    expect(result.taskUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: 'agent_runner:analytics-agent',
          calls: 1,
          toolCalls: 1,
        }),
        expect.objectContaining({
          purpose: 'maintenance-check',
          calls: 1,
          toolCalls: 2,
        }),
        expect.objectContaining({
          purpose: 'unknown',
          calls: 1,
          unpricedCalls: 1,
        }),
      ]),
    );

    expect(result.agentUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: 'analytics-agent', calls: 1 }),
      ]),
    );
    expect(result.skillUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: 'analytics', calls: 1 }),
        expect.objectContaining({ skill: 'direct_assistant', calls: 2 }),
      ]),
    );

    const top = result.topExpensiveCalls[0];
    expect(top.messageId).toBe('m1');
    expect(top.priced).toBe(true);

    const revTool = result.toolUsage.find(
      (t) => t.toolName === 'get_revenue_summary',
    );
    const maintenanceTool = result.toolUsage.find(
      (t) => t.toolName === 'list_maintenance',
    );
    expect(revTool?.calls).toBe(2);
    expect(revTool?.approved).toBe(1);
    expect(revTool?.executed).toBe(1);
    expect(revTool?.tierBreakdown.READ).toBe(2);
    expect(maintenanceTool?.denied).toBe(1);

    expect(result.approvalRefusal.totalToolCalls).toBe(3);
    expect(result.approvalRefusal.approvalRequired).toBe(2);
    expect(result.approvalRefusal.approvedOrExecuted).toBe(2);
    expect(result.approvalRefusal.denied).toBe(1);
  });

  it('maps user and garage usage tool-call counts separately from assistant messages', async () => {
    prisma.assistantMessage.findMany.mockResolvedValue([]);
    prisma.assistantToolCall.findMany.mockResolvedValue([
      {
        id: 'tc1',
        conversationId: 'c-ghost',
        toolName: 'find_customer',
        status: AssistantToolCallStatus.PENDING_APPROVAL,
        blastTier: 'CONFIRM_WRITE',
        durationMs: 12,
        approvedAt: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        conversation: {
          userId: 'u9',
          user: {
            id: 'u9',
            firstName: 'Rui',
            lastName: 'Ghost',
            email: 'rui@opauto.test',
          },
          garage: {
            id: 'garage-1',
            name: 'AutoTech Tunisia',
            address: '15 Avenue Habib Bourguiba, Tunis 1000',
          },
        },
        emitter: {
          llmPurpose: 'agent_runner:inventory-agent',
          llmModel: 'Meta-Llama-3_3-70B-Instruct',
        },
      },
    ]);

    const result = await service.getOvhUsage('garage-1', AiUsageRangeKey.TODAY);

    expect(result.summary.assistantMessages).toBe(0);
    expect(result.summary.toolCalls).toBe(1);
    expect(result.summary.uniqueUsers).toBe(1);
    expect(result.userUsage[0]).toMatchObject({
      userId: 'u9',
      calls: 0,
      toolCalls: 1,
    });
    expect(result.garageUsage[0].toolCalls).toBe(1);
    expect(result.garageUsage[0].calls).toBe(0);
    expect(result.garageUsage[0].uniqueUsers).toBe(1);
    expect(result.garageUsage[0].garageName).toBe('AutoTech Tunisia');
    expect(result.sourceCoverage.rowCoverage.assistantMessagesScanned).toBe(0);
    expect(result.sourceCoverage.rowCoverage.assistantToolCallsScanned).toBe(1);
    expect(
      result.sourceCoverage.includesGatewayOnlySignals.classifierCalls,
    ).toBe(false);
  });
});
