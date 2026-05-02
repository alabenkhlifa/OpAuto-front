import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from './llm-gateway.service';
import {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmValidationOutcome,
} from './types';

type FetchMock = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>;

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

  // Provider order: OVH is the FLOOR (pay-as-you-go, no quota cliff). When
  // both OVH and Gemini are configured, OVH must be tried first — putting a
  // free-tier provider in front lets a 429 RPD/RPM gate the user out even
  // though OVH is healthy. Verified by the 2026-05-02 cascade incident where
  // Gemini exhausted its daily quota and the chain spilled all the way to a
  // mock fallback while OVH was untouched.
  it('calls OVH first even when Gemini is also configured', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'ovh primary' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      GEMINI_API_KEY: 'g',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('ovh');
    expect(result.content).toBe('ovh primary');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/kepler\.ai\.cloud\.ovh\.net/);
    expect(String(url)).not.toMatch(/generativelanguage\.googleapis\.com/);
  });

  it('falls back to Gemini when OVH fails and Gemini is configured', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(503, { error: { message: 'down' } }))
      .mockResolvedValueOnce(
        okJson({
          candidates: [
            {
              content: { parts: [{ text: 'gemini rescued' }] },
            },
          ],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      GEMINI_API_KEY: 'g',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('gemini');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/ovh\.net/);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(
      /generativelanguage\.googleapis\.com/,
    );
  });

  it('returns an OVH result when OVH replies with text', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [
          {
            message: { role: 'assistant', content: 'hi from ovh' },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ OVH_API_KEY: 'o' });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('ovh');
    expect(result.content).toBe('hi from ovh');
    expect(result.toolCalls).toEqual([]);
    expect(result.tokensIn).toBe(12);
    expect(result.tokensOut).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/kepler\.ai\.cloud\.ovh\.net/);
  });

  it('uses OVH_BASE_URL override when provided', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'override ok' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_BASE_URL: 'https://custom.example.com/v1',
    });

    await service.complete(baseRequest);

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://custom.example.com/v1/chat/completions');
  });

  it('uses OVH_MODEL override in the request body', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_MODEL: 'Mistral-Small-3_2-24B-Instruct-2506',
    });

    await service.complete(baseRequest);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('Mistral-Small-3_2-24B-Instruct-2506');
  });

  // Regression: prod had OVH_MODEL="Mistral-Small-3_2-24B-Instruct-2506" (a
  // Mistral.ai catalog id pasted into the OVH env), which OVH 404s with
  // "model does not exist". OVH is pay-as-you-go and is supposed to be the
  // floor of the provider chain — when it fails, callers cascade through
  // free-tier providers that may all be quota-saturated. Self-heal by
  // retrying once with the built-in default model.
  it('retries with default OVH model when configured OVH_MODEL 404s as not-found', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        errJson(404, {
          error: {
            message:
              'The model `Mistral-Small-3_2-24B-Instruct-2506` does not exist',
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          choices: [{ message: { role: 'assistant', content: 'recovered' } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 },
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_MODEL: 'Mistral-Small-3_2-24B-Instruct-2506',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('ovh');
    expect(result.content).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstBody.model).toBe('Mistral-Small-3_2-24B-Instruct-2506');
    expect(retryBody.model).toBe('Meta-Llama-3_3-70B-Instruct');
  });

  it('does NOT retry OVH when 404 is not model-not-found', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        errJson(404, { error: { message: 'route not found' } }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_MODEL: 'Mistral-Small-3_2-24B-Instruct-2506',
    });

    const result = await service.complete(baseRequest);

    // Single OVH attempt; cascades to mock since no other providers configured.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('mock');
  });

  it('does NOT retry OVH when configured model is already the default', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        errJson(404, { error: { message: 'model does not exist' } }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_MODEL: 'Meta-Llama-3_3-70B-Instruct',
    });

    const result = await service.complete(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('mock');
  });

  // Regression: docker-compose maps `OVH_MODEL: ${OVH_MODEL:-}`, which forwards
  // an EMPTY STRING (not undefined) when the host .env has no OVH_MODEL line.
  // Earlier code used `??` which only falls back on null/undefined, so the
  // empty string reached OVH and 404'd: "The model `` does not exist."
  it('falls back to default OVH model when OVH_MODEL is an empty string', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      OVH_MODEL: '',
      OVH_BASE_URL: '',
    });

    await service.complete(baseRequest);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('Meta-Llama-3_3-70B-Instruct');
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/kepler\.ai\.cloud\.ovh\.net/);
  });

  it('skips Groq entirely (only key configured returns mock)', async () => {
    const fetchMock: FetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ GROQ_API_KEY: 'g' });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mock');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to Claude when OVH returns 5xx', async () => {
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
      OVH_API_KEY: 'o',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('hi from claude');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/anthropic\.com/);
  });

  it('falls back to Claude when OVH emits malformed tool-call JSON', async () => {
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
                    function: {
                      name: 'do_thing',
                      arguments: '{not valid json',
                    },
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
      OVH_API_KEY: 'o',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('rescued');
  });

  it('returns structured tool calls from OVH', async () => {
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
    const service = await makeService({ OVH_API_KEY: 'o' });

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

    expect(result.provider).toBe('ovh');
    expect(result.toolCalls).toEqual([
      {
        id: 'call_42',
        name: 'get_dashboard_kpis',
        argsJson: '{"period":"week"}',
      },
    ]);
    expect(result.content).toBeNull();

    // Verify the tools array was passed through to OVH in OpenAI shape.
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
      OVH_API_KEY: 'o',
      ANTHROPIC_API_KEY: 'a',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mock');
    expect(result.content).toMatch(/sorry|couldn't reach/i);
    expect(result.toolCalls).toEqual([]);
  });

  it('falls back to Mistral when OVH returns 429 (rate exceeded)', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'rate' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [{ message: { role: 'assistant', content: 'mistral hi' } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      MISTRAL_API_KEY: 'm',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('mistral');
    expect(result.content).toBe('mistral hi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/mistral\.ai/);
  });

  it('falls back to Cerebras when OVH + Mistral both fail', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(errJson(429, { error: { message: 'o' } }))
      .mockResolvedValueOnce(errJson(500, { error: { message: 'm' } }))
      .mockResolvedValueOnce(
        okJson({
          choices: [{ message: { role: 'assistant', content: 'cerebras hi' } }],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
      MISTRAL_API_KEY: 'm',
      CEREBRAS_API_KEY: 'c',
    });

    const result = await service.complete(baseRequest);

    expect(result.provider).toBe('cerebras');
    expect(result.content).toBe('cerebras hi');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/cerebras\.ai/);
  });

  it('does not pass a Groq-only model id through to OVH', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ OVH_API_KEY: 'o' });

    // `llama-3.1-8b-instant` is Groq-shaped; OVH doesn't host it. The model
    // pattern should reject it and the request should use OVH's default model.
    await service.complete({
      messages: baseRequest.messages,
      model: 'llama-3.1-8b-instant',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('Meta-Llama-3_3-70B-Instruct');
  });

  it('honors a caller-supplied OVH-shaped model id', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
      okJson({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({ OVH_API_KEY: 'o' });

    await service.complete({
      messages: baseRequest.messages,
      model: 'Meta-Llama-3_3-70B-Instruct',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('Meta-Llama-3_3-70B-Instruct');
  });

  it('returns Cerebras tool calls in the same shape as OVH', async () => {
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
      OVH_API_KEY: 'o',
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

  it('does not throw when OVH fetch itself rejects', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        okJson({ content: [{ type: 'text', text: 'ok' }] }),
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const service = await makeService({
      OVH_API_KEY: 'o',
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

  // ── Caller-side validator (text-mode tool-call leak handling) ──────────
  describe('validateResult callback', () => {
    it('falls through when validator rejects the first provider', async () => {
      const fetchMock: FetchMock = jest
        .fn()
        // Gemini returns OK content but the validator will reject it.
        .mockResolvedValueOnce(
          okJson({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"type":"function","name":"send_sms","arguments":{"to":"x","body":"y"}}',
                    },
                  ],
                },
              },
            ],
          }),
        )
        // Claude rescues with clean prose. (No Groq/Mistral/Cerebras keys
        // configured in this test, so the chain skips straight to Claude.)
        .mockResolvedValueOnce(
          okJson({ content: [{ type: 'text', text: 'rescued by claude' }] }),
        );
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const service = await makeService({
        GEMINI_API_KEY: 'gem',
        ANTHROPIC_API_KEY: 'a',
      });

      const validateResult = jest.fn(
        (result: LlmCompletionResult): LlmValidationOutcome => {
          if (result.content?.includes('"type":"function"')) {
            return { ok: false, reason: 'tool_call_leak_raw_json_count=1' };
          }
          return { ok: true, result };
        },
      );

      const result = await service.complete({
        ...baseRequest,
        validateResult,
      });

      expect(result.provider).toBe('claude');
      expect(result.content).toBe('rescued by claude');
      // Validator runs on each successful provider response.
      expect(validateResult).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns the validator-mutated result when accepted', async () => {
      const fetchMock: FetchMock = jest.fn().mockResolvedValueOnce(
        okJson({
          candidates: [
            {
              content: {
                parts: [{ text: 'original content' }],
              },
            },
          ],
        }),
      );
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const service = await makeService({ GEMINI_API_KEY: 'gem' });

      const validateResult = jest.fn(
        (result: LlmCompletionResult): LlmValidationOutcome => ({
          ok: true,
          result: { ...result, content: 'transformed' },
        }),
      );

      const result = await service.complete({
        ...baseRequest,
        validateResult,
      });

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('transformed');
    });

    it('treats validator throws as rejection rather than crashing the chain', async () => {
      const fetchMock: FetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          okJson({
            candidates: [
              {
                content: { parts: [{ text: 'gemini content' }] },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          okJson({ content: [{ type: 'text', text: 'claude rescue' }] }),
        );
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const service = await makeService({
        GEMINI_API_KEY: 'gem',
        ANTHROPIC_API_KEY: 'a',
      });

      let firstCall = true;
      const result = await service.complete({
        ...baseRequest,
        validateResult: (r): LlmValidationOutcome => {
          if (firstCall) {
            firstCall = false;
            throw new Error('boom');
          }
          return { ok: true, result: r };
        },
      });

      expect(result.provider).toBe('claude');
      expect(result.content).toBe('claude rescue');
    });
  });
});
