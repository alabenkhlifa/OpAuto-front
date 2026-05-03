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

(Filled in after the in-flight background agents complete. See §10 of `AI_ASSISTANT_TEST_PLAN.md`.)
