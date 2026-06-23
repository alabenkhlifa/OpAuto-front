import { Test, TestingModule } from '@nestjs/testing';
import { AssistantToolCallStatus } from '@prisma/client';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageRangeKey } from './dto/admin-ai-usage-query.dto';

describe('AdminAiUsageService', () => {
  let service: AdminAiUsageService;
  let prisma: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    prisma = {
      llmUsageEvent: {
        findMany: jest.fn(),
      },
      assistantToolCall: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      garage: {
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
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('aggregates OVH usage from gateway events instead of assistant messages', async () => {
    prisma.llmUsageEvent.findMany.mockResolvedValue([
      {
        id: 'ev-plan',
        provider: 'ovh',
        model: 'Meta-Llama-3_3-70B-Instruct',
        purpose: 'assistant_tool_selection',
        status: 'SUCCESS',
        tokensIn: 1000,
        tokensOut: 100,
        latencyMs: 450,
        estimatedCost: 0.000814,
        priced: true,
        conversationId: 'c1',
        garageId: 'garage-1',
        userId: 'u1',
        toolName: 'find_customer',
        createdAt: new Date('2026-06-18T06:00:00.000Z'),
      },
      {
        id: 'ev-classifier',
        provider: 'ovh',
        model: 'Mistral-Small-3_2-24B-Instruct-2506',
        purpose: 'intent_classifier',
        status: 'SUCCESS',
        tokensIn: 500,
        tokensOut: 12,
        latencyMs: 150,
        estimatedCost: 0.00005,
        priced: true,
        conversationId: 'c1',
        garageId: 'garage-1',
        userId: 'u1',
        toolName: null,
        createdAt: new Date('2026-06-18T06:00:01.000Z'),
      },
      {
        id: 'ev-failed',
        provider: 'ovh',
        model: null,
        purpose: null,
        status: 'FAILED',
        tokensIn: null,
        tokensOut: null,
        latencyMs: null,
        estimatedCost: 0,
        priced: false,
        conversationId: null,
        garageId: null,
        userId: null,
        toolName: null,
        createdAt: new Date('2026-06-18T06:01:00.000Z'),
      },
    ]);

    prisma.assistantToolCall.findMany.mockResolvedValue([
      {
        id: 'tc-find',
        conversationId: 'c1',
        messageId: null,
        toolName: 'find_customer',
        status: AssistantToolCallStatus.EXECUTED,
        blastTier: 'READ',
        durationMs: 25,
        approvedAt: null,
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
      },
    ]);

    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        firstName: 'Ana',
        lastName: 'Analytic',
        email: 'ana@opauto.test',
      },
    ]);
    prisma.garage.findMany.mockResolvedValue([
      {
        id: 'garage-1',
        name: 'AutoTech Tunisia',
        address: '15 Avenue Habib Bourguiba, Tunis 1000',
      },
    ]);

    const result = await service.getOvhUsage('garage-1', AiUsageRangeKey.TODAY);

    expect(prisma.llmUsageEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provider: 'ovh' }),
      }),
    );
    expect(result.sourceCoverage.dataSource).toBe('gateway_usage_events');
    expect(result.sourceCoverage.includesGatewayOnlySignals).toMatchObject({
      classifierCalls: true,
      conversationTitles: true,
      rawGatewayLatency: true,
    });
    expect(result.summary.llmCalls).toBe(3);
    expect(result.summary.gatewayEvents).toBe(3);
    expect(result.summary.assistantMessages).toBe(3);
    expect(result.summary.toolCalls).toBe(1);
    expect(result.summary.tokensIn).toBe(1500);
    expect(result.summary.tokensOut).toBe(112);
    expect(result.summary.failedCalls).toBe(1);
    expect(result.summary.tokensMissing).toBe(1);
    expect(result.summary.eventsMissingContext).toBe(1);
    expect(result.summary.avgLatencyMs).toBe(300);
    expect(result.summary.estimatedCost).toBeCloseTo(0.000864, 6);

    expect(result.taskUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: 'assistant_tool_selection:find_customer',
          calls: 1,
          toolCalls: 1,
        }),
        expect.objectContaining({
          purpose: 'intent_classifier',
          calls: 1,
        }),
        expect.objectContaining({
          purpose: 'unknown',
          calls: 1,
          failedCalls: 1,
        }),
      ]),
    );
    expect(result.modelUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'ovh',
          model: 'Meta-Llama-3_3-70B-Instruct',
          calls: 1,
        }),
        expect.objectContaining({
          provider: 'ovh',
          model: 'Mistral-Small-3_2-24B-Instruct-2506',
          calls: 1,
        }),
      ]),
    );
    expect(result.topExpensiveCalls[0]).toMatchObject({
      eventId: 'ev-plan',
      purpose: 'assistant_tool_selection:find_customer',
      userName: 'Ana Analytic',
      garageName: 'AutoTech Tunisia',
      latencyMs: 450,
      status: 'SUCCESS',
    });
    expect(result.toolUsage[0]).toMatchObject({
      toolName: 'find_customer',
      calls: 1,
      executed: 1,
      avgDurationMs: 25,
    });
    expect(result.userUsage[0]).toMatchObject({
      userId: 'u1',
      calls: 2,
      toolCalls: 1,
    });
    expect(result.garageUsage[0]).toMatchObject({
      garageId: 'garage-1',
      calls: 2,
      toolCalls: 1,
      uniqueUsers: 1,
    });
    expect(result.timeBuckets.some((bucket) => bucket.calls > 0)).toBe(true);
  });

  it('counts gateway-only calls even when no tool calls or context exist', async () => {
    prisma.llmUsageEvent.findMany.mockResolvedValue([
      {
        id: 'ev-title',
        provider: 'ovh',
        model: 'Meta-Llama-3_3-70B-Instruct',
        purpose: 'conversation_title',
        status: 'SUCCESS',
        tokensIn: 80,
        tokensOut: 8,
        latencyMs: 90,
        estimatedCost: 0.000065,
        priced: true,
        conversationId: null,
        garageId: null,
        userId: null,
        toolName: null,
        createdAt: new Date('2026-06-18T08:00:00.000Z'),
      },
    ]);
    prisma.assistantToolCall.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.garage.findMany.mockResolvedValue([]);

    const result = await service.getOvhUsage('garage-1', AiUsageRangeKey.TODAY);

    expect(result.summary.llmCalls).toBe(1);
    expect(result.summary.toolCalls).toBe(0);
    expect(result.summary.eventsMissingContext).toBe(1);
    expect(result.taskUsage[0]).toMatchObject({
      purpose: 'conversation_title',
      calls: 1,
      toolCalls: 0,
    });
    expect(result.userUsage).toEqual([]);
    expect(result.garageUsage).toEqual([]);
  });
});
