import { AssistantBlastTier } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AiActionsService } from '../../../ai-actions/ai-actions.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface ProposeRetentionActionArgs {
  customerId: string;
}

export interface ProposeRetentionActionResult {
  id: string;
  kind: string;
  messageBody: string;
  discountKind: string | null;
  discountValue: number | null;
  expiresAt: string | null;
  churnRiskSnapshot: number | null;
  customer: {
    id: string;
    displayName: string;
    phone: string;
    smsOptIn: boolean;
  };
}

export interface ProposeRetentionActionError {
  error: 'customer_not_found' | 'draft_failed';
  message: string;
}

export function createProposeRetentionActionTool(deps: {
  aiActionsService: AiActionsService;
}): ToolDefinition<
  ProposeRetentionActionArgs,
  ProposeRetentionActionResult | ProposeRetentionActionError
> {
  return {
    name: 'propose_retention_action',
    description:
      'DRAFT (only) a retention SMS for an at-risk customer using the existing AI Actions ' +
      'service. The draft is persisted with status=DRAFT and surfaced in the AI Actions UI; ' +
      'the user must review and approve via that flow before anything is sent. This tool is ' +
      'READ-tier because it does not contact the customer. Do NOT pair this with `send_sms` ' +
      'to bypass approval.',
    parameters: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          minLength: 1,
          description: 'Customer id to draft a retention action for.',
        },
      },
      required: ['customerId'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: ProposeRetentionActionArgs,
      ctx: AssistantUserContext,
    ): Promise<ProposeRetentionActionResult | ProposeRetentionActionError> => {
      try {
        const action = await deps.aiActionsService.draftForCustomer(
          ctx.garageId,
          args.customerId,
        );
        const customerName =
          `${action.customer.firstName ?? ''} ${action.customer.lastName ?? ''}`.trim();
        return {
          id: action.id,
          kind: action.kind,
          messageBody: action.messageBody,
          discountKind: action.discountKind ?? null,
          discountValue:
            action.discountValue != null ? Number(action.discountValue) : null,
          expiresAt:
            action.expiresAt instanceof Date
              ? action.expiresAt.toISOString()
              : action.expiresAt
                ? String(action.expiresAt)
                : null,
          churnRiskSnapshot:
            action.churnRiskSnapshot != null
              ? Number(action.churnRiskSnapshot)
              : null,
          customer: {
            id: action.customer.id,
            displayName: customerName,
            phone: action.customer.phone,
            smsOptIn: action.customer.smsOptIn,
          },
        };
      } catch (err) {
        if (err instanceof NotFoundException) {
          return {
            error: 'customer_not_found',
            message: `Customer ${args.customerId} not found in this garage.`,
          };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { error: 'draft_failed', message };
      }
    },
  };
}
