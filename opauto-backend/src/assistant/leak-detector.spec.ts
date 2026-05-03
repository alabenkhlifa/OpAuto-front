import {
  ProviderToolLeakError,
  detectToolCallLeak,
  salvageToolCall,
  scrubLeakFromContent,
} from './leak-detector';

const KNOWN = new Set<string>([
  'send_sms',
  'send_email',
  'find_customer',
  'list_overdue_invoices',
  'load_skill',
  'dispatch_agent',
]);

describe('leak-detector', () => {
  describe('detectToolCallLeak', () => {
    it('returns null for clean prose', () => {
      expect(detectToolCallLeak('Hello, your invoice is overdue.')).toBeNull();
    });

    it('returns null for null/empty', () => {
      expect(detectToolCallLeak(null)).toBeNull();
      expect(detectToolCallLeak('')).toBeNull();
    });

    it('detects a single XML-tag tool call', () => {
      const leak = detectToolCallLeak(
        'Sure, sending now: <function=send_sms>{"to":"+216","body":"hi"}</function>',
      );
      expect(leak?.kind).toBe('xml_tag');
      expect(leak?.matches.length).toBe(1);
    });

    it('detects multiple chained XML-tag tool calls', () => {
      const leak = detectToolCallLeak(
        '<function=find_customer>{"q":"Ali"}</function><function=send_sms>{"to":"x"}</function>',
      );
      expect(leak?.kind).toBe('xml_tag');
      expect(leak?.matches.length).toBe(2);
    });

    it('detects raw JSON tool-call dump (the qwen failure mode)', () => {
      const leak = detectToolCallLeak(
        '{"type": "function", "name": "send_sms", "arguments": {"to": "+216", "body": "hi"}}',
      );
      expect(leak?.kind).toBe('raw_json');
      expect(leak?.matches.length).toBe(1);
    });

    it('detects the user-reported 5-call semicolon-chain', () => {
      const content =
        '{"type": "function", "name": "load_skill", "arguments": {"name": "invoice-collections"}}; ' +
        '{"type": "function", "name": "dispatch_agent", "arguments": {"input": "send SMS", "name": "communications-agent"}}; ' +
        '{"type": "function", "name": "find_customer", "arguments": {"query": "Ali Ben Salah"}}; ' +
        '{"type": "function", "name": "list_overdue_invoices", "arguments": {"limit": "5"}}; ' +
        '{"type": "function", "name": "send_sms", "arguments": {"to": "+21656829196", "body": "Hi"}}';
      const leak = detectToolCallLeak(content);
      expect(leak?.kind).toBe('raw_json');
      expect(leak?.matches.length).toBe(5);
    });

    it('handles nested objects in arguments via brace counting', () => {
      const content =
        '{"type":"function","name":"send_email","arguments":{"to":"x","meta":{"a":1,"b":[2,3]}}}';
      const leak = detectToolCallLeak(content);
      expect(leak?.matches.length).toBe(1);
      expect(JSON.parse(leak!.matches[0]).name).toBe('send_email');
    });

    it('does not match prose that mentions tools by name', () => {
      const content =
        'I will use the send_sms tool to message Ali. The function name is send_sms.';
      expect(detectToolCallLeak(content)).toBeNull();
    });
  });

  describe('salvageToolCall', () => {
    it('salvages a single XML-tag call when the tool name is known', () => {
      const leak = detectToolCallLeak(
        '<function=send_sms>{"to":"+216","body":"Hi"}</function>',
      )!;
      const call = salvageToolCall(leak, KNOWN);
      expect(call).not.toBeNull();
      expect(call?.name).toBe('send_sms');
      expect(JSON.parse(call!.argsJson)).toEqual({ to: '+216', body: 'Hi' });
    });

    it('salvages a single raw-JSON call', () => {
      const leak = detectToolCallLeak(
        '{"type":"function","name":"find_customer","arguments":{"query":"Ali"}}',
      )!;
      const call = salvageToolCall(leak, KNOWN);
      expect(call?.name).toBe('find_customer');
      expect(JSON.parse(call!.argsJson)).toEqual({ query: 'Ali' });
    });

    it('rejects multi-call leaks (cannot pick just one)', () => {
      const leak = detectToolCallLeak(
        '{"type":"function","name":"find_customer","arguments":{}}; ' +
          '{"type":"function","name":"send_sms","arguments":{"to":"x","body":"y"}}',
      )!;
      expect(salvageToolCall(leak, KNOWN)).toBeNull();
    });

    it('rejects when the tool name is unknown', () => {
      const leak = detectToolCallLeak(
        '<function=hallucinated_tool>{"x":1}</function>',
      )!;
      expect(salvageToolCall(leak, KNOWN)).toBeNull();
    });

    it('rejects when args are unparseable', () => {
      const leak = detectToolCallLeak(
        '<function=send_sms>not-json</function>',
      )!;
      expect(salvageToolCall(leak, KNOWN)).toBeNull();
    });

    it('treats empty/missing args as `{}`', () => {
      const leak = detectToolCallLeak('<function=send_sms>  </function>')!;
      const call = salvageToolCall(leak, KNOWN);
      expect(call?.argsJson).toBe('{}');
    });

    it('accepts arguments delivered as a JSON string (qwen variant)', () => {
      const leak = detectToolCallLeak(
        '{"type":"function","name":"send_sms","arguments":"{\\"to\\":\\"x\\",\\"body\\":\\"y\\"}"}',
      )!;
      const call = salvageToolCall(leak, KNOWN);
      expect(call?.name).toBe('send_sms');
      expect(JSON.parse(call!.argsJson)).toEqual({ to: 'x', body: 'y' });
    });
  });

  describe('scrubLeakFromContent', () => {
    it('strips XML-tag tool calls and trims', () => {
      const content =
        'Sure thing. <function=send_sms>{"to":"x"}</function>\n\nLet me know if you need more.';
      const out = scrubLeakFromContent(content);
      expect(out).toContain('Sure thing.');
      expect(out).toContain('Let me know if you need more.');
      expect(out).not.toContain('<function');
    });

    it('strips raw JSON tool calls', () => {
      const out = scrubLeakFromContent(
        'Here you go: {"type":"function","name":"send_sms","arguments":{"to":"x"}};',
      );
      expect(out).toBe('Here you go:');
    });

    it('returns null when only leaks remain', () => {
      const out = scrubLeakFromContent(
        '<function=send_sms>{"to":"x"}</function>',
      );
      expect(out).toBeNull();
    });

    it('preserves clean prose untouched (idempotent on no leak)', () => {
      const clean = 'Your invoice number is INV-1234 and it is overdue.';
      expect(scrubLeakFromContent(clean)).toBe(clean);
    });

    it('passes through null', () => {
      expect(scrubLeakFromContent(null)).toBeNull();
    });
  });

  describe('ProviderToolLeakError', () => {
    it('carries provider, kind, and count', () => {
      const leak = detectToolCallLeak(
        '<function=send_sms>{"to":"x"}</function>',
      )!;
      const err = new ProviderToolLeakError('cerebras', leak);
      expect(err.provider).toBe('cerebras');
      expect(err.leakKind).toBe('xml_tag');
      expect(err.callCount).toBe(1);
      expect(err.message).toContain('cerebras');
    });
  });

  describe('I-013 — bare-name JSON detection (B-11 dispatch_agent leak)', () => {
    const knownNames = new Set([
      'dispatch_agent',
      'load_skill',
      'list_at_risk_customers',
      'list_maintenance_due',
    ]);

    it('catches `{"name":"dispatch_agent","input":...}` shapes when known names are supplied', () => {
      const content =
        'Here is the analysis: {"name":"dispatch_agent","input":"audit","reason":"deep dive"}';
      // Without knownNames the legacy detector misses it.
      expect(detectToolCallLeak(content)).toBeNull();
      // With knownNames it is detected as raw_json.
      const leak = detectToolCallLeak(content, knownNames);
      expect(leak).not.toBeNull();
      expect(leak!.kind).toBe('raw_json');
      expect(leak!.matches.length).toBe(1);
      expect(leak!.matches[0]).toContain('dispatch_agent');
    });

    it('catches `{"name":"<known>","arguments":{...}}` even without "type":"function"', () => {
      const content =
        'Result: {"name":"list_maintenance_due","arguments":{"withinDays":30}}';
      const leak = detectToolCallLeak(content, knownNames);
      expect(leak).not.toBeNull();
      expect(leak!.matches[0]).toContain('list_maintenance_due');
    });

    it('does NOT match objects whose name is not a known tool', () => {
      const content =
        'My favorite chair: {"name":"dining_chair","arguments":{"legs":4}}';
      expect(detectToolCallLeak(content, knownNames)).toBeNull();
    });

    it('scrubLeakFromContent removes the bare-name JSON when knownNames is supplied', () => {
      const content =
        'Here is the analysis. {"name":"dispatch_agent","input":"audit","reason":"x"}; And it is done.';
      const scrubbed = scrubLeakFromContent(content, knownNames);
      expect(scrubbed).toBe('Here is the analysis. And it is done.');
    });

    it('scrubLeakFromContent without knownNames does not strip bare-name JSON (legacy behaviour preserved)', () => {
      const content =
        'Hello {"name":"dispatch_agent","input":"audit","reason":"x"} world';
      // Without the I-013 hint, the bare shape stays put.
      expect(scrubLeakFromContent(content)).toContain('dispatch_agent');
    });
  });

  describe('I-016 — bare-key tool-call shorthand (send_email body leak)', () => {
    const knownNames = new Set([
      'get_dashboard_kpis',
      'get_revenue_summary',
      'list_overdue_invoices',
      'load_skill',
      'dispatch_agent',
    ]);

    it('catches `{<known>: {}}` with empty args', () => {
      const content =
        'Dashboard KPIs: {get_dashboard_kpis: {}} (please review)';
      const leak = detectToolCallLeak(content, knownNames);
      expect(leak).not.toBeNull();
      expect(leak!.kind).toBe('raw_json');
      expect(leak!.matches[0]).toContain('get_dashboard_kpis');
    });

    it('catches `{<known>: {"period": "month"}}` with args', () => {
      const content = 'Revenue: {get_revenue_summary: {"period": "month"}}';
      const leak = detectToolCallLeak(content, knownNames);
      expect(leak).not.toBeNull();
      expect(leak!.matches[0]).toContain('get_revenue_summary');
    });

    it('catches the full email-body leak (multiple bare-key shorthands)', () => {
      const content =
        '- Dashboard KPIs: {get_dashboard_kpis: {}}\n' +
        '- Revenue summary: {get_revenue_summary: {"period": "month"}}\n' +
        '- Overdue invoices: {list_overdue_invoices: {"limit": 10}}\n' +
        '- Restocking: {load_skill: {"name": "inventory-restocking"}}';
      const leak = detectToolCallLeak(content, knownNames);
      expect(leak).not.toBeNull();
      expect(leak!.matches.length).toBe(4);
    });

    it('does NOT match `{<unknown>: {...}}` (object literals in prose)', () => {
      const content =
        'My settings: {favorite_color: {"hex": "#FF8400"}} — a typical orange.';
      expect(detectToolCallLeak(content, knownNames)).toBeNull();
    });

    it('requires an object value — `{tool: "string"}` is not a tool-call shape', () => {
      // Tool calls always pass an object (or nothing) as args. A bare-key with
      // a string value is just markdown/prose and must not trip detection.
      const content = 'Use the {get_revenue_summary: function} to fetch data.';
      expect(detectToolCallLeak(content, knownNames)).toBeNull();
    });

    it('without knownNames, bare-key shorthand is NOT detected (legacy preserved)', () => {
      const content = 'Bla bla {get_dashboard_kpis: {}} bla.';
      expect(detectToolCallLeak(content)).toBeNull();
    });

    it('scrubLeakFromContent strips bare-key shorthand when knownNames supplied', () => {
      const content = 'Hello: {get_dashboard_kpis: {}} world.';
      // Scrubber consumes trailing whitespace after the leak — consistent with
      // the raw_json scrub above ("Here you go: ..." → "Here you go:").
      expect(scrubLeakFromContent(content, knownNames)).toBe('Hello: world.');
    });
  });
});
