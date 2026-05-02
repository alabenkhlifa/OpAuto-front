import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { AgentRunnerService } from './agent-runner.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import {
  AgentDefinition,
  AssistantUserContext,
  LlmCompletionRequest,
  LlmCompletionResult,
  ToolDefinition,
  ToolDescriptor,
} from './types';

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

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'analytics-agent',
    description: 'Analyzes business data',
    systemPrompt: 'You are an analyst.',
    toolWhitelist: ['get_revenue', 'get_customer_count'],
    iterationCap: 6,
    ...overrides,
  };
}

function makeLlmCompletion(
  overrides: Partial<LlmCompletionResult> = {},
): LlmCompletionResult {
  return {
    provider: 'mock',
    content: 'done',
    toolCalls: [],
    ...overrides,
  };
}

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'get_revenue',
    description: 'Returns revenue',
    parameters: {
      type: 'object',
      properties: { period: { type: 'string' } },
      required: ['period'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async () => ({ total: 1000 }),
    ...overrides,
  };
}

class MockLlmGateway {
  public calls: LlmCompletionRequest[] = [];
  public responses: LlmCompletionResult[] = [];

  enqueue(result: LlmCompletionResult): void {
    this.responses.push(result);
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(req);
    if (this.responses.length === 0) {
      // Default to a "done" message so iteration loops end.
      return makeLlmCompletion();
    }
    return this.responses.shift()!;
  }
}

class MockToolRegistry {
  public tools = new Map<string, ToolDefinition>();
  public executeCalls: { name: string; args: unknown }[] = [];
  public listForUserSpy: ToolDescriptor[] | null = null;

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listForUser(ctx: AssistantUserContext): ToolDescriptor[] {
    void ctx;
    const out: ToolDescriptor[] = [];
    for (const tool of this.tools.values()) {
      out.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      });
    }
    this.listForUserSpy = out;
    return out;
  }

  validateArgs(
    _name: string,
    _args: unknown,
  ): { valid: boolean; errors?: string[] } {
    void _name;
    void _args;
    return { valid: true };
  }

  resolveBlastTier(
    tool: ToolDefinition,
    args: unknown,
    ctx: AssistantUserContext,
  ): AssistantBlastTier {
    if (tool.resolveBlastTier) return tool.resolveBlastTier(args, ctx);
    return tool.blastTier;
  }

  async execute(
    name: string,
    args: unknown,
    ctx: AssistantUserContext,
  ): Promise<
    | { ok: true; result: unknown; durationMs: number }
    | { ok: false; error: string; durationMs: number }
  > {
    this.executeCalls.push({ name, args });
    const tool = this.tools.get(name);
    if (!tool)
      return { ok: false, error: `Unknown tool: ${name}`, durationMs: 0 };
    try {
      const result = await tool.handler(args, ctx);
      return { ok: true, result, durationMs: 1 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, durationMs: 1 };
    }
  }
}

function buildService(): {
  service: AgentRunnerService;
  llm: MockLlmGateway;
  tools: MockToolRegistry;
} {
  const llm = new MockLlmGateway();
  const tools = new MockToolRegistry();
  const service = new AgentRunnerService(
    llm as unknown as LlmGatewayService,
    tools as unknown as ToolRegistryService,
  );
  return { service, llm, tools };
}

describe('AgentRunnerService', () => {
  describe('register / list / getDefinition', () => {
    it('registers an agent and lists it', () => {
      const { service } = buildService();
      const agent = makeAgent();
      service.register(agent);

      expect(service.list()).toEqual([
        { name: agent.name, description: agent.description },
      ]);
      expect(service.getDefinition(agent.name)).toBe(agent);
    });

    it('returns undefined for unknown agent', () => {
      const { service } = buildService();
      expect(service.getDefinition('nope')).toBeUndefined();
    });
  });

  describe('run — guards', () => {
    it('throws NotFoundException for unknown agent', async () => {
      const { service } = buildService();
      await expect(service.run('ghost', 'hi', ownerCtx)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for OWNER-only agent run as STAFF', async () => {
      const { service } = buildService();
      service.register(makeAgent({ requiredRole: 'OWNER' }));
      await expect(
        service.run('analytics-agent', 'hi', staffCtx),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when required module is missing', async () => {
      const { service } = buildService();
      service.register(makeAgent({ requiredModule: 'reports' }));
      await expect(
        service.run('analytics-agent', 'hi', ownerCtx),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('run — happy path', () => {
    it('returns the LLM text immediately when there are no tool calls', async () => {
      const { service, llm } = buildService();
      service.register(makeAgent());
      llm.enqueue(makeLlmCompletion({ content: 'all done' }));

      const out = await service.run('analytics-agent', 'compute X', ownerCtx);

      expect(out).toEqual({ result: 'all done' });
      expect(llm.calls).toHaveLength(1);
      // First system message anchors today's date — prevents the LLM from using
      // stale training-data years for "last 3 months" / "yesterday" / etc.
      expect(llm.calls[0].messages[0].role).toBe('system');
      expect(llm.calls[0].messages[0].content).toMatch(
        /Today's date is \d{4}-\d{2}-\d{2}/,
      );
      expect(llm.calls[0].messages[1]).toEqual({
        role: 'system',
        content: 'You are an analyst.',
      });
      expect(llm.calls[0].messages[2]).toEqual({
        role: 'user',
        content: 'compute X',
      });
    });

    it('handles a tool call inside the whitelist, then a final text reply', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent());
      tools.register(makeTool({ name: 'get_revenue' }));
      // Tool that exists in registry but is NOT in the agent's whitelist should
      // not be exposed to the LLM.
      tools.register(makeTool({ name: 'banned_tool' }));

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            {
              id: 'call-1',
              name: 'get_revenue',
              argsJson: JSON.stringify({ period: 'week' }),
            },
          ],
        }),
      );
      llm.enqueue(makeLlmCompletion({ content: 'revenue is 1000' }));

      const out = await service.run('analytics-agent', 'how much?', ownerCtx);

      expect(out).toEqual({ result: 'revenue is 1000' });
      expect(tools.executeCalls).toEqual([
        { name: 'get_revenue', args: { period: 'week' } },
      ]);

      // Verify the agent only exposed whitelisted tools to the LLM.
      const firstCallTools = llm.calls[0].tools ?? [];
      expect(firstCallTools.map((t) => t.name)).toEqual(['get_revenue']);

      // Second LLM call must include the tool result message in history.
      const secondMessages = llm.calls[1].messages;
      const toolMsg = secondMessages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.toolCallId).toBe('call-1');
      expect(JSON.parse(toolMsg!.content as string)).toEqual({
        result: { total: 1000 },
      });
    });
  });

  describe('run — tool not in whitelist', () => {
    it('replies with "not available" tool message and continues', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent());
      tools.register(makeTool({ name: 'get_revenue' }));
      // Not in whitelist:
      tools.register(makeTool({ name: 'banned_tool' }));

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            {
              id: 'call-x',
              name: 'banned_tool',
              argsJson: '{}',
            },
          ],
        }),
      );
      llm.enqueue(makeLlmCompletion({ content: "sorry, can't use that" }));

      const out = await service.run('analytics-agent', 'do bad', ownerCtx);

      expect(out).toEqual({ result: "sorry, can't use that" });
      expect(tools.executeCalls).toEqual([]); // never executed

      const toolMsg = llm.calls[1].messages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(JSON.parse(toolMsg!.content as string)).toEqual({
        error: 'tool not available to this agent',
      });
    });
  });

  describe('run — write tools refused', () => {
    it('refuses CONFIRM_WRITE tools and continues', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent({ toolWhitelist: ['send_sms'] }));
      tools.register(
        makeTool({
          name: 'send_sms',
          blastTier: AssistantBlastTier.CONFIRM_WRITE,
        }),
      );

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            {
              id: 'call-sms',
              name: 'send_sms',
              argsJson: JSON.stringify({ to: '+216123', body: 'hi' }),
            },
          ],
        }),
      );
      llm.enqueue(
        makeLlmCompletion({ content: 'I drafted it but cannot send.' }),
      );

      const out = await service.run('analytics-agent', 'send sms', ownerCtx);

      expect(out).toEqual({ result: 'I drafted it but cannot send.' });
      // Tool was NOT executed.
      expect(tools.executeCalls).toEqual([]);

      const toolMsg = llm.calls[1].messages.find((m) => m.role === 'tool');
      expect(JSON.parse(toolMsg!.content as string)).toEqual({
        error:
          'agent cannot perform write actions requiring approval; ask the orchestrator to handle this',
      });
    });

    it('allows AUTO_WRITE tools', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent({ toolWhitelist: ['self_email'] }));
      tools.register(
        makeTool({
          name: 'self_email',
          blastTier: AssistantBlastTier.AUTO_WRITE,
          handler: async () => ({ sent: true }),
        }),
      );

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            {
              id: 'call-e',
              name: 'self_email',
              argsJson: JSON.stringify({ period: 'today' }),
            },
          ],
        }),
      );
      llm.enqueue(makeLlmCompletion({ content: 'sent it' }));

      const out = await service.run('analytics-agent', 'mail me', ownerCtx);

      expect(out).toEqual({ result: 'sent it' });
      expect(tools.executeCalls).toEqual([
        { name: 'self_email', args: { period: 'today' } },
      ]);
    });
  });

  describe('run — iteration cap', () => {
    it('returns gracefully (no throw) when cap is exceeded', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent({ iterationCap: 2 }));
      tools.register(makeTool({ name: 'get_revenue' }));

      // Both iterations emit a tool call → cap hit before a final reply.
      llm.enqueue(
        makeLlmCompletion({
          content: 'partial-1',
          toolCalls: [
            { id: 'c1', name: 'get_revenue', argsJson: '{"period":"a"}' },
          ],
        }),
      );
      llm.enqueue(
        makeLlmCompletion({
          content: 'partial-2',
          toolCalls: [
            { id: 'c2', name: 'get_revenue', argsJson: '{"period":"b"}' },
          ],
        }),
      );

      const out = await service.run('analytics-agent', 'loop', ownerCtx);

      // Falls back to most recent assistant text.
      expect(out.result).toBe('partial-2');
      expect(tools.executeCalls).toHaveLength(2);
    });

    it('returns a polite apology when cap exceeded with no assistant text', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent({ iterationCap: 1 }));
      tools.register(makeTool({ name: 'get_revenue' }));

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            { id: 'c1', name: 'get_revenue', argsJson: '{"period":"a"}' },
          ],
        }),
      );

      const out = await service.run('analytics-agent', 'loop', ownerCtx);
      expect(out.result).toMatch(/iteration budget/i);
    });
  });

  describe('run — top-level timeout', () => {
    // We inject a tiny runTimeoutMs and rely on the LLM mock taking longer
    // than that. Avoids fake-timer plumbing through async/await.
    it('returns the timeout message when the run exceeds runTimeoutMs', async () => {
      const { service, llm } = buildService();
      service.register(makeAgent());

      // Override complete() to take 200ms.
      llm.complete = async () => {
        await new Promise((r) => setTimeout(r, 200));
        return makeLlmCompletion({ content: 'too late' });
      };

      const out = await service.run('analytics-agent', 'slow', ownerCtx, {
        runTimeoutMs: 25,
      });

      expect(out.result).toMatch(/timed out/i);
    });
  });

  describe('run — invalid args', () => {
    it('reports invalid_arguments and continues', async () => {
      const { service, llm, tools } = buildService();
      service.register(makeAgent());
      tools.register(makeTool({ name: 'get_revenue' }));
      // Override validation to fail this call.
      tools.validateArgs = (_name: string) => {
        void _name;
        return { valid: false, errors: ['period is required'] };
      };

      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [{ id: 'c1', name: 'get_revenue', argsJson: '{}' }],
        }),
      );
      llm.enqueue(makeLlmCompletion({ content: 'fixed it' }));

      const out = await service.run('analytics-agent', 'go', ownerCtx);

      expect(out).toEqual({ result: 'fixed it' });
      expect(tools.executeCalls).toEqual([]);
      const toolMsg = llm.calls[1].messages.find((m) => m.role === 'tool');
      expect(JSON.parse(toolMsg!.content as string)).toEqual({
        error: 'invalid_arguments',
        detail: ['period is required'],
      });
    });
  });

  describe('hallucination guard — detectHallucinatedActionForTest', () => {
    it('flags "Email sent" when send_email was not invoked', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        'Here are the invoices. Email sent to your personal address.',
        ['list_invoices'],
      );
      expect(out).toEqual({
        action: 'sent an email',
        requiredTool: 'send_email',
      });
    });

    it('does NOT flag "Email sent" when send_email IS in tools used', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        "I've sent the email to the customer.",
        ['list_invoices', 'send_email'],
      );
      expect(out).toBeNull();
    });

    it('flags "I\'ve sent an SMS" without send_sms', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        "I've sent an SMS to remind them.",
        ['find_customer'],
      );
      expect(out?.requiredTool).toBe('send_sms');
    });

    it('flags "payment recorded" without record_payment', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        'The payment was recorded successfully.',
        [],
      );
      expect(out?.requiredTool).toBe('record_payment');
    });

    it('flags "appointment cancelled" without cancel_appointment', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        'The appointment has been cancelled.',
        [],
      );
      expect(out?.requiredTool).toBe('cancel_appointment');
    });

    it('returns null on empty content', () => {
      const { service } = buildService();
      expect(service.detectHallucinatedActionForTest('', [])).toBeNull();
      expect(service.detectHallucinatedActionForTest('   ', [])).toBeNull();
    });

    it('returns null for innocuous text mentioning email but no claim', () => {
      const { service } = buildService();
      const out = service.detectHallucinatedActionForTest(
        'You can send them an email at owner@example.com if needed.',
        [],
      );
      expect(out).toBeNull();
    });
  });

  describe('run — hallucination guard forces corrective retry', () => {
    it('detects "Email sent" without send_email and forces another iteration', async () => {
      const { service, llm } = buildService();
      service.register(
        makeAgent({ toolWhitelist: ['send_email'], iterationCap: 3 }),
      );

      // Iteration 1: model fabricates a sent-email claim with zero tool calls.
      llm.enqueue(
        makeLlmCompletion({
          content: 'Email sent to your personal address.',
          toolCalls: [],
        }),
      );
      // Iteration 2: model corrects itself after the guard's nudge.
      llm.enqueue(
        makeLlmCompletion({
          content:
            'Sorry — I cannot send the email; please use the email page.',
          toolCalls: [],
        }),
      );

      const out = await service.run('analytics-agent', 'mail me', ownerCtx);

      expect(out.result).not.toMatch(/Email sent/i);
      expect(out.result).toMatch(/cannot send|cannot|did not/i);
      expect(llm.calls).toHaveLength(2);

      // The corrective system message must be present in the second call.
      const correctiveMsg = llm.calls[1].messages.find(
        (m) =>
          m.role === 'system' &&
          /never invoked the send_email/i.test(m.content ?? ''),
      );
      expect(correctiveMsg).toBeDefined();
    });

    it('does not retry when iteration cap is already reached', async () => {
      const { service, llm } = buildService();
      service.register(
        makeAgent({ toolWhitelist: ['send_email'], iterationCap: 1 }),
      );

      llm.enqueue(
        makeLlmCompletion({
          content: 'Email sent.',
          toolCalls: [],
        }),
      );

      const out = await service.run('analytics-agent', 'mail me', ownerCtx);

      // Cap was 1 so the guard cannot retry; the lie is returned (better
      // surfaced via logs/dev-only than silently dropped). Production cap is 6
      // so this only fails-open at the very edge.
      expect(out.result).toBe('Email sent.');
      expect(llm.calls).toHaveLength(1);
    });

    it('does not retry when send_email was actually invoked', async () => {
      const { service, llm, tools } = buildService();
      service.register(
        makeAgent({ toolWhitelist: ['send_email'], iterationCap: 3 }),
      );
      tools.register(
        makeTool({
          name: 'send_email',
          blastTier: AssistantBlastTier.AUTO_WRITE,
          handler: async () => ({
            providerMessageId: 'msg_1',
            status: 'queued',
          }),
        }),
      );

      // Iteration 1: model invokes send_email.
      llm.enqueue(
        makeLlmCompletion({
          content: null,
          toolCalls: [
            {
              id: 'c1',
              name: 'send_email',
              argsJson: JSON.stringify({
                to: 'a@b.c',
                subject: 's',
                text: 't',
              }),
            },
          ],
        }),
      );
      // Iteration 2: model summarizes; "Email sent" is honest now.
      llm.enqueue(
        makeLlmCompletion({
          content: 'Email sent to a@b.c.',
          toolCalls: [],
        }),
      );

      const out = await service.run('analytics-agent', 'mail me', ownerCtx);

      expect(out.result).toBe('Email sent to a@b.c.');
      expect(llm.calls).toHaveLength(2); // No corrective retry needed.
    });
  });
});
