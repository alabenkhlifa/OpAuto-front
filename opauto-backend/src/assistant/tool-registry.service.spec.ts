import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService, ToolExecutionResult } from './tool-registry.service';
import { AssistantBlastTier } from '@prisma/client';
import { AssistantUserContext, ToolDefinition } from './types';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['analytics', 'invoicing'],
  locale: 'en',
};

const staffCtx: AssistantUserContext = {
  ...ownerCtx,
  userId: 'user-2',
  role: 'STAFF',
};

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'sample_tool',
    description: 'A sample tool',
    parameters: {
      type: 'object',
      properties: { count: { type: 'number' } },
      required: ['count'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (args: unknown) => {
      const a = args as { count: number };
      return { doubled: a.count * 2 };
    },
    ...overrides,
  };
}

function asFailure(res: ToolExecutionResult): { ok: false; error: string; durationMs: number } {
  if (res.ok) {
    throw new Error(`Expected failure, got success: ${JSON.stringify(res)}`);
  }
  return res as { ok: false; error: string; durationMs: number };
}

function asSuccess(res: ToolExecutionResult): { ok: true; result: unknown; durationMs: number } {
  if (!res.ok) {
    throw new Error(`Expected success, got failure: ${JSON.stringify(res)}`);
  }
  return res as { ok: true; result: unknown; durationMs: number };
}

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
  });

  describe('register', () => {
    it('adds a tool with a valid JSON Schema', () => {
      const tool = makeTool();
      service.register(tool);
      expect(service.get('sample_tool')).toBe(tool);
    });

    it('throws when the JSON Schema is invalid', () => {
      const bad = makeTool({
        name: 'bad_tool',
        parameters: { type: 'not-a-type' },
      });
      expect(() => service.register(bad)).toThrow(/invalid JSON Schema/i);
    });
  });

  describe('get', () => {
    it('returns the registered tool', () => {
      const tool = makeTool();
      service.register(tool);
      expect(service.get('sample_tool')).toBe(tool);
    });

    it('returns undefined for an unknown tool', () => {
      expect(service.get('does_not_exist')).toBeUndefined();
    });
  });

  describe('listForUser', () => {
    it('filters out tools whose required module is not enabled', () => {
      service.register(makeTool({ name: 'analytics_tool', requiredModule: 'analytics' }));
      service.register(makeTool({ name: 'parts_tool', requiredModule: 'parts' }));

      const descriptors = service.listForUser(ownerCtx);

      expect(descriptors.map((d) => d.name)).toEqual(['analytics_tool']);
    });

    it('filters out OWNER-only tools when role is STAFF', () => {
      service.register(makeTool({ name: 'owner_only', requiredRole: 'OWNER' }));
      service.register(makeTool({ name: 'staff_ok' }));

      const descriptors = service.listForUser(staffCtx);

      expect(descriptors.map((d) => d.name)).toEqual(['staff_ok']);
    });

    it('returns all tools an OWNER can access', () => {
      service.register(makeTool({ name: 'owner_only', requiredRole: 'OWNER' }));
      service.register(makeTool({ name: 'open_tool' }));

      const descriptors = service.listForUser(ownerCtx);

      expect(descriptors.map((d) => d.name).sort()).toEqual(['open_tool', 'owner_only']);
    });

    it('returns descriptors with only public-facing fields', () => {
      service.register(makeTool());
      const [descriptor] = service.listForUser(ownerCtx);
      expect(Object.keys(descriptor).sort()).toEqual(['description', 'name', 'parameters']);
    });
  });

  describe('validateArgs', () => {
    it('returns valid=true for matching args', () => {
      service.register(makeTool());
      expect(service.validateArgs('sample_tool', { count: 3 })).toEqual({ valid: true });
    });

    it('returns valid=false with human-readable errors for bad args', () => {
      service.register(makeTool());
      const result = service.validateArgs('sample_tool', { count: 'three' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.join(' ')).toMatch(/count|number/i);
    });

    it('returns valid=false for missing required fields', () => {
      service.register(makeTool());
      const result = service.validateArgs('sample_tool', {});
      expect(result.valid).toBe(false);
      expect(result.errors!.join(' ')).toMatch(/count/i);
    });

    it('returns valid=false when the tool is unknown', () => {
      const result = service.validateArgs('ghost_tool', { count: 1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Unknown tool: ghost_tool']);
    });

    describe('I-011 — type coercion at the validator boundary', () => {
      it('coerces a numeric string to a number when the schema is "number"', () => {
        service.register(makeTool());
        const args: { count: number | string } = { count: '5' };
        const result = service.validateArgs('sample_tool', args);
        expect(result.valid).toBe(true);
        // AJV mutates in place — execute() will see the coerced value too.
        expect(args.count).toBe(5);
      });

      it('coerces a numeric string to an integer when the schema is "integer"', () => {
        service.register(
          makeTool({
            name: 'int_tool',
            parameters: {
              type: 'object',
              properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
              required: ['limit'],
              additionalProperties: false,
            },
          }),
        );
        const args: { limit: number | string } = { limit: '5' };
        expect(service.validateArgs('int_tool', args)).toEqual({ valid: true });
        expect(args.limit).toBe(5);
      });

      it('still rejects non-numeric strings for number/integer types', () => {
        service.register(makeTool());
        const result = service.validateArgs('sample_tool', { count: 'three' });
        expect(result.valid).toBe(false);
      });

      it('coerces a single string to a 1-element array when the schema is array<string>', () => {
        service.register(
          makeTool({
            name: 'array_tool',
            parameters: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' } },
              },
              required: ['ids'],
              additionalProperties: false,
            },
          }),
        );
        const args: { ids: string | string[] } = { ids: 'abc-123' };
        expect(service.validateArgs('array_tool', args)).toEqual({ valid: true });
        expect(args.ids).toEqual(['abc-123']);
      });
    });
  });

  describe('resolveBlastTier', () => {
    it('returns the static tier when no resolver is defined', () => {
      const tool = makeTool({ blastTier: AssistantBlastTier.CONFIRM_WRITE });
      service.register(tool);
      expect(service.resolveBlastTier(tool, { count: 1 }, ownerCtx)).toBe(
        AssistantBlastTier.CONFIRM_WRITE,
      );
    });

    it('uses the dynamic resolver when defined', () => {
      const tool = makeTool({
        name: 'send_email',
        blastTier: AssistantBlastTier.CONFIRM_WRITE,
        resolveBlastTier: (args, ctx) => {
          const a = args as { to: string };
          return a.to === ctx.email
            ? AssistantBlastTier.AUTO_WRITE
            : AssistantBlastTier.CONFIRM_WRITE;
        },
      });
      service.register(tool);

      expect(service.resolveBlastTier(tool, { to: 'owner@example.com' }, ownerCtx)).toBe(
        AssistantBlastTier.AUTO_WRITE,
      );
      expect(service.resolveBlastTier(tool, { to: 'someone@else.com' }, ownerCtx)).toBe(
        AssistantBlastTier.CONFIRM_WRITE,
      );
    });

    it('falls back to static tier when the dynamic resolver throws', () => {
      const tool = makeTool({
        blastTier: AssistantBlastTier.READ,
        resolveBlastTier: () => {
          throw new Error('boom');
        },
      });
      service.register(tool);
      expect(service.resolveBlastTier(tool, {}, ownerCtx)).toBe(AssistantBlastTier.READ);
    });
  });

  describe('execute', () => {
    it('returns ok:true with result and durationMs for a successful handler', async () => {
      service.register(makeTool());
      const res = asSuccess(await service.execute('sample_tool', { count: 5 }, ownerCtx));

      expect(res.result).toEqual({ doubled: 10 });
      expect(typeof res.durationMs).toBe('number');
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok:false with error="timeout" when the handler exceeds the timeout', async () => {
      service.register(
        makeTool({
          name: 'slow_tool',
          handler: () => new Promise((resolve) => setTimeout(resolve, 200)),
        }),
      );

      const res = asFailure(
        await service.execute('slow_tool', { count: 1 }, ownerCtx, { timeoutMs: 25 }),
      );

      expect(res.error).toBe('timeout');
      expect(typeof res.durationMs).toBe('number');
    });

    it('returns ok:false with the error message when the handler throws', async () => {
      service.register(
        makeTool({
          name: 'broken_tool',
          handler: async () => {
            throw new Error('handler failed');
          },
        }),
      );

      const res = asFailure(await service.execute('broken_tool', { count: 1 }, ownerCtx));

      expect(res.error).toBe('handler failed');
      expect(typeof res.durationMs).toBe('number');
    });

    it('returns ok:false when the tool is not registered', async () => {
      const res = asFailure(await service.execute('missing_tool', {}, ownerCtx));
      expect(res.error).toMatch(/Unknown tool/i);
    });
  });
});
