import { AssistantBlastTier } from '@prisma/client';
import { AiService } from '../../../ai/ai.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface ListAtRiskCustomersArgs {
  limit?: number;
}

export interface AtRiskCustomerEntry {
  customerId: string;
  customerName: string;
  churnRisk: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  suggestedAction: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export function createListAtRiskCustomersTool(deps: {
  aiService: AiService;
}): ToolDefinition<ListAtRiskCustomersArgs, AtRiskCustomerEntry[]> {
  return {
    name: 'list_at_risk_customers',
    description:
      'List customers at highest risk of churn. Wraps the existing churn-prediction model. Sorted by risk descending. Owner-only (uses revenue and retention data).',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `Max number of customers to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`,
        },
      },
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListAtRiskCustomersArgs,
      ctx: AssistantUserContext,
    ): Promise<AtRiskCustomerEntry[]> => {
      const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      // Pass user's locale so risk narratives come back localized.
      const result = await deps.aiService.predictChurn(ctx.garageId, {
        language: ctx.locale,
      });
      // predictChurn already sorts by risk desc — just slice.
      return result.predictions.slice(0, limit);
    },
  };
}
