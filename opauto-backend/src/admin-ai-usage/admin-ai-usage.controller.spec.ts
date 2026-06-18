import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AdminAiUsageController } from './admin-ai-usage.controller';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import {
  AiUsageRangeKey,
  AdminAiUsageQueryDto,
} from './dto/admin-ai-usage-query.dto';

describe('AdminAiUsageController', () => {
  let controller: AdminAiUsageController;
  let service: { getOvhUsage: jest.Mock };
  let configService: { get: jest.Mock };
  const configuredOwnerEmail = 'ala.khliifa@gmail.com';

  const MOCK_RESPONSE = {
    generatedAt: new Date().toISOString(),
    range: {
      key: AiUsageRangeKey.TODAY,
      label: 'Today',
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      scope: 'ovh-only',
    },
    summary: {
      assistantMessages: 0,
      ovhMessagesPriced: 0,
      ovhMessagesUnpriced: 0,
      toolCalls: 0,
      uniqueUsers: 0,
      tokensIn: 0,
      tokensOut: 0,
      tokensMissing: 0,
      estimatedCost: 0,
      rowsWithMissingPurpose: 0,
      rowsWithMissingModel: 0,
    },
    taskUsage: [],
    agentUsage: [],
    skillUsage: [],
    userUsage: [],
    garageUsage: [],
    toolUsage: [],
    approvalRefusal: {
      totalToolCalls: 0,
      approvalRequired: 0,
      approvedOrExecuted: 0,
      denied: 0,
      expired: 0,
      pending: 0,
      rows: [],
    },
    topExpensiveCalls: [],
    sourceCoverage: {
      dataSource: 'persisted_tables_only',
      includesGatewayOnlySignals: {
        classifierCalls: false,
        conversationTitles: false,
        rawGatewayLatency: false,
      },
      rowCoverage: {
        assistantMessagesScanned: 0,
        assistantToolCallsScanned: 0,
        messagesWithoutModel: 0,
        messagesWithoutPurpose: 0,
        messagesWithoutTokens: 0,
      },
    },
  };

  beforeEach(async () => {
    service = {
      getOvhUsage: jest.fn().mockResolvedValue(MOCK_RESPONSE),
    };
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'ADMIN_AI_USAGE_OWNER_EMAIL') {
          return configuredOwnerEmail;
        }
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAiUsageController],
      providers: [
        { provide: AdminAiUsageService, useValue: service },
        { provide: ConfigService, useValue: configService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminAiUsageController);
  });

  it('forwards explicit range and garageId into service', async () => {
    const result = await controller.getUsage(
      configuredOwnerEmail,
      'garage-ctrl-001',
      {
        range: AiUsageRangeKey.LAST_WEEK,
      },
    );

    expect(service.getOvhUsage).toHaveBeenCalledWith(
      'garage-ctrl-001',
      AiUsageRangeKey.LAST_WEEK,
    );
    expect(result).toBe(MOCK_RESPONSE);
  });

  it('rejects non-configured owner email', () => {
    expect(() =>
      controller.getUsage(
        'not-authorized@example.com',
        'garage-ctrl-001',
        { range: AiUsageRangeKey.LAST_WEEK },
      ),
    ).toThrow(ForbiddenException);
    expect(service.getOvhUsage).not.toHaveBeenCalled();
  });

  it('uses configured owner email from config service', async () => {
    const tenantEmail = 'security-approved-owner@example.com';
    configService.get = jest
      .fn((key: string, fallback?: string) =>
        key === 'ADMIN_AI_USAGE_OWNER_EMAIL' ? tenantEmail : fallback,
      );

    const result = await controller.getUsage(tenantEmail, 'garage-ctrl-001', {
      range: AiUsageRangeKey.LAST_WEEK,
    });

    expect(service.getOvhUsage).toHaveBeenCalledWith(
      'garage-ctrl-001',
      AiUsageRangeKey.LAST_WEEK,
    );
    expect(result).toBe(MOCK_RESPONSE);
  });

  it('uses route decorator aliases for admin and legacy admin-ai-usage paths', () => {
    const path = Reflect.getMetadata(
      PATH_METADATA,
      AdminAiUsageController.prototype.getUsage,
    );

    expect(path).toEqual(
      expect.arrayContaining(['admin-ai-usage', 'admin/ai-usage']),
    );
  });

  it('uses default range through DTO fallback when omitted', async () => {
    const query = new AdminAiUsageQueryDto();
    const result = await controller.getUsage(
      configuredOwnerEmail,
      'garage-ctrl-001',
      query,
    );

    expect(service.getOvhUsage).toHaveBeenCalledWith(
      'garage-ctrl-001',
      AiUsageRangeKey.TODAY,
    );
    expect(result).toBe(MOCK_RESPONSE);
  });

  it('declares required auth and owner-only guard chain at controller level', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, AdminAiUsageController) || [];
    const roles = Reflect.getMetadata('roles', AdminAiUsageController) || [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual([UserRole.OWNER]);
  });
});
