import { Test, TestingModule } from '@nestjs/testing';
import { IntentClassifierService } from './intent-classifier.service';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmCompletionResult } from './types';

const TOOLS = [
  { name: 'get_revenue_summary', description: 'Aggregated revenue for a period.' },
  { name: 'list_top_customers', description: 'Top customers by revenue or visits.' },
  { name: 'send_sms', description: 'Send an SMS to a phone number.' },
];

function makeLlm(result: Partial<LlmCompletionResult> & { content: string | null }) {
  return {
    complete: jest.fn(async () => ({
      provider: 'mock' as const,
      content: result.content,
      toolCalls: result.toolCalls ?? [],
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    })),
  };
}

async function makeService(llm: any): Promise<IntentClassifierService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      IntentClassifierService,
      { provide: LlmGatewayService, useValue: llm },
    ],
  }).compile();
  return moduleRef.get(IntentClassifierService);
}

describe('IntentClassifierService', () => {
  it('returns the picked tool names from a clean JSON array reply', async () => {
    const llm = makeLlm({ content: '["get_revenue_summary","list_top_customers"]' });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'who are my best customers',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toEqual(['get_revenue_summary', 'list_top_customers']);
  });

  it('returns [] when the model decides no tool is needed', async () => {
    const llm = makeLlm({ content: '[]' });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'hi how are you',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toEqual([]);
  });

  it('returns [] when candidates list is empty (no LLM call)', async () => {
    const llm = makeLlm({ content: '["never_called"]' });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'whatever',
      locale: 'en',
      candidates: [],
    });
    expect(result).toEqual([]);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('extracts the JSON array even when the model wraps it in prose', async () => {
    const llm = makeLlm({
      content: 'Here are the relevant tools: ["send_sms"]. Hope that helps!',
    });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'send sms to ali',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toEqual(['send_sms']);
  });

  it('drops names that are not in the candidates list (anti-hallucination)', async () => {
    const llm = makeLlm({
      content: '["get_revenue_summary","fake_tool","another_fake"]',
    });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'revenue please',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toEqual(['get_revenue_summary']);
  });

  it('caps at 5 tools even if the model returns more', async () => {
    const llm = makeLlm({
      content: '["a","b","c","d","e","f","g"]',
    });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'do everything',
      locale: 'en',
      candidates: [
        { name: 'a', description: '' },
        { name: 'b', description: '' },
        { name: 'c', description: '' },
        { name: 'd', description: '' },
        { name: 'e', description: '' },
        { name: 'f', description: '' },
        { name: 'g', description: '' },
      ],
    });
    expect(result).toHaveLength(5);
  });

  it('returns null when the LLM emits prose with no JSON array (caller falls back to full registry)', async () => {
    const llm = makeLlm({ content: 'I cannot decide right now.' });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'something',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toBeNull();
  });

  it('returns null when the LLM emits malformed JSON', async () => {
    const llm = makeLlm({ content: '["unclosed" '.replace(/$/, '') });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'broken',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toBeNull();
  });

  it('returns null on empty content', async () => {
    const llm = makeLlm({ content: '' });
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'anything',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toBeNull();
  });

  it('returns null when the LLM gateway throws', async () => {
    const llm = {
      complete: jest.fn(async () => {
        throw new Error('network down');
      }),
    };
    const svc = await makeService(llm);
    const result = await svc.classify({
      userMessage: 'anything',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(result).toBeNull();
  });

  it('passes a small payload (no JSON schemas) to the LLM gateway', async () => {
    const llm = makeLlm({ content: '[]' });
    const svc = await makeService(llm);
    await svc.classify({
      userMessage: 'hi',
      locale: 'en',
      candidates: TOOLS,
    });
    expect(llm.complete).toHaveBeenCalledTimes(1);
    const calls = (llm.complete as jest.Mock).mock.calls as unknown as any[][];
    const sentBody = JSON.stringify(calls[0][0]);
    // System prompt should mention each tool name + description, but NOT
    // include any "parameters" / JSON-schema markers that bloat token use.
    expect(sentBody).toContain('get_revenue_summary');
    expect(sentBody).toContain('Aggregated revenue');
    expect(sentBody).not.toContain('"parameters":');
    expect(sentBody).not.toContain('additionalProperties');
  });
});
