# AI Assistant — Test Plan & Live Tracker

**Started:** 2026-05-03
**Owner:** autonomous test sweep (Claude + subagents)
**Purpose:** Inventory every tool/skill/agent the AI assistant exposes, define behavior tests for realistic conversations, run them end-to-end, track results live, and capture bugs + future improvements.

> This file is the **single source of truth** for the sweep. Every section gets updated as work progresses. Status legend: `⬜ pending` · `🟡 in progress` · `✅ pass` · `❌ fail` · `⚠️ flaky / partial` · `⏭️ skipped (blocker)`

---

## 0. Sweep status (high-level)

| Phase | Status | Notes |
|---|---|---|
| 1. Tool validation (READ tier, 23 tools) | ⬜ | Drives `validate-tools.ts` |
| 2. Tool validation (WRITE tier, 5 tools) | ⬜ | New script needed |
| 3. Skill loading | ⬜ | 10 skills × `load_skill` round-trip |
| 4. Agent dispatch | ⬜ | 6 specialist agents × representative turn |
| 5. Behavior scenarios (E2E API) | ⬜ | 20+ conversations via `POST /api/assistant/chat` |
| 6. UI E2E (Chrome DevTools MCP) | ⬜ | Floating panel, SSE, approval card, conversation list |
| 7. Bug fixes (commit+push per fix) | ⬜ | Tracked in §7 |
| 8. Improvements doc | ⬜ | `docs/AI_ASSISTANT_IMPROVEMENTS.md` |

---

## 1. Tool inventory (28 tools)

Source: `opauto-backend/src/assistant/tools/**/*.tool.ts` + `tool-registry.service.ts`.

### 1.1 READ tier (23 tools — no approval)

| Tool | Domain | Purpose | Status |
|---|---|---|---|
| `get_customer_count` | analytics | Count active customers | ⬜ |
| `get_revenue_summary` | analytics | Revenue over period | ⬜ |
| `get_invoices_summary` | analytics | Invoice totals + status breakdown | ⬜ |
| `get_dashboard_kpis` | analytics | Headline KPIs (revenue, jobs, churn) | ⬜ |
| `list_active_jobs` | analytics | Open work orders | ⬜ |
| `find_customer` | customers | Free-text customer search | ⬜ |
| `get_customer` | customers | Customer detail by id | ⬜ |
| `list_top_customers` | customers | Highest-value customers | ⬜ |
| `list_at_risk_customers` | customers | Churn-risk list | ⬜ |
| `find_car` | cars | Plate/VIN search | ⬜ |
| `get_car` | cars | Car detail by id | ⬜ |
| `list_maintenance_due` | cars | Cars with overdue service | ⬜ |
| `list_appointments` | appointments | Upcoming/past appointments | ⬜ |
| `find_available_slot` | appointments | Bay/mechanic free slots | ⬜ |
| `list_invoices` | invoicing | Invoices by status/period | ⬜ |
| `get_invoice` | invoicing | Invoice detail | ⬜ |
| `list_overdue_invoices` | invoicing | Past-due invoices | ⬜ |
| `list_low_stock_parts` | inventory | Below reorder point | ⬜ |
| `get_inventory_value` | inventory | Total stock valuation | ⬜ |
| `propose_retention_action` | comms | Recommend retention move | ⬜ |
| `report_*` (4 reporting tools) | reports | Pre-canned monthly reports | ⬜ |

### 1.2 WRITE tier (5 tools — gated)

| Tool | Domain | Tier | Status |
|---|---|---|---|
| `send_email` | comms | AUTO_WRITE (self only) | ⬜ |
| `send_sms` | comms | CONFIRM_WRITE | ⬜ |
| `create_appointment` | appointments | CONFIRM_WRITE | ⬜ |
| `cancel_appointment` | appointments | CONFIRM_WRITE | ⬜ |
| `record_payment` | invoicing | CONFIRM_WRITE | ⬜ |
| `create_invoice` | invoicing | TYPED_CONFIRM_WRITE | ⬜ |

### 1.3 Pseudo-tools

| Tool | Purpose | Status |
|---|---|---|
| `load_skill` | Inject markdown playbook as system msg | ⬜ |
| `dispatch_agent` | Hand turn to specialist agent | ⬜ |

---

## 2. Skills (10 markdown playbooks)

Source: `opauto-backend/src/assistant/skills/<name>/en.md`. Each skill is loaded via `load_skill` and verified by checking that the LLM follows its prescribed steps.

| Skill | Trigger phrases (sample) | Status |
|---|---|---|
| (to be enumerated by agent) | | ⬜ |

---

## 3. Agents (6 specialists)

Source: `opauto-backend/src/assistant/agents/`.

| Agent | Tool whitelist | Required role | Status |
|---|---|---|---|
| analytics | (to fill) | OWNER | ⬜ |
| communications | (to fill) | OWNER | ⬜ |
| growth | (to fill) | OWNER | ⬜ |
| inventory | (to fill) | OWNER | ⬜ |
| scheduling | (to fill) | OWNER | ⬜ |
| finance | (to fill) | OWNER | ⬜ |

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

- **B-01** — "How many customers do I have?" → `get_customer_count` → integer answer.
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

---

## 6. Bugs found

| ID | Severity | Component | Summary | Status | Fix commit |
|---|---|---|---|---|---|
| (none yet) | | | | | |

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
