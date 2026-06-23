const MILLION = 1_000_000;

const OVH_PRICING = {
  LLAMA: {
    matcher: /(meta[-_]llama|llama)/i,
    inputRate: 0.74,
    outputRate: 0.74,
  },
  MISTRAL: {
    matcher: /mistral/i,
    inputRate: 0.1,
    outputRate: 0,
  },
};

export function estimateLlmCost(params: {
  provider: string | null | undefined;
  model: string | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
}): { estimatedCost: number; priced: boolean } {
  if ((params.provider ?? '').toLowerCase() !== 'ovh') {
    return { estimatedCost: 0, priced: false };
  }

  const model = params.model ?? '';
  const pricing = OVH_PRICING.MISTRAL.matcher.test(model)
    ? OVH_PRICING.MISTRAL
    : OVH_PRICING.LLAMA.matcher.test(model)
      ? OVH_PRICING.LLAMA
      : null;

  if (!pricing) {
    return { estimatedCost: 0, priced: false };
  }

  const tokensIn = params.tokensIn ?? 0;
  const tokensOut = params.tokensOut ?? 0;
  return {
    estimatedCost:
      (tokensIn * pricing.inputRate + tokensOut * pricing.outputRate) / MILLION,
    priced: true,
  };
}
