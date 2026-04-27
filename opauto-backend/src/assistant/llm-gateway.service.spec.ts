import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmCompletionRequest } from './types';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const okJson = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as unknown as Response;

const errJson = (status: number, data: unknown): Response =>
  ({
    ok: false,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as unknown as Response;

const baseRequest: LlmCompletionRequest = {
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hello' },
  ],
};

async function makeService(env: Record<string, string | undefined>) {
  const configMock = {
    get: jest.fn((key: string) => env[key]),
  };
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      LlmGatewayService,
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();
  return moduleRef.get(LlmGatewayService);
}

describe('LlmGatewayService', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns a mock result when no provider keys are configured', async () => {
    const fetchMock: FetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({});

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mock');
    expect(result.content).toMatch(/no API key|configured/i);
    expect(result.toolCalls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a Groq result when Groq replies with text', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [
          {
            message: { role: 'assistant', content: 'hi from groq' },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ GROQ_API_KEY: 'g' });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('groq');
    expect(result.content).toBe('hi from groq');
    expect(result.toolCalls).toEqual([]);
    expect(result.tokensIn).toBe(12);
    expect(result.tokensOut).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/groq\.com/);
  });

  it('falls back to Claude when Groq returns 5xx', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(503, { error: { message: 'down' } }))
      .mockResolvedValueOnce(
        okJson({
          content: [{ type: 'text', text: 'hi from claude' }],
          usage: { input_tokens: 7, output_tokens: 3 },
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('hi from claude');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/anthropic\.com/);
  });

  it('falls back to Claude when Groq emits malformed tool-call JSON', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        okJson({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'do_thing', arguments: '{not valid json' },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          content: [{ type: 'text', text: 'rescued' }],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('rescued');
  });

  it('returns structured tool calls from Groq', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_42',
                  type: 'function',
                  function: {
                    name: 'get_dashboard_kpis',
                    arguments: '{"period":"week"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ GROQ_API_KEY: 'g' });

    const result = await service.complete({
      messages: baseRequest.messages,
      tools: [
        {
          name: 'get_dashboard_kpis',
          description: 'Get the KPIs',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.provider).toBe('groq');
    expect(result.toolCalls).toEqual([
      {
        id: 'call_42',
        name: 'get_dashboard_kpis',
        argsJson: '{"period":"week"}',
      },
    ]);
    expect(result.content).toBeNull();

    // Verify the tools array was passed through to Groq in OpenAI shape.
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.tools).toBeDefined();
    expect(body.tools[0]).toMatchObject({
      type: 'function',
      function: { name: 'get_dashboard_kpis' },
    });
  });

  it('returns a mock apologetic result when both providers fail', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(500, { error: { message: 'boom' } }))
      .mockResolvedValueOnce(errJson(500, { error: { message: 'boom' } }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mock');
    expect(result.content).toMatch(/sorry|couldn't reach/i);
    expect(result.toolCalls).toEqual([]);
  });

  it('falls back to Cerebras when Groq returns 429 (TPM exceeded)', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'TPM' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [{ message: { role: 'assistant', content: 'cerebras hi' } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      CEREBRAS_API_KEY: 'c',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('cerebras');
    expect(result.content).toBe('cerebras hi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/cerebras\.ai/);
  });

  it('uses default Cerebras model when caller passes a Groq-only model id', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'TPM' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [{ message: { role: 'assistant', content: 'ok' } }],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      CEREBRAS_API_KEY: 'c',
    });

    await service.complete({
      messages: baseRequest.messages,
      // Groq-shaped id with `-instant` suffix that Cerebras doesn't host.
      model: 'llama-3.1-8b-instant',
    });

    const cerebrasBody = JSON.parse(
      String(fetchMock.mock.calls[1][1]?.body),
    );
    expect(cerebrasBody.model).toBe('llama3.1-8b');
  });

  it('falls back to Mistral when both Groq and Cerebras fail', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'g' } }))
      .mockResolvedValueOnce(errJson(500, { error: { message: 'c' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [
            { message: { role: 'assistant', content: 'mistral hi' } },
          ],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      CEREBRAS_API_KEY: 'c',
      MISTRAL_API_KEY: 'm',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mistral');
    expect(result.content).toBe('mistral hi');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/mistral\.ai/);
  });

  it('returns Cerebras tool calls in the same shape as Groq', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'TPM' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_x',
                    type: 'function',
                    function: {
                      name: 'list_overdue_invoices',
                      arguments: '{"limit":3}',
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      CEREBRAS_API_KEY: 'c',
    });

    const result = await service.complete({
      messages: baseRequest.messages,
      tools: [
        {
          name: 'list_overdue_invoices',
          description: 'd',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.provider).toBe('cerebras');
    expect(result.toolCalls).toEqual([
      { id: 'call_x', name: 'list_overdue_invoices', argsJson: '{"limit":3}' },
    ]);
  });

  it('does not throw when Groq fetch itself rejects', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        okJson({ content: [{ type: 'text', text: 'ok' }] }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      GROQ_API_KEY: 'g',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);
    expect(result.provider).toBe('claude');
  });

  it('translates tool descriptors into the Claude tool shape', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'get_dashboard_kpis',
            input: { period: 'week' },
          },
        ],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ ANTHROPIC_API_KEY: 'a' });

    const result = await service.complete({
      messages: baseRequest.messages,
      tools: [
        {
          name: 'get_dashboard_kpis',
          description: 'Get the KPIs',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.provider).toBe('claude');
    expect(result.toolCalls).toEqual([
      {
        id: 'tu_1',
        name: 'get_dashboard_kpis',
        argsJson: '{"period":"week"}',
      },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.tools[0]).toMatchObject({
      name: 'get_dashboard_kpis',
      input_schema: { type: 'object' },
    });
    // Claude should NOT receive tools in OpenAI shape.
    expect(body.tools[0].function).toBeUndefined();
  });
});
