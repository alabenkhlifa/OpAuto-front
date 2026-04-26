import { AssistantBlastTier } from '@prisma/client';
import { CustomersService } from '../../../customers/customers.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface FindCustomerArgs {
  query: string;
}

export interface FindCustomerHit {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  status: string;
  totalSpent: number;
  visitCount: number;
}

const MAX_RESULTS = 5;

export function createFindCustomerTool(deps: {
  customersService: CustomersService;
}): ToolDefinition<FindCustomerArgs, FindCustomerHit[]> {
  return {
    name: 'find_customer',
    description:
      'Fuzzy search customers by first name, last name, phone, or email. Returns up to 5 matches with summary fields. Use this to look up a customer when you only have a partial identifier.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          description: 'Search term (name, phone, or email).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: FindCustomerArgs,
      ctx: AssistantUserContext,
    ): Promise<FindCustomerHit[]> => {
      // Always inject ctx.garageId — never trust LLM for tenant scoping.
      const customers = await deps.customersService.findAll(
        ctx.garageId,
        args.query,
      );
      return customers.slice(0, MAX_RESULTS).map((c: any) => ({
        id: c.id,
        displayName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        phone: c.phone,
        email: c.email ?? null,
        status: c.status,
        totalSpent: c.totalSpent ?? 0,
        visitCount: c.visitCount ?? 0,
      }));
    },
  };
}
