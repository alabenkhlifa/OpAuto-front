# OpAuto AI Orchestrator — Design & Implementation Plan

> **First implementation step:** copy this document to `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md` and commit, so the spec is preserved in the repo for future sessions.

---

## 1. Context

OpAuto is a multi-tenant garage ERP (Angular + NestJS + Prisma/PostgreSQL). It already has three first-generation AI features built behind a multi-provider LLM router (`opauto-backend/src/ai/ai.service.ts`): general chat/diagnostics, churn prediction with executable SMS actions, and predictive maintenance. Each is a hand-coded one-shot prompt — there is no chat UI, no tool-calling loop, no cross-feature reasoning.

The garage owner currently has to navigate to the right page to answer questions like *"how many new customers did I get today?"*, *"how much did I make this week?"*, *"who hasn't visited in 90 days?"*, *"email me today's invoices"*, *"suggest ways to grow my customer base"*. Each requires multiple clicks and mental aggregation across modules.

**Goal:** a conversational, voice-capable AI assistant — the *Orchestrator* — that the owner can ask anything in natural language (en/fr/ar), and that can answer (read tools), act (write tools, approval-gated), and reason (skills + sub-agents) by composing the existing OpAuto APIs as LLM-callable tools. Architecturally similar to Claude Code: an LLM with a tool registry, sub-agents, and reusable skill playbooks.

**Outcome:** owners spend minutes/day instead of hours/day pulling data and operating routine outreach. Staff get a faster path to common operations. The AI surface becomes extensible — new tools, skills, and agents can be added without touching the orchestrator core.

---

## 2. Decisions (locked in brainstorming)

| Question | Decision |
|---|---|
| First slice scope | **Full vision**: text + voice + read+write tools + email channel + proactive suggestions, shipped in phases (see §14). |
| LLM provider | **Groq-first** (`llama-3.3-70b-versatile`), **Claude fallback** (`claude-sonnet-4`). Reuses existing `ai.service.ts` provider chain, with the order changed to Groq-first for chat latency. |
| Voice | **Web Speech API** (browser-native). `SpeechRecognition` for input, `SpeechSynthesis` for output. en/fr/ar locales. Zero new backend code. |
| Chat UI placement | **Floating widget** present on every authenticated route. Drawer/panel that opens from a button bottom-right of the dashboard shell. |
| Email channel | **Resend** (transactional API, free tier 3000/mo). New env vars: `RESEND_API_KEY`, `RESEND_FROM`. |
| Action approval | **Tiered by blast radius**. Auto-execute reads & self-facing writes. Inline-confirm customer/third-party writes. Typed-confirm destructive/irreversible writes. Reuses the existing `ai-actions` approval pattern where it fits. |
| Conversation memory | **Persistent per-user-per-garage**. New tables `AssistantConversation` + `AssistantMessage`. Sliding window of last ~20 turns sent to the LLM each call. User can view history and clear it. |
| Multilingual | Assistant responds in the user's currently selected i18n language. Skill bodies localized en/fr/ar. Tool descriptions in English (LLM-facing only); user-facing strings flow through `TranslationService`. |

---

## 3. Conceptual Model

Four layers. Each has one purpose, communicates through a typed contract, can be tested in isolation.

### 3.1 Orchestrator
The main LLM loop the user talks to. One per active conversation turn. Receives the user message + sliding-window history + system prompt + a list of available tool/skill/agent descriptors. Decides per turn to:
- **Reply** (emit text and end the turn),
- **Call a tool** (atomic operation, get a JSON result, loop),
- **Load a skill** (prepend the skill body to its own system prompt for the next iteration),
- **Dispatch an agent** (hand off a sub-task to a specialized LLM context, get a single string result, loop).

Hard-cap of N iterations per turn (default 8) to bound cost and prevent runaway loops. Streams partial text to the frontend via SSE. Provider-agnostic — implementation calls a thin `LlmGateway` abstraction so swapping models is one config change.

### 3.2 Tools
Atomic, typed, single-purpose, idempotent (where possible) functions. Each tool declares:
- `name` (snake_case, stable, LLM-facing identifier),
- `description` (English, LLM-facing — this is what the model reads to decide whether to call it),
- `parameters` (JSON Schema, validated server-side),
- `requiredModule` (optional — gates tool by feature flag, hides it if garage hasn't enabled the module),
- `requiredRole` (optional — `owner` or `staff`),
- `blastTier` (`read` | `auto-write` | `confirm-write` | `typed-confirm-write`),
- `handler` (the NestJS implementation — receives parsed args + `CurrentUser` context, returns JSON-serialisable result).

Tool handlers always inject `garageId` and `userId` from `CurrentUser`; LLMs cannot pass these as arguments.

### 3.3 Skills
Reusable markdown playbooks. Each skill is a file in `opauto-backend/src/assistant/skills/<skill-name>/{en,fr,ar}.md` with frontmatter: `name`, `description` (when to use it), `triggers` (optional intent hints), `tools` (optional whitelist — when this skill is loaded, the orchestrator may only call these tools, narrowing focus). The orchestrator sees a list of skill descriptors. When it decides a skill applies (or the user invokes one explicitly), the skill body is prepended to the system prompt for the remainder of the turn. Mirrors the Claude Code Skill mechanism. Skills are content, not code — adding a skill is editing files, not deploying logic.

### 3.4 Agents
Specialized sub-LLM contexts. An agent has its own system prompt, its own restricted tool subset, its own conversation, and runs to completion (own iteration cap, default 6). Returns a single string to the orchestrator, which incorporates it into the main conversation. Agents prevent the main conversation from getting polluted with dozens of intermediate tool calls during deep tasks (e.g., "compute customer growth segmented by service type over the last 6 months and rank them"). Agent registry mirrors tool registry: name, description, system prompt path, tool whitelist, role/module gating.

### 3.5 Why this layering
- **Adding a tool** = NestJS handler + schema. No orchestrator change.
- **Adding a skill** = drop a markdown file. No code change.
- **Adding an agent** = system prompt + tool whitelist. No orchestrator change.
- **Changing the LLM provider** = config. No tool/skill/agent change.
- **Removing a feature** = remove the tool/skill/agent registration; nothing references it from elsewhere.

---

## 4. End-to-End Request Flow

1. User opens the floating widget on any route. Frontend establishes an SSE connection to `POST /api/assistant/chat` carrying `{conversationId, userMessage, locale, pageContext}`.
2. Backend `AssistantController.chat()` validates JWT, extracts `garageId` + `userId`, loads the conversation (or creates one), appends the user message, fetches the sliding-window history (last 20 turns).
3. `OrchestratorService.run()` builds the system prompt: base instructions (in user locale) + skill list + tool list (filtered by garage's enabled modules and user role) + agent list + page context block + history.
4. `LlmGateway.complete()` sends the request to Groq (with tool-calling enabled). On Groq failure (timeout, 5xx, schema parse error), retries on Claude. Streams tokens back as they arrive.
5. If the LLM emits a `tool_call`, the orchestrator:
   a. Looks up the tool in the registry. If unknown → emit a "tool not found" tool result, loop.
   b. Validates args against the tool's JSON schema.
   c. Checks blast tier. If `read` or `auto-write`: execute. If `confirm-write`: emit an `approval_request` SSE event (the frontend renders an approval card; tool execution is deferred until the user clicks Approve, at which point the frontend POSTs the approval and the conversation resumes from the saved state). If `typed-confirm-write`: same flow but the approval card requires the user to type the affected entity name.
   d. Persists a `AssistantToolCall` row (status: `pending` | `approved` | `executed` | `denied` | `failed`).
   e. Calls the handler, gets the result, appends as a tool message in the LLM conversation, loops.
6. If the LLM emits `load_skill`: the skill body is loaded, prepended to the system prompt, the orchestrator loops.
7. If the LLM emits `dispatch_agent`: spawn a child orchestrator-like loop with the agent's restricted toolset and system prompt. Block until the agent returns a string. Append as a tool result. Loop.
8. If the LLM emits a plain assistant message: stream it to the client, persist it, end the turn.
9. Frontend renders incremental tokens, approval cards, and tool execution receipts inline in the chat panel.

---

## 5. Backend Architecture

### 5.1 New module: `opauto-backend/src/assistant/`
```
assistant/
├── assistant.module.ts
├── assistant.controller.ts          ← REST + SSE endpoints
├── orchestrator.service.ts          ← Core LLM loop (turn-level)
├── agent-runner.service.ts          ← Sub-agent loop
├── llm-gateway.service.ts           ← Provider abstraction (wraps existing AiService)
├── tool-registry.service.ts         ← In-memory registry, populated at module init
├── skill-registry.service.ts        ← Loads markdown skills from disk + locale
├── approval.service.ts              ← Tracks pending approvals, resumes flows
├── conversation.service.ts          ← Read/write AssistantConversation + AssistantMessage
├── audit.service.ts                 ← Append-only AssistantToolCall log
├── dto/
│   ├── chat-request.dto.ts
│   ├── approval-decision.dto.ts
│   └── conversation.dto.ts
├── tools/                           ← One file per tool, exports a ToolDefinition
│   ├── analytics/
│   ├── customers/
│   ├── cars/
│   ├── appointments/
│   ├── invoicing/
│   ├── inventory/
│   ├── communications/
│   └── reports/
├── agents/                          ← One folder per agent
│   ├── analytics-agent/
│   ├── communications-agent/
│   └── growth-agent/
└── skills/                          ← Markdown playbooks per locale
    ├── daily-briefing/{en,fr,ar}.md
    ├── growth-advisor/{en,fr,ar}.md
    ├── email-composition/{en,fr,ar}.md
    └── retention-suggestions/{en,fr,ar}.md
```

### 5.2 Endpoints
- `POST /api/assistant/chat` (SSE) — main conversation turn. Streams `text`, `tool_call`, `tool_result`, `approval_request`, `agent_dispatch`, `agent_result`, `done` events.
- `POST /api/assistant/approvals/:id/decide` — approve or deny a pending tool call. Body: `{decision: 'approve' | 'deny', typedConfirmation?: string}`. Resumes the deferred orchestrator turn.
- `GET /api/assistant/conversations` — list user's conversations (id, title, updatedAt).
- `GET /api/assistant/conversations/:id` — full message history.
- `DELETE /api/assistant/conversations/:id` — soft delete.
- `POST /api/assistant/conversations/:id/clear` — clear messages but keep the conversation shell.
- `GET /api/assistant/registry` — list available tools, skills, agents (filtered by user's permissions). Used by the frontend for "what can the assistant do?" panel.

### 5.3 Provider chain
`LlmGatewayService` wraps the existing `AiService` but exposes a tool-calling-aware `complete(messages, tools, options)` method. Order: **Groq → Claude**. Both use OpenAI-compatible function-calling format (Claude's tool-use API is mapped server-side). On Groq tool-call schema-parse failure (Llama models occasionally emit malformed JSON), the gateway retries on Claude before giving up. Existing one-shot AI features keep their current chain order.

### 5.4 Multi-tenancy & permissions
- `JwtAuthGuard` on all assistant routes.
- `OrchestratorService` injects `garageId` and `userId` into every tool handler call. Tools cannot accept these from the LLM.
- Tool registry filters by `requiredModule` (using existing `ModuleAccessGuard` semantics) and `requiredRole` per request before sending the tool list to the LLM. The LLM never sees tools the user can't use.
- Owner-only tools (revenue, employees, refunds) hidden from staff role.
- Page context (current route, selected entity id) is **passed** to the orchestrator but **never** trusted as authorization — every tool re-checks ownership against `garageId`.

### 5.5 Email channel
New `opauto-backend/src/email/` module mirroring `sms/`. `EmailService.send({to, subject, html, text})` calling Resend. `RESEND_API_KEY` and `RESEND_FROM` env vars. Two send modes:
- **Self-send** (recipient = authenticated user's own email): `auto-write` blast tier.
- **External send** (any other recipient): `confirm-write` blast tier.
The `sendEmail` tool determines tier dynamically by comparing recipient against `CurrentUser.email`.

### 5.6 SSE & streaming
NestJS native SSE support via `@Sse()` decorator. Server emits typed events; frontend uses a small typed `EventSource` wrapper (no socket.io needed). One SSE stream per turn; the connection closes when the orchestrator emits `done`. For deferred turns waiting on approval, the SSE is closed and a fresh SSE is opened by the frontend when the user decides — the orchestrator resumes from the persisted state.

---

## 6. Frontend Architecture

### 6.1 New feature module: `src/app/features/assistant/`
```
features/assistant/
├── assistant.module.ts (or standalone exports)
├── components/
│   ├── assistant-launcher/         ← Floating button bottom-right
│   ├── assistant-panel/            ← Drawer/panel container
│   ├── assistant-message-list/
│   ├── assistant-message/          ← Renders text, tool-call cards, approval cards, agent receipts
│   ├── assistant-input/            ← Text input + voice toggle + send
│   ├── assistant-voice-controls/   ← Mic button, listening state, TTS toggle
│   ├── assistant-approval-card/    ← Inline confirmation UI, including typed-confirm
│   └── assistant-conversation-list/ ← History sidebar inside the panel
└── services/
    ├── assistant-chat.service.ts    ← SSE connection, message stream
    ├── assistant-voice.service.ts   ← Web Speech API wrapper (en/fr/ar)
    ├── assistant-state.service.ts   ← Signals: isOpen, currentConversation, messages, pendingApproval
    └── assistant-context.service.ts ← Captures route + selected-entity context
```

### 6.2 Mounting
The `AssistantLauncherComponent` is added once to `src/app/app.html` (the root shell), positioned above the existing `<router-outlet>` content with a fixed bottom-right anchor. Visible on every authenticated route. Hidden on auth/login routes. RTL-aware (anchors bottom-left in Arabic).

### 6.3 Voice
`AssistantVoiceService` wraps `webkitSpeechRecognition` / `SpeechRecognition` with locale = current i18n language. Push-to-talk (hold mic button) and toggle modes. Final transcript is fed to the input box; user can edit before sending or auto-send (setting). TTS via `SpeechSynthesisUtterance` reads assistant replies, suppressed during typing. Graceful fallback to text-only on unsupported browsers (Firefox, older Safari).

### 6.4 Page context
`AssistantContextService` listens to `Router` events and exposes a small JSON: `{route, params, selectedEntity?: {type, id, displayName}}`. Sent with each chat request so the orchestrator knows what the user is looking at (e.g., when on `/customers/abc`, the assistant knows "this customer" = abc). Component pages set the selected entity via a service method when relevant. Cleared on navigation away.

### 6.5 Approval cards
Inline messages rendered when an `approval_request` event arrives. Three variants:
- **Auto-write receipt** (no approval needed) — informational only, shows the action that ran.
- **Inline confirm** — Approve / Deny buttons, expires after 5 min if untouched.
- **Typed confirm** — text input requiring the user to type the entity name (customer name, invoice number, etc.) before Approve activates.

### 6.6 Translations
All user-facing strings in the assistant UI use `TranslationService`. New keys under `assistant.*` in `assets/i18n/{en,fr,ar}.json`. RTL handled by the existing global RTL machinery.

---

## 7. Data Model (new Prisma tables)

```
AssistantConversation
  id              String   @id @default(cuid())
  garageId        String   (indexed)
  userId          String   (indexed)
  title           String?  (LLM-generated after first turn)
  pinned          Boolean  @default(false)
  archivedAt      DateTime?
  createdAt       DateTime
  updatedAt       DateTime

AssistantMessage
  id              String   @id @default(cuid())
  conversationId  String   (indexed, cascade delete)
  role            Enum     (user | assistant | tool | system)
  content         String   (Text)
  toolCallId      String?  (FK → AssistantToolCall, nullable)
  skillUsed       String?  (skill name, nullable)
  agentUsed       String?  (agent name, nullable)
  tokensIn        Int?
  tokensOut       Int?
  llmProvider     String?  (groq | claude | ...)
  createdAt       DateTime

AssistantToolCall
  id              String   @id @default(cuid())
  conversationId  String   (indexed)
  messageId       String   (indexed — assistant message that emitted this call)
  toolName        String
  argsJson        Json
  resultJson      Json?
  status          Enum     (pending_approval | approved | denied | executed | failed | expired)
  blastTier       Enum     (read | auto_write | confirm_write | typed_confirm_write)
  approvedByUserId String?
  approvedAt      DateTime?
  expiresAt       DateTime? (for pending_approval)
  errorMessage    String?
  durationMs      Int?
  createdAt       DateTime

AssistantApprovalRequest  (optional — could be folded into AssistantToolCall.status=pending_approval)
  Skipped to keep schema simple; the pending state lives on AssistantToolCall.
```

Migration: `npm run prisma:migrate` from `opauto-backend/`.

---

## 8. Tool Catalog (v1)

All tools garageId-scoped. All read tools `read` blast tier. Write tier annotated.

### Analytics (read)
- `get_dashboard_kpis` — wraps `ReportsService.getDashboardStats(garageId)`.
- `get_revenue_by_date_range({from, to})` — new method or reuse `getRevenueByMonth` + filter.
- `get_revenue_summary({period: 'today'|'week'|'month'|'ytd'})` — convenience wrapper.
- `get_customer_count({newSince?})` — count of customers, optionally created after a date.
- `get_active_jobs_count` / `list_active_jobs({limit?})`.
- `get_invoices_summary({status?, from?, to?})` — count, total, paid, outstanding.

### Customers (read)
- `find_customer({query})` — name/phone/email fuzzy match. Returns top 5.
- `get_customer({customerId})` — full record + last 5 visits.
- `list_at_risk_customers({limit?})` — wraps existing `AiService.predictChurn`.
- `list_top_customers({by: 'revenue'|'visit_count', limit?})`.

### Cars (read)
- `find_car({query})` — plate/VIN/make-model match.
- `get_car({carId})` — full record + service history.
- `list_maintenance_due({withinDays?})` — wraps existing `AiService.predictMaintenance`.

### Appointments
- `list_appointments({from?, to?, mechanicId?})` (read)
- `find_available_slot({date, durationMinutes, appointmentType?})` (read) — wraps `AiService.suggestSchedule`.
- `create_appointment({customerId, carId, scheduledAt, durationMinutes, notes?})` — `confirm-write`.
- `cancel_appointment({appointmentId, reason?})` — `confirm-write`.

### Invoicing
- `list_invoices({status?, from?, to?})` (read)
- `get_invoice({invoiceId})` (read)
- `list_overdue_invoices` (read)
- `record_payment({invoiceId, amount, method})` — `typed-confirm-write` (financial action).

### Inventory
- `list_low_stock_parts({threshold?})` (read)
- `get_inventory_value` (read)

### Communications
- `send_sms({to, body, customerId?})` — `confirm-write`. Wraps `SmsService.send`. `customerId` optional binding for audit.
- `send_email({to, subject, html|text, attachInvoiceIds?})` — tier resolved at runtime: `auto-write` if `to == CurrentUser.email`, else `confirm-write`. Optional attachment of invoice PDFs.

### Reports
- `generate_invoices_pdf({invoiceIds})` — returns short-lived signed URL. (read-tier — generates a derivative, no source data mutation.)
- `generate_period_report({period, format: 'pdf'|'csv'})` — returns signed URL.

### Churn / Retention (existing AI, exposed as tools)
- `get_at_risk_customers` (alias of `list_at_risk_customers`)
- `propose_retention_action({customerId})` — wraps `AiActionsService.draftForCustomer`. Drafts only; sending goes through existing approval flow (do NOT bypass it via `send_sms`).

---

## 9. Skill Catalog (v1)

Each is a markdown playbook with locale variants. Skills are LOAD-ON-DEMAND: included in the registry-list-to-LLM as `{name, description}`, fully loaded only when invoked.

- **`daily-briefing`** — How to compile a morning summary: revenue today + yesterday delta, new customers, active jobs, overdue invoices, top at-risk customers, low-stock parts. Tool whitelist: analytics + customers + invoicing + inventory reads. Output structure: 5-section bullet summary + 1 recommended action.
- **`growth-advisor`** — How to analyze customer trends and propose growth ideas. Tool whitelist: analytics, customers, churn. Output: 3 prioritized recommendations with reasoning + concrete next-step tools.
- **`email-composition`** — How to format an email body for invoice delivery, payment reminder, appointment confirmation. Locale-aware tone. No tools needed; outputs subject + body for `send_email`.
- **`retention-suggestions`** — How to score at-risk customers and suggest the right outreach (SMS reminder vs discount offer vs personal call). Tool whitelist: customers, churn, communications.

Skill format: YAML frontmatter (`name`, `description`, `triggers`, optional `tools`) + markdown body. Stored in `assistant/skills/<name>/{en,fr,ar}.md`, loaded by `SkillRegistryService` at module init and refreshed on file change in dev.

---

## 10. Agent Catalog (v1)

- **`AnalyticsAgent`** — Read-only deep-dives. System prompt: "you are an analytics analyst, multi-step querying allowed, summarize numerically." Tool whitelist: all read analytics + customers + invoicing + inventory tools. No write tools. Iteration cap: 8.
- **`CommunicationsAgent`** — Drafts and (with approval) sends SMS/emails. System prompt: "you draft customer-facing communications in the requested locale." Tool whitelist: customers (read), communications (write), email-composition skill. Iteration cap: 5.
- **`GrowthAgent`** — Long-form business analysis & recommendations. System prompt: "you are a growth strategist for a small auto-repair business." Tool whitelist: analytics, customers (incl. churn), invoicing read tools, retention skill. Iteration cap: 10. Output: structured recommendations with evidence.

Each agent runs in its own `AgentRunnerService.run()` invocation, isolated from main conversation history. The orchestrator passes the user's intent + relevant context as a single dispatch message; the agent returns a single string.

---

## 11. Tool-Calling Protocol

- Format: OpenAI-compatible (`tools: [{type: 'function', function: {name, description, parameters: <JSONSchema>}}]`). Groq supports natively. Claude's tool-use is mapped server-side in `LlmGatewayService`.
- Validation: every tool's `parameters` is a strict JSON Schema (Ajv). Args are validated server-side before handler runs. Schema violation → tool returns `{ error: 'invalid_arguments', detail }` and the orchestrator continues; the LLM typically self-corrects.
- Concurrency: v1 supports **one tool call per LLM step** (parallel tool calls deferred to v2 — adds complexity without much win for this domain).
- Iteration cap: orchestrator turn = 8 LLM steps max. Agent run = configurable per agent (default 6).
- Timeouts: each tool handler has a 15s timeout; LLM calls have 30s; total turn has 90s. Exceeded → emit a `timeout` SSE event, persist failure, end turn gracefully.
- Errors: tool failures are returned to the LLM as `{ error, message }` so the model can apologize/retry; they're also persisted to `AssistantToolCall.errorMessage` for observability.

---

## 12. Multilingual Behavior

- System prompt selects locale-appropriate phrasing.
- Tool descriptions stay English (LLM is fluent; English descriptions yield best tool-selection accuracy).
- User-facing assistant text is generated in the user's i18n locale (en/fr/ar). The LLM is instructed to match `userLocale` at the top of every system prompt.
- Skill bodies have `{en,fr,ar}.md` variants; the loader picks the right one.
- Numeric/currency formatting uses Angular's locale pipes on the frontend; backend returns raw numbers + ISO currency.
- Arabic responses respect RTL automatically via existing global CSS.

---

## 13. Security, Permissions, Observability

- **Multi-tenancy:** tools never trust LLM-provided `garageId`. `OrchestratorService` injects it from `CurrentUser`.
- **Module gating:** tools tagged with `requiredModule` are filtered out of the registry per request, before the LLM ever sees them. A garage that hasn't enabled `invoicing` cannot be tricked into running invoicing tools — they don't exist for that user.
- **Role gating:** owner-only tools hidden from staff. Same registry-filter mechanism.
- **Blast tier enforcement:** tier check happens server-side in the orchestrator before handler invocation; the LLM cannot self-classify a write as a read. Tier is a property of the tool definition, not the call.
- **Approval expiry:** pending approvals time out at 5 min. Orchestrator turn is gracefully terminated if no decision arrives.
- **Audit log:** every tool call → row in `AssistantToolCall` with args, result snippet (truncated to 2KB), status, duration, approver. Used for observability and debugging.
- **PII safety:** customer phone/email are NOT redacted in `argsJson`/`resultJson` (would break debugging) but the audit table is owner/admin-readable only and excluded from any future analytics export.
- **Rate limiting:** per-user 30 turns/min, per-garage 200 turns/min (configurable). Returns 429 + chat-friendly error.
- **Cost cap:** per-conversation token budget (configurable, default 200k tokens). When exceeded, orchestrator emits a `budget_exceeded` event and refuses further turns until the user clears or starts a new conversation.
- **Observability:** new `AssistantToolCall` table + structured logs with `conversationId`, `turnId`, `toolName`, `latencyMs`, `provider`. No new infrastructure required for v1 (read from DB).

---

## 14. Build Phases (parallelizable workstreams)

The user wants parallel implementation via subagents. The phases below are designed so phases can run in sequence but **workstreams within a phase run in parallel**.

### Phase 0 — Foundations (sequential)
1. `git pull` to sync.
2. Prisma schema: add `AssistantConversation`, `AssistantMessage`, `AssistantToolCall`. Run migration.
3. Email module skeleton: `opauto-backend/src/email/` with `EmailService` (Resend), env vars, unit test for the driver wrapper.
4. New `assistant` NestJS module skeleton — controller stub, service stubs, registered in `app.module.ts`.

### Phase 1 — Backend core (parallel subagents)
- **Subagent A — Orchestrator core:** `OrchestratorService`, `LlmGatewayService` (Groq-first / Claude fallback with tool-calling), iteration loop, SSE wiring, error handling, timeouts.
- **Subagent B — Tool registry & auth filter:** `ToolRegistryService` with module/role filtering, JSON-schema validation, blast-tier enforcement, audit log writes.
- **Subagent C — Skill registry:** `SkillRegistryService` loading `assistant/skills/**/*.md`, locale resolution, frontmatter parsing.
- **Subagent D — Agent runner:** `AgentRunnerService` reusing the orchestrator loop with isolated state, tool-whitelist enforcement.
- **Subagent E — Approval flow:** `ApprovalService`, deferred-turn resumption, expiry job, controller endpoint.
- **Subagent F — Conversation persistence:** `ConversationService`, sliding-window history, title generation.

### Phase 2 — Tool catalog (parallel subagents)
Tools split by domain so each subagent owns a folder:
- Subagent G — analytics tools.
- Subagent H — customer + car tools.
- Subagent I — appointment tools.
- Subagent J — invoicing + inventory tools.
- Subagent K — communications tools (SMS + email + retention adapter).
- Subagent L — reports tools (PDF/CSV generation, signed URLs).

### Phase 3 — Frontend (parallel subagents)
- Subagent M — Floating launcher + panel shell + RTL + state service.
- Subagent N — Message list + message renderer (text, tool-call card, approval card, agent receipt).
- Subagent O — Input + voice service (Web Speech API, en/fr/ar).
- Subagent P — Approval card variants (inline-confirm, typed-confirm) + decision wiring.
- Subagent Q — Conversation history sidebar + clear + new-conversation.

### Phase 4 — Skills & agents wiring (parallel subagents)
- Subagent R — write the four v1 skills (markdown × 3 locales × 4 skills = 12 files).
- Subagent S — implement the three v1 agents (system prompts, tool whitelists).
- Subagent T — orchestrator integration tests (skill loading, agent dispatch, full happy path).

### Phase 5 — Hardening (sequential, low-parallel)
- Rate limiting + cost cap.
- Audit log retention policy.
- E2E tests via Chrome DevTools MCP: open widget on dashboard, ask "how much revenue this month", approve an SMS, voice flow.
- i18n key sync across en/fr/ar.
- Cross-browser voice testing (Chrome, Safari).

### Parallelism rules
- Subagents within a phase share NO files. Each owns specific paths.
- Each subagent invokes `test-writer` agent at the end of its work for unit + integration tests, per project rule.
- Each subagent commits its own work; no cross-subagent merges.
- Phase boundaries are sync points: do not start phase N+1 until phase N is green (typecheck + tests).

---

## 15. Verification Plan

### Unit
- Tool handlers: arg validation, garageId scoping, module gating, blast-tier resolution.
- Skill loader: frontmatter parse, locale fallback (en when ar/fr missing).
- Approval expiry: pending approvals expire correctly, denied approvals halt the turn.
- LLM gateway: Groq → Claude failover on simulated 5xx.

### Integration
- Full orchestrator turn against mocked LLM emitting deterministic tool calls (analytics → reply).
- Approval flow: tool call → approval pending → user approves → handler runs → reply emitted.
- Multi-tenancy: user from garage A cannot read garage B data via any tool, even with malicious arg injection.
- Module gating: disabling `invoicing` removes invoice tools from registry response.
- Conversation persistence: sliding window correctly truncated; tool messages preserved.

### E2E (Chrome DevTools MCP)
- Launcher visible on every authenticated route; opens panel on click.
- Send "how much revenue this month" → assistant streams a number.
- Send "list at-risk customers" → assistant returns ranked list.
- Send "send a reminder SMS to <customer>" → approval card appears → click approve → success receipt.
- Voice: hold mic, say "show today's appointments", verify transcript fills input, send.
- RTL: switch to Arabic, verify launcher anchors bottom-left, panel direction reversed.

### Test commands
```
cd opauto-backend && npm run test                      # unit
cd opauto-backend && npm run test:e2e                  # integration
npm run test                                           # frontend unit
# E2E run via /e2e command from Claude Code
```

---

## 16. Critical Files

### Created
- `opauto-backend/src/assistant/**` (entire new module)
- `opauto-backend/src/email/email.module.ts`, `email.service.ts`, `providers/resend-email.driver.ts`
- `opauto-backend/prisma/migrations/<timestamp>_assistant/migration.sql`
- `src/app/features/assistant/**` (entire new feature)
- `src/app/core/models/assistant.model.ts`
- `assets/i18n/{en,fr,ar}.json` — new `assistant.*` keys
- `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md` (copy of this spec)

### Modified
- `opauto-backend/src/app.module.ts` — register `AssistantModule`, `EmailModule`.
- `opauto-backend/prisma/schema.prisma` — three new models.
- `opauto-backend/src/ai/ai.service.ts` — extend with tool-calling-aware `complete()` (or wrap from `LlmGatewayService`); change provider order to Groq-first only for the orchestrator path; existing one-shot AI features keep current order.
- `src/app/app.html` — mount `<app-assistant-launcher>`.
- `src/app/app.ts` — import the launcher component.
- `docs/MVP_PROGRESS.md` — add a new "AI Orchestrator" section, check off as phases complete.
- `docs/ARCHITECTURE.md` — extend the Backend tree with the `assistant/` and `email/` modules.

### Reused (existing code already in place)
- `AiService` provider chain — `opauto-backend/src/ai/ai.service.ts:27-40`.
- `AiActionsService` for retention drafts — `opauto-backend/src/ai-actions/ai-actions.service.ts`.
- `SmsService` (Twilio) — `opauto-backend/src/sms/sms.service.ts`.
- `ReportsService.getDashboardStats` and `getRevenueByMonth` — `opauto-backend/src/reports/reports.service.ts`.
- `CurrentUser` decorator + `JwtAuthGuard` — `opauto-backend/src/auth/`.
- `ModuleAccessGuard` semantics — `opauto-backend/src/modules/module-access.guard.ts`.
- `TranslationService` and `i18n/{en,fr,ar}.json` — frontend translations.

---

## 17. Out of Scope (explicit v2)

To prevent scope creep, the following are **deferred**:
- Proactive push notifications (assistant initiating without user prompt). v1 is reactive only.
- Parallel tool calls per LLM step.
- Knowledge-base RAG over uploaded garage docs.
- Inline data visualizations (charts) inside chat replies.
- Multi-conversation threading (sub-conversations, branches).
- Skill marketplace / hot-reload.
- Background-running long agents (more than 90s).
- Customer-facing assistant (this v1 is owner+staff only).
- Webhook tools (Zapier-style external integrations).
- Voice-to-voice continuous conversations (current voice is push-to-talk).

These are noted so future-you doesn't accidentally implement them under the v1 banner.

---

## 18. Open Questions / Risks

- **Groq tool-calling reliability:** Llama-3.3-70b's JSON tool-call output is occasionally malformed. Mitigation: Claude fallback on parse failure. Monitor failure rate in Phase 1; if >5%, swap to Claude-first.
- **Groq rate limits:** free-tier rate limits are tight. Plan to upgrade or shift simple turns to Claude-Haiku for volume.
- **Web Speech API in Safari:** SpeechRecognition support is partial. Voice may degrade to "not available" on iOS Safari. Acceptable for v1 (text input always works).
- **Resend deliverability** for Tunisian recipient domains: monitor bounce rate post-launch; SPF/DKIM setup required on the sending domain.
- **Cost:** estimate ~$0.001 per turn on Groq, ~$0.02 per turn on Claude. With cost cap and rate limit, worst case is bounded. Real costs to be measured in Phase 1.

---

## 19. Execution Order Recap (after this plan is approved)

1. **Exit plan mode.** Copy this file to `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md` and commit it.
2. `git pull origin main` to sync.
3. Phase 0 sequential foundations (DB migration + email skeleton + assistant module skeleton).
4. Phase 1 launched as parallel subagents (A through F).
5. After Phase 1 green: Phase 2 launched as parallel subagents (G through L).
6. After Phase 2 green: Phase 3 launched as parallel subagents (M through Q).
7. Phase 4 (skills + agents) parallel subagents (R, S, T).
8. Phase 5 hardening sequentially.
9. After each subagent completes: invoke `test-writer` per project rule (`/CLAUDE.md` mandates unit + integration tests before marking complete).
10. Update `docs/MVP_PROGRESS.md` after each phase.
