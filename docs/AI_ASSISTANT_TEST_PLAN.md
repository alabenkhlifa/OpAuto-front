# AI Assistant — Test Plan & Live Tracker

**Started:** 2026-05-03
**Owner:** autonomous test sweep (Claude + subagents)
**Purpose:** Inventory every tool/skill/agent the AI assistant exposes, define behavior tests for realistic conversations, run them end-to-end, track results live, and capture bugs + future improvements.

> This file is the **single source of truth** for the sweep. Every section gets updated as work progresses. Status legend: `⬜ pending` · `🟡 in progress` · `✅ pass` · `❌ fail` · `⚠️ flaky / partial` · `⏭️ skipped (blocker)`

---

## 0. Sweep status (high-level)

| Phase | Status | Notes |
|---|---|---|
| 1. Tool validation (READ tier, 23 tools) | ✅ | `validate-tools.ts` — 24/24 PASS (2 silent Gemini-429 fallbacks logged) |
| 2. Tool validation (WRITE tier, 4 tools) | ✅ | `validate-write-tools.ts` — 9/11 PASS, 2 real bugs (FIXED, see §6) |
| 3. Skill loading | ⬜ | 10 skills × `load_skill` round-trip — pending behavior suite |
| 4. Agent dispatch | ⬜ | 6 specialist agents × representative turn — pending behavior suite |
| 5. Behavior scenarios (E2E API) | 🟡 | 32 scenarios in flight (background agent) |
| 6. UI E2E (Chrome DevTools MCP) | ⬜ | Floating panel, SSE, approval card, conversation list |
| 7. Bug fixes (commit+push per fix) | ✅ | 2/2 fixed and pushed (§6) |
| 8. Improvements doc | ⬜ | `docs/AI_ASSISTANT_IMPROVEMENTS.md` |

---

## 1. Tool inventory (28 tools)

Source: `opauto-backend/src/assistant/tools/**/*.tool.ts` + `tool-registry.service.ts`.

### 1.1 READ tier — `validate-tools.ts` 24/24 PASS

| Tool | Domain | Validation | Truth check |
|---|---|---|---|
| `get_customer_count` | analytics | ✅ | total=53, new(30d)=5 |
| `get_revenue_summary` | analytics | ✅ | today/week/month/ytd reconcile to PAID-invoice SUM |
| `get_invoices_summary` | analytics | ✅ | 446 invoices · paid 42 710.71 · outstanding 35 679.29 |
| `get_dashboard_kpis` | analytics | ✅ | no negatives in any KPI |
| `list_active_jobs` | analytics | ✅ | count=4 |
| `find_customer` | customers | ✅ | "Perf" → 1 hit incl. target |
| `get_customer` | customers | ✅ | totalSpent reconciles to PAID invoices |
| `list_top_customers` (revenue) | customers | ✅ | top=Asma Ben Ali |
| `list_top_customers` (visit_count) | customers | ✅ | top=Aymen Mansouri (16 visits) |
| `list_at_risk_customers` | customers | ⚠️ | passed; Gemini 429 → silent deterministic fallback |
| `list_returning_customers` | customers | ⬜ | not in validate-tools.ts — covered by behavior suite |
| `find_car` | cars | ✅ | matched PERF-BENCH plate |
| `get_car` | cars | ✅ | Skoda Fabia (8071 TUN 735) |
| `list_maintenance_due` | cars | ⚠️ | passed; Gemini 429 → silent deterministic fallback |
| `list_appointments` | appointments | ✅ | count=0 today |
| `find_available_slot` | appointments | ✅ | 3 slots tomorrow |
| `list_invoices` (PAID) | invoicing | ✅ | count=200 |
| `get_invoice` | invoicing | ✅ | INV-2026-0207 total=143.8 lines=2 |
| `list_overdue_invoices` | invoicing | ✅ | count=39 |
| `list_low_stock_parts` | inventory | ✅ | 1 (Clutch Kit – Small Engine) |
| `get_inventory_value` | inventory | ✅ | 56 251.00 TND across 1 910 units |
| `propose_retention_action` | comms | ⬜ | covered by behavior suite |
| `generate_invoices_pdf` | reports | ⬜ | covered by behavior suite |
| `generate_period_report` | reports | ⬜ | covered by behavior suite |

### 1.2 WRITE tier — `validate-write-tools.ts` 9/11 PASS (2 real bugs found, both FIXED)

| Tool | Tier | Happy | Negative |
|---|---|---|---|
| `send_email` | AUTO_WRITE | ✅ | ✅ (covered by `validate-send-email.ts` — 6/6) |
| `send_sms` | CONFIRM_WRITE | ✅ | ❌→✅ Bug 3 (handler accepted empty `to`) — FIXED `a40fbfd` |
| `create_appointment` | CONFIRM_WRITE | ✅ | ✅ |
| `cancel_appointment` | CONFIRM_WRITE | ✅ | ✅ (foreign-garage rejected) |
| `record_payment` | TYPED_CONFIRM_WRITE | ✅ | ❌→✅ Bug 1 (PAID double-charge) — FIXED `6fb21c2` |
| ~`create_invoice`~ | — | n/a | Bug 2: tool not registered. Fiscal numbering tested via `InvoicingService.create + issue` invariants (gapless, per-line TVA, fiscal stamp) — see Improvements doc. |

### 1.3 Pseudo-tools

| Tool | Purpose | Status |
|---|---|---|
| `load_skill` | Inject markdown playbook as system msg | ⬜ |
| `dispatch_agent` | Hand turn to specialist agent | ⬜ |

---

## 2. Skills (10 markdown playbooks)

Source: `opauto-backend/src/assistant/skills/<name>/en.md`. Each skill is loaded via `load_skill` and verified by checking that the LLM follows its prescribed steps. Cross-reference validation: **all declared tools in every skill exist in the registry — no broken references.**

| Skill | Description | Triggers (sample) | Declared tools | Behavior |
|---|---|---|---|---|
| `customer-360` | Deep-dive on a single customer (profile, vehicles, visits, invoice status, churn risk, recs). | customer details, customer history, deep dive, profile, churn | find_customer, get_customer, list_invoices, list_overdue_invoices, list_at_risk_customers, find_car, list_appointments | ⬜ B-12 |
| `daily-briefing` | Morning summary: revenue, customers, active jobs, overdue, at-risk. | morning, daily, briefing, summary, snapshot | get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_overdue_invoices, list_at_risk_customers, list_low_stock_parts | ⬜ |
| `email-composition` | Drafts locale-appropriate subject + body without making tool calls. | email, send, draft, write, message | (none) | ⬜ |
| `example` | No-op skill used to test the loader. | test | (none) | ⬜ |
| `growth-advisor` | Examines historical data and proposes 3 prioritised growth recs. | growth, suggestions, ideas, improve, expand, marketing | get_revenue_summary, get_customer_count, list_top_customers, list_at_risk_customers, get_invoices_summary, list_appointments, get_dashboard_kpis | ⬜ |
| `inventory-restocking` | Identifies low-stock items, suggests order qty, groups by supplier. | restock, reorder, low stock, running out, supplier | list_low_stock_parts, get_inventory_value | ⬜ |
| `invoice-collections` | Pulls overdue invoices, ranks by age × amount, drafts SMS reminders. | overdue, collect, chase, owes, outstanding, late payment, reminder | list_overdue_invoices, list_invoices, get_invoice, find_customer, get_customer, send_email, send_sms, propose_retention_action | ⬜ |
| `maintenance-due-followup` | Identifies cars with maintenance due and drafts SMS reminders. | maintenance due, service reminder, due for service, overdue service | list_maintenance_due, find_customer, get_customer, find_car, send_sms, propose_retention_action | ⬜ |
| `monthly-financial-report` | P&L-style monthly summary with prior-month comparison. | monthly report, month end, last month, this month, financial summary | get_revenue_summary, get_invoices_summary, list_invoices, list_top_customers, list_overdue_invoices | ⬜ B-21 |
| `retention-suggestions` | Scores churn factors and recommends outreach (SMS/discount/call) with copy. | retention, win-back, retain, at-risk, churn, bring-back | get_customer, list_at_risk_customers, propose_retention_action | ⬜ B-20 |

---

## 3. Agents (6 specialists)

Source: `opauto-backend/src/assistant/agents/`. Cross-reference validation: **all declared tools in every agent whitelist exist in the registry — no broken references.**

| Agent | Role | Iter cap | Tool whitelist (count) | Behavior |
|---|---|---|---|---|
| `analytics-agent` | OWNER | 8 | 14 read-only tools — get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_invoices, get_invoice, list_overdue_invoices, list_low_stock_parts, get_inventory_value, find_customer, get_customer, list_top_customers, list_at_risk_customers | ⬜ |
| `communications-agent` | OWNER | 5 | 4 — find_customer, get_customer, list_at_risk_customers, propose_retention_action | ⬜ |
| `finance-agent` | OWNER | 8 | 9 — get_revenue_summary, get_invoices_summary, list_invoices, get_invoice, list_overdue_invoices, find_customer, get_customer, list_top_customers, **record_payment** (only write tool any agent has) | ⬜ B-24 |
| `growth-agent` | OWNER | 10 | 13 — get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_top_customers, list_at_risk_customers, list_invoices, list_overdue_invoices, find_customer, get_customer, list_maintenance_due, propose_retention_action | ⬜ B-22 |
| `inventory-agent` | OWNER | 6 | 5 — list_low_stock_parts, get_inventory_value, list_active_jobs, list_invoices, get_invoice | ⬜ B-23 |
| `scheduling-agent` | OWNER | 6 | 9 — list_appointments, find_available_slot, find_customer, get_customer, find_car, get_car, list_active_jobs, **create_appointment**, **cancel_appointment** | ⬜ |

---

## 4. Behavior test scenarios

Each scenario is a realistic user turn (or short multi-turn). Format:

```
ID: B-NN
User: "<prompt>"
Expected tools (in order): [tool_a, tool_b]
Expected outcome: <one-line>
Status: ⬜
Actual: (filled by runner)
```

### 4.1 Quick-fact READ scenarios (no tool chain)

- **B-01** — "How many customers do I have?" → `get_customer_count` → integer answer. **Status: ✅** — Actual tools: [get_customer_count]; final: "You have a total of 53 customers."
- **B-02** — "What's my revenue this month?" → `get_revenue_summary{period: this-month}` → currency figure.
- **B-03** — "List my overdue invoices." → `list_overdue_invoices` → bulleted list.
- **B-04** — "Show me low-stock parts." → `list_low_stock_parts` → list with reorder hints.
- **B-05** — "Find customer with phone +216 50 123 456." → `find_customer{query}` → match or "not found".
- **B-06** — "Find car with plate 123 TUN 4567." → `find_car{plate}` → match or "not found".
- **B-07** — "What jobs are open right now?" → `list_active_jobs` → table.
- **B-08** — "Today's KPIs." → `get_dashboard_kpis{period: today}` → revenue, jobs, churn.
- **B-09** — "Top 5 customers by spend this year." → `list_top_customers{limit:5, period: this-year}`.
- **B-10** — "Inventory total value." → `get_inventory_value` → currency.

### 4.2 Multi-step READ scenarios (chained tools)

- **B-11** — "Which customer hasn't visited in 6 months and has a car overdue for service?" → `list_at_risk_customers` + `list_maintenance_due` → intersection answer.
- **B-12** — "Generate a customer health snapshot for John Smith." → `find_customer` → `get_customer` → `list_appointments{customerId}` → composed summary.
- **B-13** — "Compare this quarter's revenue to last quarter." → `get_revenue_summary` × 2 → delta + percentage.

### 4.3 WRITE scenarios (approval-gated)

- **B-14** — "Book Tuesday 10am for car id 42 with mechanic Ali." → `find_available_slot` → `create_appointment` → **CONFIRM card surfaces**, no DB write yet → user approves → row inserted.
- **B-15** — "Cancel appointment 99." → `cancel_appointment` → CONFIRM → DENY → no DB change → assistant acknowledges skip.
- **B-16** — "Mark invoice INV-2025-000123 paid (cash)." → `get_invoice` → `record_payment` → CONFIRM → APPROVE → invoice status flips.
- **B-17** — "Create an invoice for car 42, oil change 45 TND + filter 12 TND." → `create_invoice` → **TYPED_CONFIRM** (must type the total) → APPROVE → fiscal number assigned, immutable.
- **B-18** — "Email me a CSV of overdue invoices." → `list_overdue_invoices` → `send_email{to: self}` → AUTO_WRITE, no approval → email queued.
- **B-19** — "Text customer 17 about their pickup." → `get_customer` → `send_sms` → CONFIRM → APPROVE → SMS provider call.

### 4.4 Skill-driven scenarios

- **B-20** — Long churn analysis: "Why are we losing customers?" → LLM emits `load_skill{name: churn-investigation}` → playbook injected → follow-up tool calls per playbook → synthesis.
- **B-21** — Month-end close: "Walk me through closing April." → `load_skill{name: month-end-close}` → multi-step report dispatch.

### 4.5 Agent-dispatch scenarios

- **B-22** — "Run a full retention review." → `dispatch_agent{name: growth}` → agent loop → final retention plan.
- **B-23** — "Audit my inventory." → `dispatch_agent{name: inventory}` → agent loop → reorder list.
- **B-24** — "Cash-flow forecast." → `dispatch_agent{name: finance}` → agent loop → forecast table.

### 4.6 Edge cases / failure modes

- **B-25** — Empty result: "Top customers in 1990." → `list_top_customers{period: 1990}` returns `[]` → assistant must say "0/empty" exactly, no fabrication.
- **B-26** — Cross-tenant guard: User of garage A asks for invoice id from garage B → tool must reject with "not found" (garageId scoping).
- **B-27** — Validation failure: "Cancel appointment 'banana'." → arg validation throws → assistant surfaces friendly error, doesn't crash.
- **B-28** — Token-budget hit: very long conversation → 200k token budget tripped → SSE `budget_exceeded` event, UI shows banner.
- **B-29** — Provider fallthrough: kill Gemini key → request still completes via Mistral/Cerebras/Claude.
- **B-30** — Approval expiry: open CONFIRM card, wait > expiry → decision endpoint returns 410, UI clears card.
- **B-31** — Approval resume: APPROVE a CONFIRM_WRITE → orchestrator resumes via `__resume__:<toolCallId>` → tool executes, no double-prompt.
- **B-32** — Stale-year date math: "Revenue last quarter" — must anchor to TODAY (2026-05-03), not training cutoff.

---

## 5. Test execution log

Every run appends a row here.

| Date/Time | Phase | Test ID | Result | Evidence (file/line/log/screenshot) | Notes |
|---|---|---|---|---|---|
| 2026-05-03 | setup | — | — | this doc | initial inventory |
| 2026-05-03 | §4 | B-01 | ✅ | /tmp/ai-test/results/B-01.* | tools=[get_customer_count], 53 customers |

---

## 6. Bugs found

| ID | Severity | Component | Summary | Status | Fix commit |
|---|---|---|---|---|---|
| **Bug 1** | High (fiscal) | `record-payment.tool.ts` | Handler delegated to `InvoicingService.addPayment` which permits over-payment for direct-API users; on a transient retry of a typed-confirm flow, an already-PAID invoice could silently get a second `Payment` row inserted. | ✅ Fixed | `6fb21c2` — guard at the assistant tool boundary; service stays lenient for human over-pay UX. |
| **Bug 2** | Low (inventory mismatch, not code) | architecture doc | Initial Explore inventory listed `create_invoice` as a TYPED_CONFIRM_WRITE tool; it does not exist in the registry. The TYPED_CONFIRM_WRITE infrastructure exists but is currently used **only** by `record_payment`. | ✅ Tracking doc corrected | n/a (will live as an Improvement: register a `create_invoice` tool, see `AI_ASSISTANT_IMPROVEMENTS.md`) |
| **Bug 3** | Medium (defence-in-depth) | `send-sms.tool.ts` | Handler relied entirely on the JSON Schema in tool-registry to reject empty/garbage `to`. Direct handler invocations (validation scripts, future agent runners that bypass the registry) could reach Twilio with `to=''`. | ✅ Fixed | `a40fbfd` — re-validate `to` against E.164-shaped regex and reject blank bodies inside the handler. Returns structured `invalid_recipient` / `invalid_body` errors. |

---

## 7. Improvement suggestions (preview — full list in `AI_ASSISTANT_IMPROVEMENTS.md`)

Populated at the end of the sweep.

---

## 8. Methodology

1. **Validation scripts first** — run `validate-tools.ts` and `validate-send-email.ts`. They invoke handlers directly and compare against Prisma `SELECT` truth. Cheap, catches handler-level regressions.
2. **API-level behavior** — for each scenario in §4, POST to `/api/assistant/chat` and assert tool order + final text shape. Bypasses UI but exercises full LLM + orchestrator.
3. **UI E2E** — Chrome DevTools MCP. Open the floating launcher, type the prompt, watch SSE events, click approval card, verify conversation list updates and persists across reload.
4. **Failure injection** — env-flag a provider down (Gemini → bad key) and rerun a small subset to verify fallthrough.
5. **Each fix is its own commit** — `fix(assistant): <one-line>`. Push after each commit.

---

## 9. Files touched

| Path | Why |
|---|---|
| `docs/AI_ASSISTANT_TEST_PLAN.md` | this tracker |
| `docs/AI_ASSISTANT_IMPROVEMENTS.md` | future-work doc (created at end) |
| `opauto-backend/scripts/validate-write-tools.ts` | new write-tier validator |
| `opauto-backend/scripts/validate-skills.ts` | new skill loader validator |
| `opauto-backend/scripts/validate-agents.ts` | new agent dispatch validator |
| `opauto-backend/scripts/behavior-suite.ts` | runs §4 scenarios via API |
