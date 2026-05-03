# AI Assistant — Improvements Backlog

**Drafted:** 2026-05-03 (autonomous test sweep)
**Source:** `docs/AI_ASSISTANT_TEST_PLAN.md` — wave-1 tool validation, write-tier validation, behavior suite, UI E2E.
**Status legend:** P0 critical · P1 important · P2 nice-to-have

This is a deferred improvements list, NOT a bug log. Bugs found during the sweep are tracked in §6 of the test plan and fixed in commits referenced there. Items here are gaps, hardening, and follow-ups that need design/owner decisions before being scheduled.

---

## P0 — fiscal / data integrity

### I-001 — Register a `create_invoice` assistant tool
**Where:** `opauto-backend/src/assistant/tools/invoicing-inventory/`
**Why:** The TYPED_CONFIRM_WRITE infrastructure exists, the `record_payment` tool already uses it, and `InvoicingService.create + issue` already produces gapless atomic numbering + per-line TVA + fiscal stamp. The assistant simply has no way to issue an invoice today — users must drop out to the UI. Closing this gap unlocks the highest-leverage agent workflow ("invoice this job") and is symmetrical with `record_payment`.
**Acceptance:** new `create-invoice.tool.ts` registered with `blastTier: TYPED_CONFIRM_WRITE`, `_expectedConfirmation` = the typed total amount; orchestrator gates on typed confirmation; rolls back on validation failure; integration test exercises the gapless-number + TVA + stamp invariants the validation script already covers via direct service call.

### I-002 — Audit every write-tier handler for input-validation defence-in-depth ✅ closed (read-through audit, no extra fixes needed)
**Why:** Bug 3 (`send_sms` accepting empty `to`) only surfaced because the validation script bypasses `ToolRegistryService.execute()` and calls handlers directly. Future agents — especially the agent runner — could legitimately bypass the registry too. Each handler should re-validate the inputs that matter for cost (recipient, amount) or for fiscal correctness (invoice id format) inside the handler.
**Audit result (2026-05-03):**
- `create_appointment` ✅ — verifies customer + car belong to `ctx.garageId`, parses `scheduledAt` and rejects NaN dates. Defensive.
- `cancel_appointment` ✅ — delegates to `appointmentsService.findOne(id, garageId)` which throws `NotFoundException` on cross-tenant access. Defensive.
- `record_payment` ✅ — garage ownership + PAID-status guard (Bug 1 fix `6fb21c2`). Defensive.
- `send_email` ✅ — `missing_body` / `missing_recipient` guards present (covered by `validate-send-email.ts`). Defensive.
- `send_sms` ✅ — recipient + body guards (Bug 3 fix `a40fbfd`). Defensive.

No additional code changes needed. Future write-tier tools should follow the same pattern: validate critical inputs in the handler, re-check ownership against `ctx.garageId`, return structured errors over throws when the failure is recoverable.

---

## P1 — observability / operational

### I-003 — Surface LLM-provider fallback events to validators and logs
**Why:** During the validation run, `list_at_risk_customers` and `list_maintenance_due` triggered Gemini 429s and silently fell back to deterministic logic. The validator counted both as PASS (because the deterministic path is correct) but a real LLM-driven retention/maintenance reply would have been downgraded. There is no signal in the response shape that tells the caller which path executed.
**Acceptance:** orchestrator emits a `provider` SSE event when fallthrough happens (Gemini → Mistral → Cerebras → Claude → mock), with the chosen provider name and the reason (429, network, validateResult rejection). Validation scripts can then assert `provider === 'gemini'` for the happy path.

### I-004 — `example` skill should be excluded from production routing ✅ shipped `67e1fbd`
**Why:** `opauto-backend/src/assistant/skills/example/en.md` is a no-op skill registered for testing the skill loader. It was exposed to the LLM router with description "A no-op skill used for testing the loader" and trigger phrase "test". A user typing "test" could route to it.
**What shipped:** `SkillDefinition` gains an optional `internal` flag. `SkillRegistryService.list()` (the only path used by the orchestrator + meta endpoint) filters internal skills out. `listAll()` returns every skill for tests / future admin tooling. `example/en.md` flagged `internal: true`. New test in `skill-registry.service.spec.ts` pins the contract.

### I-005 — Live send-email smoke test on schedule
**Why:** `validate-send-email.ts` stubs the Resend driver — by design, since hitting Resend on every CI run is wasteful. But this means a sender-domain regression (DKIM, sandbox-mode change, verified-address drift) would not be caught until production. The memory note `reference_resend_sandbox.md` already pins the only delivery target — `ala.khliifa@gmail.com`.
**Acceptance:** `scripts/send-email-live.ts` runs once a week (cron) against the sandbox-verified address, asserts `200 OK` from Resend, posts to a Slack channel on failure. **Do NOT cron this without explicit user sign-off.** Document the schedule in `docs/DEPLOYMENT.md`.

---

## P2 — coverage / hygiene

### I-006 — Skill cross-reference CI check ✅ shipped `6248ef3`
**Why:** All 10 skills' declared `tools:` lists currently resolve to registered tools. Nothing prevented that drifting — adding a new skill or renaming a tool was a one-character mistake away from a broken `load_skill` payload.
**What shipped:** `assistant/cross-references.spec.ts` — 17 tests (10 skills × 1 + 6 agents × 1 + 1 sanity). Reads the source files directly to discover the truth set of registered tool names from `*.tool.ts`, asserts every skill `tools:` frontmatter entry and every agent `toolWhitelist` entry resolves. Runs in ~2s, dep-free. Will fail CI on any drift.

### I-007 — Approval-expiry + resume protocol coverage
**Why:** Behavior scenarios B-30 (expiry) and B-31 (resume) hit code paths that are unit-tested in isolation but not exercised end-to-end in the behavior suite (the orchestrator's `__resume__:<toolCallId>` sentinel is convention, not contract). One bad serialization roundtrip and the resume turn fails silently.
**Acceptance:** `behavior-suite.ts` covers both: (a) APPROVE → resume → tool executes; (b) wait > expiry → POST `/decide` returns 410 → orchestrator emits a clear "approval expired" message.

### I-008 — Token-budget hit UX
**Why:** The 200k token budget per conversation throws a `budget_exceeded` SSE event, but there is no documented UX for what the panel does on receipt. Behavior scenario B-28 will validate the shape; the UI side may need a banner with a "start new conversation" CTA.
**Acceptance:** panel renders a non-dismissible banner on `budget_exceeded`, disables the input, links to "new conversation" button.

### I-009 — Document the assistant approval flow
**Why:** `docs/ASSISTANT.md` covers the six layers but does not state the approval state machine (PENDING → APPROVED|DENIED|EXPIRED → EXECUTED|FAILED), the `__resume__:<toolCallId>` resume sentinel, or the `_expectedConfirmation` convention used by `record_payment`. A new tool author has to read the orchestrator source to learn this.
**Acceptance:** new section in `docs/ASSISTANT.md` ("Approval flow") with state diagram, sentinel format, typed-confirm contract.

### I-010 — `find_car` empty-query truth-check
**Why:** During `validate-tools.ts`, the `find_car` PASS line logged `query=""` but the tool still located the target car (license-plate digits stripped to empty for that plate format). The test passed but this is brittle — the logic that produces the empty query is implicit and would silently break on a license-plate format change.
**Acceptance:** read the upstream call site, document why the query becomes empty for the PERF-BENCH plate, and tighten the validation either by changing the truth check or the tool's normalisation.

---

## Coverage gaps (raw)

These are scenarios the wave-1 sweep flagged but did not exercise. They graduate into numbered I-NNN entries above as we triage.

- Multi-garage isolation in approval `decide` endpoint (B-26 covers it for tools, not for the approval row itself).
- Per-user 30/min throttle and per-garage 200/min throttle — no load test today.
- Concurrent conversations in the same garage (does the LLM-gateway thrash the provider chain?).
- OVH pay-as-you-go cost tracking — is per-conversation `tokensIn/Out` aggregated by provider for billing?
- HTML email template inlining (CSS) — currently no validator coverage.
- `dispatch_agent` iteration-cap behavior on a deliberately-pathological agent (loop without a final answer).
- `validate-tools.ts` hard-codes seeded `owner@autotech.tn` — fails ungracefully if the seed changes.

---

## Future improvements identified by behavior + UI sweeps

The wave-2 sweeps shipped 7 fixes (UI Bug 1-4, B-19/Deny-doesn't-stick, B-25 hallucination, B-23/B-24 agent loops). The remaining ⚠️ flaky and ❌ failed scenarios surface these follow-ups:

### I-011 — JSON-Schema int coercion at the orchestrator boundary
**Why:** B-12 hit `/limit must be integer`, B-14 hit `/durationMinutes must be integer`, B-18 hit `/attachInvoiceIds must be array` — Groq/Llama emits a numeric *string* or single-id-string where the schema requires `integer` or `array<string>`. The validation rejects, the LLM retries with the same shape, and the turn loops until it hits the iteration cap. Three of the ten ⚠️ scenarios were caused by this single root cause.
**Acceptance:** `ToolRegistryService.validateArgs()` (or a new `coerceArgs()` step ahead of it) coerces:
- numeric strings → `number`/`integer` for properties typed as such;
- single string → 1-element array for properties typed `array<string>`.
Surface a one-time warning per (tool, property) pair so we can see how often coercion saves a turn.

### I-012 — Pre-approval UUID-shape validation for id args
**Why:** B-27 sent `cancel_appointment{appointmentId:"banana"}` and the orchestrator surfaced an approval card BEFORE rejecting the obviously-invalid id. The user is being asked to approve an action that is provably going to fail. Same pattern would affect any future tool that accepts an opaque UUID arg.
**Acceptance:** AJV format check `format:"uuid"` (or a `pattern:` regex) added to `appointmentId`, `customerId`, `carId`, `invoiceId`, etc. The pre-approval validator rejects with a structured error before persisting the approval row.

### I-013 — Strip residual tool-call JSON from the final text emission
**Why:** B-11 final assistant text was raw `dispatch_agent` JSON instead of prose — the orchestrator's compose-only prompt did not catch the leak (the leak-detector layer is wired but didn't fire on this code path). Confusing for the user; looks broken.
**Acceptance:** wrap the compose-only LLM call's `validateResult` callback to detect any tool-call shape in the final text (`{"name":"dispatch_agent",...}`, `<function=…>` tags, etc.) and force a re-compose. Add a regression test using the B-11 prompt as fixture.

### I-014 — Surface infrastructure-level send failures to the user
**Why:** B-18 — the assistant called `send_email` to email overdue invoices to the user. Resend rejected the send (sandbox-recipient mismatch — owner@autotech.tn isn't the verified sender address; only `ala.khliifa@gmail.com` is per memory). The tool result included `error: send_failed` but the assistant text was just "There are 19 overdue invoices." with no mention of the failed send. The user thinks the email went out.
**Acceptance:** when an `AUTO_WRITE` tool returns a structured error, the orchestrator's compose-only prompt MUST mention the failure. Or: render an explicit warning chip in the UI when a tool result has `error:` AND an `error_chip` SSE event.

### I-015 — System-prompt nudge: prefer single tools over agent dispatch for atomic facts
**Why:** B-10 ("Inventory total value") routed through `inventory-agent` (which then called `get_inventory_value`) instead of calling `get_inventory_value` directly. The agent dispatch ran 1× and produced the right answer but burned ~3× the tokens of a direct tool call. Likely affects other one-shot KPI questions.
**Acceptance:** add to the system prompt a rule: "For atomic single-fact questions ('how many X', 'total Y', 'list latest Z'), prefer a direct tool call over `dispatch_agent`. Reserve agents for multi-step analyses that need their own scratchpad."

### I-016 — `find_*` retry loops on empty returns
**Why:** B-06 ("find car with plate 9109 TUN 804") fired `find_car` **8 times** before turn_timeout. The plate parsing likely strips the 'TUN' country segment differently each retry but never converges on a hit. B-05 ("find customer with phone …") retried 3× before getting it right. Both burn iteration budget for no value.
**Acceptance:** classify the empty-result path: if the same `find_*` tool returns 0 rows twice in a turn with the same query, force the LLM into compose-only mode with "no results — tell the user". Adds a hard cap on `find_*` retries per turn.

### I-017 — Skip-on-`__resume__` for already-DENIED tool calls
**Why:** Already partially fixed by `e34b898` (B-19/UI Bug 3 fix), but worth pinning a documentation expectation: any future write-tier tool added must inherit the post-DENIED short-circuit semantics. A migration test in the cross-references suite (I-006) could enforce this contractually.
**Acceptance:** docs section in `ASSISTANT.md` covering the approval state machine + DENIED short-circuit, plus a note in the "How to add a new tool" recipe about `_expectedConfirmation` and DENIED handling.
