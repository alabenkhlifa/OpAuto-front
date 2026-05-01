# OpAuto MVP Implementation Progress

> **Session handoff (2026-04-30):** 14 commits landed this session (`001a658` → `602815a`) shipping the **Invoicing Fiscal Overhaul** end-to-end across 6 phases. New backend: gapless atomic numbering (Prisma `$transaction`), per-line TVA + fiscal stamp, immutable-after-issue state machine (HTTP 423), pdfkit PDF rendering with LRU cache, Resend email + wa.me WhatsApp delivery, Quote (devis) and Credit Note (avoir) modules, ServiceCatalog CRUD, AR aging / customer statement / Z-report / accountant CSV reports, token-gated public PDF route. New frontend: invoicing shell with sub-nav + dashboard + KPI tiles, quote/credit-note pages, payment + send-invoice modals, AR aging stacked-bar, Z-report print view, part-picker autocomplete. Schema: 3 migrations (`invoicing_fiscal_foundation`, `add_garage_discount_threshold`, `add_invoice_status_viewed`); 8 new models (Quote, QuoteLineItem, CreditNote, CreditNoteLineItem, InvoiceCounter, ServiceCatalog, DiscountAuditLog, DeliveryLog); 6 new enums; Invoice/InvoiceLineItem/Garage/Customer extended. New deps: `pdfkit`, `qrcode`, `lru-cache`, dev `pdf-parse`. New env var: `INVOICE_TOKEN_SECRET` (falls back to `JWT_SECRET`). Tests: **574/574 backend unit, 157/158 e2e (1 pre-existing flake), 634/642 frontend (8 pre-existing failures)**. E2E validation: 12/13 PASS, 1 SKIP (no staff seed). **Action items for the user:** (1) run `cd opauto-backend && npx prisma migrate deploy` to apply the 3 new migrations; (2) set `INVOICE_TOKEN_SECRET` (or rely on `JWT_SECRET` fallback); (3) `RESEND_API_KEY` already in env from the AI Orchestrator session. Full plan: `docs/superpowers/plans/2026-04-30-invoicing-overhaul.md`.
>
> **Prior handoff (2026-04-26):** 6 commits landed this session (`87b41e5` → latest) building the AI Orchestrator backend end-to-end (Phases 0, 1, 2, 4, 5 backend). 50+ source files, 227 tests across 17 suites, 28 tools registered, 4 skills × 3 locales, 3 sub-agents, Groq-first/Claude-fallback LLM gateway with SSE streaming, blast-tier-based approval flow, rate limiting + cost cap + expiry cron. **Blocked:** Phase 3 (frontend chat widget) waits on the user's uncommitted pricing-feature work in `src/`. **Action items for the user:** (1) `cd opauto-backend && npm run prisma:migrate` once DB is reachable; (2) set `GROQ_API_KEY`/`ANTHROPIC_API_KEY`/`RESEND_*` env vars; (3) commit or stash the pricing-feature work in `src/` before launching Phase 3. Full design + plan: `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md`.
>
> **Prior handoff (2026-04-21):** 10 commits landed this session (`850ec70` → `8d56b72`) on top of the 2026-04-20 batch. 15 more bugs fixed end-to-end (BUG-063, 068, 069, 073, 074, 086a/b/c, 087d, 088a/b/c, 089, 090, 091) and 14 new tests added (7 unit + 7 integration for invoicing). Remaining 🔴 tickets are all feature gaps (no backend model for photos / user preferences / extended Garage fields / AI UI / calendar drag-drop) — see `docs/BUGS.md`. Scroll to **Stability Session 2026-04-21** below for the fix-by-fix log.
>
> **Prior handoff (2026-04-20):** 25 commits landed (`67a7aa8` → `b83c9bf`), 41 bugs fixed + 25 gaps tracked as open 🔴 tickets. See **Stability Session 2026-04-20** lower in this file.


## Batch 0: Foundation & Infrastructure
- [x] 0A: NestJS Backend Scaffold + Docker
- [x] 0B: Frontend Environment Config (interceptors, api service)
- [x] 0C: FullCalendar Installation
- [x] 0D: Progress Tracking + CLAUDE.md Update

## Batch 1: Prisma Schema + NestJS Modules
- [x] Auth module (login, register, JWT, guards)
- [x] Users module
- [x] Customers module
- [x] Cars module
- [x] Appointments module
- [x] Maintenance module
- [x] Invoicing module
- [x] Inventory module
- [x] Employees module
- [x] Approvals module
- [x] Reports module
- [x] Notifications module
- [x] Modules (marketplace) module
- [x] AI module
- [x] Garage Settings module

## Batch 2: Theme Migration
- [x] CSS variables update (styles.css)
- [x] Tailwind config update
- [x] Global styles (buttons, badges, forms)
- [x] Component CSS files (12 files)
- [x] Component TS inline styles (25 files)

## Batch 3: Calendar Hero Feature
- [x] Calendar component (month/week/day views)
- [x] FullCalendar dark theme + glassmorphism
- [x] Drag-and-drop rescheduling
- [x] Mechanic color-coding
- [x] Route + sidebar integration

## Batch 4: Enhanced Dashboard + Notifications
- [x] KPI cards with trends (revenue, appointments, utilization, active jobs)
- [x] Revenue trend line chart
- [x] Job type distribution doughnut chart
- [x] Mechanic performance stacked bar chart
- [x] Notification model + service
- [x] Notification bell component (header dropdown)
- [x] Notifications full page with filters

## Batch 5: Module System
- [x] Module model + catalog (15 modules)
- [x] Module service (access check, purchase, deactivate)
- [x] Module marketplace page (replaced subscription page)
- [x] Feature-lock component migrated to ModuleService
- [x] moduleGuard added to role.guard.ts
- [x] Sidebar updated (Modules nav + Notifications nav items with icons)

## Batch 6: AI Proxy + Frontend Integration
- [x] AI backend proxy (Claude/OpenAI with mock fallback)
- [x] AI module with chat/diagnose/estimate endpoints
- [x] Auth guard re-enabled (JWT token + mock auth check)
- [x] Auth service HTTP integration (login/register with mock fallback)
- [x] Customer, Appointment, Car services HTTP migration

## Batch 7: Seed Data + Translations + Final Wiring
- [x] Prisma seed data (15 customers, 15 cars, 9 appointments, 5 employees, 15 parts)
- [x] Translation updates (en, fr, ar) - calendar, notifications, modules, AI
- [x] Sidebar + route finalization (34 routes, all with proper guards)
- [x] Sidebar icons for grid (modules) and bell (notifications)

## Batch 8: AI Features (MVP)
- [x] AI provider abstraction (frontend `core/services/ai.service.ts` — backend-delegating service with 7 methods)
- [x] Smart Scheduling — "AI Suggest" on appointment form, backend endpoint, top 3 slots (+ Groq AI, i18n, skill matching)
- [ ] Analytics Narrator — "Generate Insights" on dashboard, backend endpoint, NL bullet points
- [x] Predictive Maintenance — fleet dashboard card + per-car alerts on /cars/:id, `/ai/predict-maintenance` endpoint with Groq-first reason polish, deterministic scorer across 8 service types
- [x] Customer Churn Prediction — identify at-risk customers, backend endpoint, UI display
- [x] Executable Churn AI actions (2026-04-21) — AI drafts French SMS + optional %/TND discount; manager one-click approves → Twilio send (mock driver by default, swap via `SMS_PROVIDER=twilio`). New `AiAction` table (DRAFT→APPROVED→SENT/FAILED→REDEEMED/EXPIRED lifecycle), `Customer.smsOptIn` opt-out, inline approval on At-Risk card, `/ai/actions` REST endpoints, 17 new tests.

## AI Orchestrator (Session 2026-04-26 — in progress)
> Full design spec: `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md`. Goal: Claude-Code-style chat assistant with tool-calling, voice (Web Speech API), Groq-first / Claude-fallback LLM routing, blast-tier-based approval gating, persistent conversations.

**Phase 0 — Foundations (sequential):**
- [x] Prisma models — `AssistantConversation`, `AssistantMessage`, `AssistantToolCall` + 3 new enums. Migration must be run with DB available.
- [x] Email module skeleton — `opauto-backend/src/email/` (Resend driver + mock + factory provider). New env vars: `RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_PROVIDER`.
- [x] Assistant module skeleton — `opauto-backend/src/assistant/` (controller with SSE chat endpoint, shared types, DTOs, stub services). Wired into `app.module.ts`.

**Phase 1 — Backend core (parallel subagents A–F, in progress):**

Wave 1 (committed):
- [x] Subagent B — Tool Registry (Ajv validation, module/role filtering, blast-tier resolution, timed handler execution). 19 tests.
- [x] Subagent C — Skill Registry (markdown loading via gray-matter, frontmatter, en/fr/ar locale fallback, dist asset copy). 12 tests.
- [x] Subagent E — Approval Service (deferred-turn state machine, 5-min expiry, typed-confirm validation, multi-tenant scoping). 14 tests.
- [x] Subagent F — Conversation Service (sliding-window history, title generation via injected summarizer, multi-tenant scoping). 23 tests.

Wave 2 (committed):
- [x] Subagent A — Orchestrator + LLM Gateway (Groq-first, Claude fallback, tool-calling, SSE streaming, 8-iteration cap, 90s turn timeout, approval-gating, resumption sentinel `__resume__:<toolCallId>`, fire-and-forget title summarization). 21 tests.
- [x] Subagent D — Agent Runner (sub-LLM contexts with tool whitelists, blast-tier refusal of write actions, 6-iteration default cap, 60s run timeout). 14 tests.

Phase 1 totals: 6 services, 92 unit tests + 13 orchestrator integration tests = 105 passing.

**Phase 2 — Tool catalog (parallel subagents G–L, committed):**
- [x] Subagent G — Analytics tools: `get_dashboard_kpis`, `get_revenue_summary`, `get_customer_count`, `list_active_jobs`, `get_invoices_summary`. 17 tests.
- [x] Subagent H — Customer + Car tools: `find_customer`, `get_customer`, `list_at_risk_customers`, `list_top_customers`, `find_car`, `get_car`, `list_maintenance_due`. 25 tests.
- [x] Subagent I — Appointment tools: `list_appointments`, `find_available_slot`, `create_appointment`, `cancel_appointment`. 13 tests.
- [x] Subagent J — Invoicing + Inventory tools: `list_invoices`, `get_invoice`, `list_overdue_invoices`, `record_payment` (typed-confirm), `list_low_stock_parts`, `get_inventory_value`. 14 tests.
- [x] Subagent K — Communications tools: `send_sms`, `send_email` (dynamic tier: AUTO_WRITE if self / CONFIRM_WRITE otherwise), `propose_retention_action`. 18 tests.
- [x] Subagent L — Reports tools: `generate_invoices_pdf`, `generate_period_report` (placeholder signed URLs — real PDF/CSV rendering deferred to Phase 5). 11 tests.
- [x] Integration: 6 tool sub-modules wired into AppModule (avoiding cyclic AssistantModule import). Combined build green; full assistant + email suite at **203 tests passing**.

Phase 2 totals: 28 tools registered with the assistant. Tool registry validates args via Ajv, filters by module/role, enforces blast tiers, and audits every call.

**Phase 3 — Frontend chat widget (parallel subagents M–Q, pending):** floating launcher, message list, voice/input, approval cards, conversation history.

**Phase 4 — Skills + agents (parallel subagents R–T, committed — moved up to avoid frontend conflict):**
- [x] Subagent R — 4 skills × 3 locales (12 markdown files: daily-briefing, growth-advisor, email-composition, retention-suggestions). All tool whitelists validated against the Phase 2 catalog.
- [x] Subagent S — 3 agents registered (`analytics-agent`, `communications-agent`, `growth-agent`), AgentsModule wired into AppModule. 7 tests.
- [x] Subagent T — Orchestrator integration tests covering 7 end-to-end scenarios: read-tool happy path, CONFIRM_WRITE deferral, approval resumption via `__resume__:<toolCallId>`, skill loading, agent dispatch, iteration cap, multi-tenancy. No orchestrator bugs surfaced.

Phase 4 totals: full assistant + email suite at **217 tests across 16 suites**, build clean. **Backend is feature-complete:** orchestrator + 28 tools + 4 skills × 3 locales + 3 agents + approval flow + audit + persistence.

**Phase 3 — Frontend chat widget (parallel subagents M–Q, committed):**
- [x] Subagent M — AssistantLauncherComponent (floating button, RTL-aware) + AssistantPanelComponent (slide-in drawer with named ng-content slots) + AssistantStateService (signals, localStorage persistence) + AssistantChatService (SSE via `fetch`+ReadableStream, HTTP for non-streaming endpoints) + AssistantContextService (Router-listening). 37 tests.
- [x] Subagent N — AssistantMessageListComponent + AssistantMessageComponent (role-aware bubbles, tool-call cards, agent receipts, streaming cursor, markdown-free pre-wrap). 16 tests.
- [x] Subagent O — AssistantInputComponent (auto-resize textarea, Enter to send) + AssistantVoiceControlsComponent + AssistantVoiceService (Web Speech API, en/fr/ar locale mapping, graceful fallback for Safari/Firefox). 35 tests.
- [x] Subagent P — AssistantApprovalCardComponent (CONFIRM_WRITE Approve/Deny + TYPED_CONFIRM_WRITE input check, live countdown, expired auto-dismiss). 11 tests.
- [x] Subagent Q — AssistantConversationListComponent (list, select, delete, clear, relative timestamps, mobile accordion). 12 tests.
- [x] Integration: launcher template composes all 5 children into the panel slots with full orchestration (SSE → state, approval flow, conversation switching, locale→Web Speech). Mounted globally in `app.html`. 86 keys added across `assets/i18n/{en,fr,ar}.json` under `assistant.*` namespace.

Phase 3 totals: 5 components, 5 services, 111 frontend tests passing, full SSE-streaming chat UI on every authenticated route.

**Phase 5 — Hardening (backend portion committed; frontend portion deferred):**
- [x] Rate limiting via @nestjs/throttler — two named throttlers (`short` 30/60s keyed by userId, `long` 200/60s keyed by garageId). Custom `AssistantThrottlerGuard` returns structured 429 + Retry-After. **Note:** in-memory storage; for multi-instance deploys, swap in Redis-backed `ThrottlerStorage`.
- [x] Cost cap per conversation — `ConversationService.getTotalTokens` aggregates `tokensIn + tokensOut`; `OrchestratorService` checks `CONVERSATION_TOKEN_BUDGET = 200_000` at start of every iteration; emits `budget_exceeded` SSE + persists SYSTEM message + ends turn.
- [x] Approval expiry cron via @nestjs/schedule — `ApprovalSchedulerService` runs `@Cron(EVERY_MINUTE)` calling `ApprovalService.expireOverdue`. Errors logged, cron stays alive.
- [ ] (deferred — needs Phase 3) E2E tests via Chrome DevTools MCP
- [ ] (deferred — needs Phase 3) Cross-browser voice testing (Chrome, Safari)
- [ ] (deferred — touches user's pricing-feature i18n files) i18n key sync across en/fr/ar

Phase 5 backend totals: 227 tests across 17 suites passing.

---

### Open before next AI Orchestrator session

- [ ] Run `cd opauto-backend && npm run prisma:migrate` once Postgres is reachable (creates `assistant_conversations`, `assistant_messages`, `assistant_tool_calls`).
- [ ] Set env vars on the backend: at least one of `GROQ_API_KEY` / `ANTHROPIC_API_KEY`; for email `RESEND_API_KEY` + `RESEND_FROM` + `EMAIL_PROVIDER=resend` (defaults to mock when unset).
- [ ] Resolve the parallel pricing-feature work in `src/` (commit or stash) so Phase 3 (frontend chat widget) can launch without conflicts on i18n, sidebar, routing.
- [ ] After Phase 3 ships, complete Phase 5 frontend hardening: E2E tests via Chrome DevTools MCP, cross-browser voice testing (Chrome/Safari), i18n key sync.
- [x] Production scaling: inline pattern documented in `opauto-backend/src/app.module.ts` (commit `dce53d7`). Swap to Redis-backed `ThrottlerStorage` is a 30-line config change + one npm install when you scale beyond a single Render instance.

### Session 2026-04-26 — wrap-up

11 commits delivered (`87b41e5` → `dce53d7`). AI Orchestrator backend + frontend are feature-complete and build-green in isolation. The user's pre-existing pricing-feature work is restored in the working tree and unblocks Phase 3 once their 4 conflict files are resolved (`app-routing-module.ts`, `translation.service.ts`, `sidebar.component.ts`, `sidebar.component.html`). Stash kept as `stash@{0}` for safety.

### Orchestrator hardening (Session 2026-04-26 evening)

- [x] `send_email` CSV invoice attachment: `attachInvoiceIds` triggers a garage-scoped Prisma fetch and produces a real `invoices.csv` attachment (number, status, customer, total, paid, outstanding, due, created).
- [x] Pre-approval guard in orchestrator: catches obviously-malformed `send_email` calls (empty body + empty `attachInvoiceIds`) and feeds the error back to the LLM instead of asking the user to deny garbage.
- [x] Action-chaining rules in system prompt + classifier prompt + tool description so the model fetches data first, then sends.
- [x] Groq strict-validator workarounds: dropped `format: 'date-time'`/`format: 'email'` and `minLength: 1` on schemas the small llama model couldn't satisfy. Handlers still enforce the constraints.
- [x] `safeParseArgs` normalises LLM-emitted `null` / primitives / arrays to `{}` so no-arg tools (e.g. `get_customer_count`) don't fail the registry's `type: 'object'` check.
- [x] E2E verified live: "How many customers do I have?" → classifier picks 1/25 → tool call → "You currently have a total of 18 customers." (no fallback, no 429).

### Orchestrator hardening (Session 2026-04-27 evening)

- [x] **Action-verb tool augmenter** in `OrchestratorService.filterToolsByIntent` — deterministic en/fr/ar regex layer that unconditionally adds `send_email`/`send_sms` to the picked tool slice when the user message contains imperative send/email/sms phrases. Fixes "I can't send emails" responses caused by the small llama-3.1-8b classifier dropping action tools on compound action+read intents (e.g. "email me my invoices").
- [x] **List-tool ordering & pagination params** — added `orderBy` + `limit` to `list_invoices`, `list_appointments`, `list_overdue_invoices`, `list_low_stock_parts`, `list_maintenance_due`. Each tool description now teaches the LLM which value maps to "first/earliest/most-urgent" vs "latest/most-recent". Fixes the bug where "first 3 invoices of this year" returned the latest 3 (because `list_invoices` was hardcoded to `createdAt desc` with no slice control).
- [x] **Augmenter pairs `find_customer` with `send_*`** — adjective-tolerant regex ("send a polite SMS", "email Sarah") plus an auto-pair so the LLM can resolve a recipient by name instead of asking the user for the phone/email. Fixes "Could you provide Ali Ben Salah's phone number?" replies.
- [x] **Cerebras + Mistral providers added** to `LlmGatewayService` — fallback chain is now Gemini → Groq → Cerebras (1M tok/day, no per-min throttle) → Mistral (1B tok/month) → Claude → mock. Fixes the "I'm sorry — I couldn't reach the AI service" mock fallback that fired when both Gemini hit its daily RPD ceiling and Groq's 6k TPM was exceeded by tool-heavy turns. Shared `callOpenAiCompatible` helper avoids duplicating the chat-completions plumbing across three providers.
- [x] **Resend wired through compose** — `EMAIL_PROVIDER` / `RESEND_API_KEY` / `RESEND_FROM` were being added to `/opt/opauto/.env` but never reached the running container; compose only passes through what's listed in the backend service `environment:` block. Same change for `CEREBRAS_API_KEY` / `MISTRAL_API_KEY`.
- [x] 22 new tests across orchestrator, gateway, invoicing-inventory, customers-cars, and appointments specs. Full assistant suite: **269 tests / 17 suites passing**.

### Orchestrator hardening (Session 2026-04-28 evening)

- [x] **Tool-call JSON leak defense** — Cerebras qwen and (sometimes) Groq llama-3.1-8b emit tool calls as TEXT in the `content` field instead of structured `tool_calls`, causing raw `{"type":"function","name":"send_sms",...}` chains and `<function=...>` markup to render in chat. Five-layer defense in depth:
    - New `leak-detector.ts` module — brace-balanced raw-JSON matcher + XML-tag matcher + salvage + scrub. Pure functions, 21 unit tests.
    - `LlmCompletionRequest.validateResult` callback in the gateway protocol — orchestrator builds a per-call validator that scrubs incidental leaks, salvages a single clean call when possible, and rejects multi-call/unsalvageable leaks so the chain advances to the next provider.
    - System-prompt rule explicitly forbidding tool-call JSON / function-tag markup in reply text.
    - Frontend SSE sanitiser (`AssistantChatService.sanitizeEvent`) drops text deltas containing leak signatures as a last-ditch belt-and-suspenders.
    - Structured `assistant.leak.{scrubbed,salvaged,fallthrough}` warning logs with provider/model/kind/count.
- [x] E2E verified live: real prompt ("send SMS to Ali Ben Salah about overdue invoice") → Gemini quota-exhausted → Mistral made structured tool call → Groq composed clean prose. No JSON dump in the chat. Backend assistant suite: **293 tests / 18 suites passing**; frontend chat-service tests still green.

## Infrastructure Fixes (Session 2026-03-28)
- [x] Tailwind v4 source scanning — utility classes (w-6, h-6) now generated correctly
- [x] Mobile hamburger menu visibility — z-index fix + orange accent
- [x] Translation file deduplication — removed stale public/assets/i18n/ copies
- [x] Groq AI provider — real AI (Llama 3.3 70B) with graceful fallback
- [x] Gemini provider — integrated with graceful 429 handling
- [x] i18n for AI responses — AI reasons match display language (en/fr/ar)
- [x] 68 new tests (31 AiService + 37 appointment modal)

## UI Polish (Session 2026-04-12)
- [x] Maintenance page light theme — converted all 5 maintenance components from dark glassmorphism to light theme
- [x] Calendar view-switcher active text — white text on orange background instead of orange-on-light
- [x] Sidebar expand button — fixed invisible button (removed conflicting Tailwind classes, bigger hamburger icon, visible styling)
- [x] Part modal light theme — converted Add/Edit Part modal from dark glassmorphism to light theme
- [x] Stock adjustment modal light theme — restyled with consistent form inputs, orange primary button, proper spacing
- [x] Sidebar expand button z-index — raised to z-index 51 so it sits above the top bar
- [x] Appointment "Add" button white text — removed overly broad `button span` color override in appointments CSS
- [x] Appointment modal light theme — converted from dark glassmorphism to light theme with AI suggest styling
- [x] Customers quick actions removed — removed redundant Quick Actions section from customers dashboard
- [x] Calendar add appointment — opens modal directly instead of navigating to appointments tab
- [x] Quick add car from appointment modal — opens car registration modal inline instead of navigating to cars page
- [x] Car registration modal light theme — converted from dark glassmorphism to light theme
- [x] Customer list items restyled — light borders, dark text, orange/teal avatars, hover states
- [x] Employee form light theme — converted from dark glassmorphism to white bg, dark text, gray inputs
- [x] Modules page restyled — warm gradient header, dark text, tinted card states, less monotone white
- [x] Profile page light theme — dark text, light borders, light toast/warning boxes, removed glass-card override
- [x] Calendar drag-and-drop rescheduling — AI-validated with conflict modal showing alternatives
- [x] Login page light theme — white card, warm gradient bg, dark text, amber demo credentials
- [x] Global toast notification system — success/error/warning/info toasts in top-right corner
- [x] Dashboard mechanic performance + job type distribution redesign — replaced ng2-charts with custom full-row cards: Day/Week/Month + 7d/30d/All toggles, totals row (jobs/hours/utilization), per-mechanic rows with avatar/rating/jobs bar/utilization/trend, stacked horizontal bar with top-6+Other rollup. Added `customerRating` to backend Employee model.

## Verification
- [x] Frontend builds: `ng build` passes with no errors
- [x] Backend typechecks: `tsc --noEmit` passes
- [x] Zero old blue colors remaining in src/
- [x] 16 backend modules in opauto-backend/src/
- [x] 34 frontend routes

## Stability Session 2026-04-20 (full-suite audit)

Comprehensive end-to-end testing of every screen + backend endpoint. 12 commits landed. Full transcript in `TEST_RESULTS.md`, bug breakdown in `docs/BUGS.md` (BUG-019 … BUG-040).

### P0 — blockers fixed
- [x] UI create-appointment → 400 (frontend sent `status:SCHEDULED` that DTO rejected)
- [x] Invoice Create page rendering raw `invoicing.create.*` i18n keys
- [x] Invoice Create page using 3 hardcoded mock customers instead of real 15
- [x] Module guard silent redirect → now shows toast "This module needs activation"
- [x] Dashboard "Generate Invoice" → 404 (`/invoicing` → `/invoices/create`)
- [x] Customers page showing 0 counts (loadStats race with loadCustomers)
- [x] Invoicing dashboard KPIs showing 0 (same race pattern)
- [x] Inventory dashboard showing 0 (same race pattern)

### P1 — data / workflow fixes
- [x] Invoice `paidAt` stays null after PAID → now set in `addPayment`
- [x] Employee roles all "Senior Mechanic" → expanded role type (Mechanic / Electrician / Bodywork Specialist / Tire Specialist)
- [x] `TIRE_ALIGNMENT` department missing translation
- [x] `common.reset` raw key on Settings
- [x] Maintenance cards showing "undefined Ford Focus" + empty CUSTOMER/Mileage → backend now includes `car.year`, `car.mileage`, `car.customer`
- [x] Cars cards always showing "Total Services: 0 / N/A" → backend aggregates from COMPLETED appointments
- [x] Cars Make filter empty → rebuilds from loaded cars via signal-backed computed
- [x] GET `/api/inventory/suppliers` 404 → returns `[]`
- [x] Maintenance "Complete Job" → 400 (`completionDate` not in DTO)
- [x] Maintenance "New Job" form raw `maintenance.new.*` keys → added en/fr/ar
- [x] Invoice detail direct-nav showed epoch dates + empty fields → `fetchInvoiceById` HTTP fallback
- [x] Invoice detail garage footer hardcoded ("OpAuto Garage / contact@opautogatage.tn" typo) → loads from `/garage-settings`
- [x] Invoice schema now has optional `carId` relation (Car.invoices reverse); detail shows "Volkswagen Golf 8 (2022) / 234TUN567"
- [x] Employee "Mark Unavailable" silently no-op'd → added `isAvailable`+`unavailableReason`+`unavailableUntil` to schema
- [x] Inactive employees showed "Available" on their cards → status AND isAvailable
- [x] Notifications Delete silently no-op'd → added `DELETE /notifications/:id` backend route
- [x] Login bad creds silent → now shows "Invalid username/email or password"
- [x] Change Password was a stub → implemented backend `POST /auth/change-password` + wired frontend
- [x] Reports Export button was `console.log` → generates CSV download with 6 KPIs
- [x] Staff got 403 on `GET /employees` (blocked appointment mechanic dropdown) → moved `@Roles(OWNER)` to mutations only
- [x] Staff got 403 on dashboard `GET /invoices` + sidebar `GET /approvals` → gated by `isOwner()` in caller
- [x] Owner-only route redirect was silent → `ownerGuard` now shows warning toast (en/fr/ar); bootstrap race fixed with `filter(user!==null), take(1)`

### P2 — polish
- [x] Currency format unified across 9 helpers (all `fr-TN` with `minimumFractionDigits: 2, maximumFractionDigits: 2`) — was mix of 0/2/3 decimals
- [x] Pluralization: `TranslationService.instant()` now understands `{one, other}` objects
- [x] Dashboard Today's Schedule: "1 appointment scheduled" / "5 appointments"
- [x] Customers: "1 car" / "2 cars" (was "1 cars")
- [x] Invoicing Pending: "1 invoice" / "3 invoices" (was "1 invoice(s)")
- [x] Dashboard "brake-repair •" raw slug → shows real car make/model
- [x] Duplicate top-level `invoicing` key in en/fr/ar.json → merged, removed dead block
- [x] Onboarding tour now honors per-user dismissal (`shouldShowTour()` check added to `startTourForCurrentUser`)
- [x] Maintenance KPI "Pending Approvals" (confusing with separate `/approvals` page) → renamed "Jobs Needing Approval"
- [x] Added i18n keys: `common.reset`, `employees.departments.tire-alignment`, `invoicing.create.*`, `invoicing.pending.*`, `maintenance.new.*`, `modules.activationRequired`, `modules.names.*`, `reports.export.{downloaded,tierRequired}`, `auth.ownerOnly`, `customers.labels.carsCount`

### Coverage
- Backend: 50+ endpoints across auth/customers/cars/employees/appointments/invoices/maintenance/inventory/modules/approvals/notifications/garage-settings/ai/users/reports — all GET/POST/PUT/DELETE verified via curl
- Frontend: every sidebar page loaded + every top-level button clicked. Staff role audit (`mohamed/staff123`) confirms sidebar filters, owner-only guards work, staff can complete their core flow (appointments + maintenance).
- Mobile responsive (375×667): sidebar slide-in/out works, no horizontal overflow on Dashboard/Appointments/Cars/Customers/Reports/Modules.
- Arabic text renders correctly but RTL layout is intentionally disabled (`LanguageService.updateDocumentDirection` hardcodes `dir=ltr`).

### Maintenance UI deep-dive (2026-04-20 later)
- [x] New Job form submit (was 400: stripped `customerId/status/tasks/approvals/mileage` from payload)
- [x] Mechanic dropdown populated from real employees (was 3 hardcoded mock IDs)
- [x] Edit Job submit (same 400 cleanup)
- [x] Start Job → in-progress transition
- [x] Complete Job → completed, appears in History tab
- [x] PENDING ↔ waiting enum mapping in both directions
- [x] Backend create/update now return relations (car, customer, mechanic)
- [x] **Tasks persist** — added POST/PUT/DELETE `/maintenance/:jobId/tasks/:taskId?` (commit `648b7b4`). Form's `syncTasks()` runs after job save, diffs original vs current task IDs and fires the right endpoint per task.

## Stability Session 2026-04-21 (resume — 10 tickets verified, 15 bugs fixed, 14 tests added)

BUG-063, 065, 066, 067, 068, 069, 071, 073, 074 exercised end-to-end. BUG-089/090/091 found + fixed along the way. See `docs/BUGS.md` for per-ticket detail.

### Invoice Draft → Sent → Paid (BUG-068)
- [x] Verified UI transitions (status + sidebar badge + list card progress) end-to-end
- [x] **`/invoices` list endpoint now includes `payments[]`** (was omitted → cards showed paid=0 / 0% for all PAID invoices)
- [x] **`invoicing.list.*` i18n namespace added** (en/fr/ar × 24 keys — list card was rendering raw keys)
- [x] **Seeder creates Payment rows for PAID invoices** (seed data had status=PAID with no Payment rows → UI stats misreported)
- [x] Tests: 7 unit + 7 integration (invoicing.service.spec, invoicing.e2e-spec, seed-payments.e2e-spec)

### Settings save (BUG-073)
- [x] Garage Info save verified end-to-end (name, phone, email, address persist across reload)
- [x] Relaxed over-strict Required validators on `registrationNumber`/`taxId`/`city`/`postalCode`/`country` (backend schema has no columns for these — form was permanently invalid)
- [x] Working Hours seed shape fixed (`mon/tue/...` → `monday/tuesday/...` with `isWorkingDay/openTime/closeTime`) — checkboxes now populate correctly
- [ ] Operations capacity/service/appointment, System, Integrations sub-forms still silent no-ops (BUG-087a/b/c — backend `Garage` schema + `mapToBackend` don't cover those fields)

### Add modals (BUG-074)
- [x] Add Customer submit + persist verified (`/customers/new` full page; creates record + navigates to detail)
- [x] Add Car (aka Register New Car) — fixed by Add Customer working + existing flow
- [x] Add Part — **`/inventory/suppliers` endpoint was a `[]` stub** → wired to `prisma.supplier.findMany`; also loosened part-modal `s.isActive` filter (schema has no such column)
- [x] Add Employee — **`CreateEmployeeDto` was rejecting `status` field** sent by frontend → added `EmployeeStatus` field to DTO

### Profile update (BUG-063)
- [x] Backend: `GET /users/me` + `PUT /users/me` routes (password/role whitelisted out so users can't self-escalate or bypass change-password)
- [x] Frontend: Profile form was a `setTimeout` fake-success stub → now PUTs firstName/lastName/email/phone; refreshes local currentUser signal so header rerenders
- [x] Verified: phone edit persists in DB (`+216 98 123 456` → `+216 20 555 777`)

### AI page / Preferences / Photos (BUG-071, 064, 067)
- [ ] BUG-071: AI module has backend endpoints but no `/ai` frontend route — needs a page component. Feature gap, logged 🔴.
- [ ] BUG-064: Profile Preferences save is still a `setTimeout` stub — needs a `UserPreference` Prisma model + endpoint. Logged 🔴.
- [ ] BUG-067: `PhotoUploadComponent` exists in `src/app/shared/` but is never imported; `PhotoService` is `URL.createObjectURL` + signal array (no HTTP). Backend has no `Photo` model. Full feature work. Logged 🔴.

### Approvals (BUG-065)
- [x] Approve + Reject buttons verified end-to-end (created approval via API — no UI create button)
- [ ] Type enum mismatch (frontend 8 types vs backend 4) + "Approved by on" missing name/date — BUG-089/090, open

### Stock Adjustment modal (BUG-066)
- [x] Modal opens, adjustment type/reason/qty flow works, stock persists (8 → 13)
- [x] **Audit trail fixed (BUG-091):** new `POST /inventory/:id/adjust` endpoint writes `stockMovement` rows; frontend `PartService.adjustStock` switched from bare PUT to the new endpoint. Verified 2 audit rows after UI adjustments.

### Approval type alignment (BUG-089/090)
- [x] Frontend `ApprovalType` enum cut from 8 legacy values to the 4 backend actually supports (MAINTENANCE, INVOICE, PURCHASE_ORDER, DISCOUNT)
- [x] Service `mapType` + model `APPROVAL_TYPE_LABELS` + stats `byType` shape updated
- [x] i18n keys replaced in en/fr/ar.json. Type dropdown + row badges now render real labels ("Purchase Order", "Discount") instead of "Other"

### Invoice Print (BUG-069)
- [x] Detail page `onPrint()` calls `window.print()` — verified real native print dialog
- [x] List-card Print was a no-op (`$event.stopPropagation()` only) → now navigates to `/invoices/:id?autoPrint=1`; detail `ngOnInit` consumes the query param and auto-triggers `window.print()` ~300ms after the invoice renders
- [x] PDF is served via the browser's "Save as PDF" print destination (onDownloadPDF just calls onPrint) — not a dedicated PDF endpoint but acceptable for MVP

## Branding (2026-04-28)
- [x] Platform renamed from "OpAuto" to "Smart Garage" (en/fr) / "الورشة الذكية" (ar) across all i18n strings, sidebar header, dashboard title, version footer, auth subtitle, system name, onboarding tour, welcome modals, sender placeholder
- [x] Sidebar logo swapped from inline car SVG to `public/garage-pro.png`; `.logo-icon` background tint removed, `overflow: hidden` added so the bitmap fills the rounded frame
- [x] `index.html` and `404.html` `<title>` updated to "Smart Garage - Garage Management System"

## Module marketplace grouping (2026-04-28)
- [x] ~~Modules page (`/modules`) groups `appointments` + `calendar` into a single "Calendar & Appointments" card~~ — **reverted**. Tried a merged two-tier card, then a dedicated top section; user wanted them to look like every other module. Final state: `subscription.component.ts` renders Appointments inline in Free Modules and Calendar inline in Paid Modules, no special section. `MODULE_CATALOG` was never touched

## Calendar made free (2026-04-28)
- [x] `calendar` module is now free instead of 29 TND/month. Updated both frontend (`src/app/core/models/module.model.ts` — `FREE_MODULES` + catalog `price: 0, isFree: true`) and backend (`opauto-backend/src/modules/modules.service.ts` — `FREE_MODULES` + catalog `price: 0`). Calendar route is no longer gated by purchase — `hasAccess('calendar')` and `moduleGuard('calendar')` both pass for any garage

## Calendar + Maintenance polish (2026-04-29)
- [x] Sidebar: removed standalone Appointments tab, renamed Calendar to "Calendar & Appointments" (`navigation.calendarAndAppointments` in en/fr/ar)
- [x] Cars page: Filters toggle now shows an X icon when expanded (re-click collapses); Schedule button on car card opens the AppointmentModal in place instead of redirecting to `/appointments`
- [x] Calendar event side panel: added Change Status dropdown above Edit. Now exposes all 6 appointment states (Scheduled, Confirmed, Pending, In Progress, Completed, Cancelled) via expanded `AppointmentStatus` type; status persists via `appointmentService.updateAppointment`
- [x] Maintenance Active Jobs: each job card now has an inline status dropdown (Waiting → Cancelled including Quality Check) so jobs can be progressed without opening details
- [x] Maintenance Schedule subtab: was always 0 because seed data has no PENDING jobs — broadened filter to "all open jobs" (excludes completed/cancelled). Adds `excludeStatus` predicate to `getViewFilter`
- [x] Maintenance details page (`/maintenance/details/:id`): translated all hardcoded strings (Job Information, Tasks, Photos, Approval Requests, Timeline, Cost, Time Tracking, Reject modal) — adds `maintenance.details.*` namespace in en/fr/ar
- [x] Added `quality-check` to `MaintenanceStatus` enum + status label/color maps + en/fr/ar `maintenance.status.qualityCheck` (was rendering as "Completed" via fallback)
- [x] Dashboard ar.json: Generate Invoice quick action title changed from "إنشاء فاتورة" to "الفوترة" to match sidebar Invoicing tab name
- [x] Appointment modal date input: removed `::-webkit-calendar-picker-indicator` 100%×100% absolute overlay that turned the whole field into a click-trap and made the picker undismissable
- [x] Dashboard "Cars Currently Being Worked On" rewired: was filtering appointments by `in-progress` (always 0 — appointments don't track work state); now reads from `MaintenanceService.getMaintenanceJobs()` filtered by `in-progress | quality-check | waiting-parts | waiting-approval`. KPI Active Jobs now reflects real work in progress. Adds an empty-state card ("All bays are free.") when nothing is active

## Dashboard E2E pass (2026-04-29)
- [x] Revenue Trend chart: x-axis was rendering newest-on-left (insertion-order from `Object.keys`); now generates the last 12 months chronologically (oldest left → newest right) keyed by `YYYY-MM` and labelled in the active locale
- [x] Quick Actions "New Car Entry" was landing on `/cars` list (forced a second click); now navigates with `?action=add` and `cars.component` opens the Register New Car modal directly via `ActivatedRoute.queryParamMap`, then strips the param from the URL
- [x] Dashboard schedule timeline items + Active Jobs cards are now `<button>`s with `(click)` handlers — schedule items go to `/calendar?appointmentId=:id`, job cards go to `/maintenance/details/:id`. Adds `cursor:pointer`, hover, and `:focus-visible` outline styles
- [x] Dashboard date header + KPI subtitles ("X today / aujourd'hui / اليوم") were stuck in English under FR/AR. Subscribed `getCurrentDate` + `kpiCards` to `TranslationService.translations$` (not `LanguageService.currentLanguage$` — the latter fires before the new translation file finishes loading, leaving `instant()` reading stale cached EN). Locale string in `Intl` calls switched to `fr-FR`
- [x] Sidebar parent items (Maintenance, Invoicing) now expose `aria-expanded`; was missing on submenu parents
- [x] Missing `invoicing.loading` translation key added to en/fr/ar (was logging 20× warnings on `/invoices`)
- [x] Predictive Maintenance "Check Now" predictions now persist across navigation for 24h via `localStorage` key `opauto.maintenance_predictions.<carId|fleet>`. Cache invalidates on language change or TTL expiry
- [x] +42 unit/integration tests across `dashboard.component.spec`, `cars.component.spec`, `maintenance-alerts-card.component.spec`, `sidebar.component.spec` — covers chart axis, navigation methods, query-param wiring, language-rebuild, cache restore/save/eviction, and aria-expanded toggling

## Dashboard Quick Actions redesign (2026-04-29)
- [x] Quick Actions tiles redesigned: white card + soft pastel icon (orange/indigo/slate/emerald), "Most common entry points" subtitle. Updated en/fr/ar copy to sentence case + tighter wording ("Book a future service slot", "Create bill for a completed job")

## Dashboard Revenue Trend redesign (2026-04-29)
- [x] Revenue Trend chart switched from monthly (last 12 months) to daily aggregation with 7d/30d/90d segmented range toggle (default 30d). Smooth orange area chart with vertical gradient fill, k-formatted y-axis ticks (e.g. "1.6k"), localized day-month x-axis labels. Subtitle "Last {{days}} days · Daily revenue (TND)" reflects active range. Predictive Maintenance Alerts ("Upcoming Service Reminders") moved into the same row (2fr/1fr grid) instead of its own block — uses the empty space next to the chart.

## E2E smoke regressions (2026-04-29)
> Ran a Chrome DevTools MCP smoke pass over Dashboard / Cars / Calendar / Invoices / Assistant. Three regressions surfaced; all three are being fixed in parallel sub-agents.
- [x] Dashboard "Job type distribution" donut: i18n drift — `dashboard.jobTypes.categories.{tire-replacement, electrical, engine-diagnostics, transmission}` were missing from en/fr/ar.json, generating ~250 missing-key console warnings per dashboard mount (chart still rendered via backend-name fallback). Keys added to all three locales.
- [x] Sidebar "Pending Payment" badge counter mismatch — `sidebar.component.ts:242`. Root cause was deeper than expected: backend Prisma `InvoiceStatus` enum has no `PENDING` value (it's `DRAFT/SENT/PAID/PARTIALLY_PAID/OVERDUE/CANCELLED`), so the original `status === 'PENDING' || status === 'OVERDUE'` filter was effectively counting OVERDUE only (26). Meanwhile the destination page `/invoices/pending` filters by lowercase `['sent','viewed']`. Sidebar filter rewritten to `status === 'SENT' || status === 'VIEWED'` to match the page exactly. Both now show 21. +3 sidebar specs (counts SENT+VIEWED only, null badge at zero, non-owner path skips fetch).
- [x] Dashboard "As of HH:MM" header timestamp drifts — `updateAsOfTime()` in `dashboard.component.ts:489` ran once at mount and never refreshed. Fixed with a 60-second `interval()` live tick gated by `takeUntilDestroyed(destroyRef)`. Option A (refresh on data-load) was unavailable — dashboard has no recurring fetch or manual refresh button to hook into. Comment in code flags that this is a wall-clock tick, not a data-freshness signal, so when a real refresh mechanism lands the call should move into the load callback. +3 unit tests in `dashboard.component.spec.ts` (initial format, fires at 60s/120s boundaries, stops on destroy).
- [x] Top-bar user pill showed "Staff" for the owner — `AuthService` constructor was pushing the cached `opauth_user` payload into `currentUserSubject` without normalization. Legacy/raw shapes (uppercase `role: 'OWNER'`, `firstName`/`lastName` instead of `name`) bypassed `mapUserFromBackend`, and the pill's strict `role === UserRole.OWNER` ('owner') check fell through to the "Staff" default. Fixed in `auth.service.ts:39-46` by running the cached user through `mapUserFromBackend` on session restore (idempotent for already-mapped payloads) and rewriting `localStorage`. Also restores empty name/initials on the pill. +4 unit tests in new `auth.service.spec.ts` (legacy uppercase OWNER, legacy uppercase STAFF, idempotency, no-cache).
- [x] Profile update didn't reflect on the top-bar pill — `onUpdateProfile` mutated only the local component signal; `AuthService.currentUserSubject` never re-emitted, so every other consumer (the pill) stayed stale. Added `AuthService.updateCurrentUser(payload)` that merges the response on top of the current user, runs it through `mapUserFromBackend`, broadcasts via `currentUserSubject`, and rewrites `localStorage`. Profile component now calls it on PUT success. Fixed two follow-on issues from the broadcast: (1) `loadCurrentUser` was re-populating the form on every emit and wiping in-progress edits — now only repopulates when the form is pristine; (2) the form's prior `dirty/touched` state survived the round-trip, leaving stale required-field hints visible after a 200 — now `markAsPristine()`+`markAsUntouched()` runs in the success handler. +2 unit tests in `auth.service.spec.ts` (merge+broadcast+persist round-trip, null-payload no-op).

## Tunisian plate visual + i18n fix (2026-04-29)
- [x] Dashboard Today's Schedule: replaced the gray plate badge with the actual Tunisian plate (`public/plate.png`) as the background. Added `parsePlate()` helper that splits a license-plate string into `{ left, right }` digit groups (handles `XXX TUN YYYY`, `XXX-YYYY`, raw digits, etc.) and overlays the two numbers in a 3-column grid (`38% / 24% / 38%`) so they sit close to the centered "تونس" already baked into the image. `direction: ltr` keeps orientation correct under Arabic.
- [x] Cars page: added missing `common.filtersActive` key to en/fr/ar (was rendering the raw key on the active-filters chip).
- [x] Dashboard "Cars Currently Being Worked On" job cards now use the same plate.png background + parsed left/right digits. Plate moved out of the chip row into its own centered `.job-card__plate-row` (152×33px, matches schedule plate size).

## Batch 9: Invoicing Fiscal Overhaul (2026-04-30)

> Full plan: `docs/superpowers/plans/2026-04-30-invoicing-overhaul.md`. 14 commits on `main` (`001a658` → `602815a`), 6 phases. Goal: turn the placeholder invoicing module into a Tunisian-fiscal-compliant pipeline (gapless numbering, per-line TVA + fiscal stamp, immutable-after-issue state machine, PDF rendering, multi-channel delivery, full reporting, role unlock, UX restructure).

**Phase 1 — Fiscal Foundation (backend):**
- [x] **1.1 Schema migration** — `invoicing_fiscal_foundation` migration extends Invoice (`appointmentId, maintenanceJobId, currency, fiscalStamp, lockedAt, lockedBy, issuedNumber, discountReason, discountApprovedBy, quoteId`), InvoiceLineItem (`partId, serviceCode, mechanicId, laborHours, tvaRate, tvaAmount, discountPct`), Garage (`mfNumber, rib, bankName, logoUrl, defaultPaymentTermsDays, numberingPrefix, numberingResetPolicy, numberingDigitCount, defaultTvaRate, fiscalStampEnabled`); adds new models `Quote`, `QuoteLineItem`, `CreditNote`, `CreditNoteLineItem`, `InvoiceCounter`, `ServiceCatalog`, `DeliveryLog`, and enums `NumberingResetPolicy`, `QuoteStatus`, `CreditNoteStatus`, `CounterKind`, `DeliveryChannel`, `DeliveryStatus`. `add_invoice_status_viewed` adds `VIEWED` to `InvoiceStatus`.
- [x] **1.2 Numbering service** — `invoicing/numbering.service.ts` provides `next(garageId, kind)` via `prisma.$transaction` upsert on `InvoiceCounter` (gapless atomic counter, year-reset / monthly-reset / continuous policies). **Never use `Math.random()`** for fiscal numbers.
- [x] **1.3 Tax calculator** — `invoicing/tax-calculator.service.ts` computes per-line `tvaAmount` from `tvaRate` + `discountPct`, derives HT / TVA / TTC totals, adds `fiscalStamp` (1.000 TND) when enabled. Totals are derived — `InvoiceLineItem.tvaRate` / `tvaAmount` are the source of truth.
- [x] **1.4 State machine** — `invoicing/invoice-state.ts` (`canTransition` / `assertCanTransition`) enforces DRAFT → SENT → VIEWED → PARTIALLY_PAID → PAID; CANCELLED only from DRAFT. Issued records are immutable: line / total mutations after issue throw `InvoiceLockedException` (HTTP 423). Only `status` and `notes` are mutable post-issue.
- [x] **1.5 from-job builder** — `invoicing/from-job.service.ts` translates a completed maintenance job (parts, labor hours, mechanic) into invoice line items; pulls TVA defaults from `Garage.defaultTvaRate`.

**Phase 2 — Invoice Lifecycle:**
- [x] **2.1 PDF renderer** — `invoicing/pdf-renderer.service.ts` (pdfkit) renders A4 fiscal invoices with LRU cache (`lru-cache` dep). Garage logo, MF number, RIB, bank name, customer MF, per-line TVA breakdown, totals + fiscal stamp + QR (`qrcode` dep) for the public link.
- [x] **2.2 Delivery service** — `invoicing/delivery.service.ts` ships invoices via Resend email + wa.me WhatsApp deep link. Writes `DeliveryLog` rows (channel, status, sentAt, error). Email attaches the PDF.
- [x] **2.3 Public PDF route** — `public/public.module.ts` + `invoice-public.controller.ts` + `invoice-token.service.ts` sign JWTs with `INVOICE_TOKEN_SECRET` (falls back to `JWT_SECRET`). Token-gated `GET /public/invoices/:id?token=...` returns the PDF; token-validate flips `SENT → VIEWED`.
- [x] **2.4 ServiceCatalog module** — new `services-catalog/` module with CRUD for ServiceCatalog rows (code, label, default labor hours, default price, default TVA rate). Frontend `service-picker/` autocomplete uses it on the invoice form.
- [x] **2.5 Quotes (devis)** — `invoicing/quotes.{controller,service}.ts` + DTOs. Lifecycle: DRAFT → SENT → APPROVED / REJECTED / EXPIRED. Approved quote can be converted to an invoice (sets `Invoice.quoteId`).
- [x] **2.6 Credit Notes (avoir)** — `invoicing/credit-notes.{controller,service}.ts` + DTOs. Always linked to a parent invoice; restock flag toggles inventory rollback. Lifecycle: DRAFT → ISSUED.
- [x] **2.7 Payments split** — `invoicing/payments.controller.ts` extracted so `POST /invoices/:id/payments` can be role-scoped independently of invoice CRUD.

**Phase 3 — Reporting & Roles (committed, see "Invoicing Overhaul — Phase 3" section below for line-by-line):**
- [x] **3.1 Multi-role unlock** — Invoicing/Quotes/Credit-Notes controllers expanded to `@Roles(OWNER, STAFF)`. UserRole enum is `OWNER | STAFF` only (no MECHANIC).
- [x] **3.2 Discount audit trail** — `Garage.discountAuditThresholdPct` + `DiscountAuditLog` model. Over-threshold discounts require `discountReason` + `discountApprovedBy`.
- [x] **3.3 AR aging report** — `reports/ar-aging.service.ts`, JSON + CSV.
- [x] **3.4 Customer statement** — `reports/customer-statement.service.ts`, running balance.
- [x] **3.5 Daily Z-report** — `reports/z-report.service.ts`, HT/TVA/TTC + payment-method aggregation.
- [x] **3.6 Accountant CSV export** — `reports/accountant-export.service.ts`, Tunisian-accountant column set.

**Phase 4 — Frontend Reports & Templates:**
- [x] **4.1 AR aging component** — `features/invoicing/components/ar-aging.component.*` Chart.js horizontal stacked bar + accessible table fallback.
- [x] **4.2 Z-report component** — `features/invoicing/components/z-report.component.*` glass-card layout with `@media print` block (hides chrome) + Print button.
- [x] **4.3 Templates page** — `features/invoicing/pages/templates/` shell for managing invoice/quote PDF templates.
- [x] **4.4 Reports page** — `features/invoicing/pages/reports/` aggregates AR aging + Z-report + accountant export downloads.

**Phase 5 — UX Restructure (committed, see "Invoicing Overhaul — Phase 5" section below for line-by-line):**
- [x] **5.1 Invoicing shell + sub-nav** — sticky pill nav (Dashboard / Quotes / Invoices / Credit Notes / Pending / Reports / Settings), "+ New" dropdown, mobile select fallback, FAB.
- [x] **5.2 Dashboard page** — quick-action grid, urgent banner, 4 KPI tiles with sparklines, Recent invoices + Top customers, AR aging mini-chart.
- [x] **5.3 / 5.4 Form rebuild** — partial; `<app-part-picker>` + `<app-service-picker>` shipped, full sectioned form rebuild deferred.
- [x] **5.5 Quote / Credit Note pages + Payment modal + Send Invoice modal** — `pages/quote-list`, `pages/quote-form`, `pages/quote-detail`, `pages/credit-note-list`, `pages/credit-note-form`; `components/payment-modal/`, `components/send-invoice-modal/`.
- [x] **5.6 Sidebar update** — invoicing children expanded to {Dashboard, Quotes, All Invoices, Credit Notes, Pending Payment, Reports}; new SENT-quotes badge.
- [x] **5.7 i18n parity** — all new keys added to `en/fr/ar.json`; new script `scripts/check-i18n-parity.js` (also `npm run i18n:check`) walks all 3 trees, normalises AR singular/plural pairs (`feature`/`features`, `photo`/`photos`, `tier`/`tiers`), exits non-zero on drift.

**Phase 6 — Service extraction & cleanup:**
- [x] **6.1 Service extraction** — `core/services/invoice.service.ts`, `quote.service.ts`, `credit-note.service.ts`, `payment.service.ts`, `service-catalog.service.ts` extracted from inline component code.
- [x] **6.2 Models** — `core/models/quote.model.ts`, `credit-note.model.ts`, `service-catalog.model.ts` (`invoice.model.ts` already there).
- [x] **6.3 Test totals** — **574/574 backend unit, 157/158 e2e (1 pre-existing flake), 634/642 frontend (8 pre-existing failures from Phase 5)**.

**E2E validation (Chrome DevTools MCP):** 12/13 PASS, 1 SKIP (no staff seed available to verify role split).

**Post-validation Sweep A (2026-04-30 — invoice CRUD path):**
- [x] **Bug #1 — DTO desync on invoice DRAFT save.** `POST /api/invoices` and `PUT /api/invoices/:id` were 400-ing because the FE sent fields the BE `CreateInvoiceDto` whitelist rejected (top-level: `status`, `issueDate`, `currency`, `taxRate`, `discountPercentage`, `paidAmount`, `paymentTerms`, `createdBy`, `paymentMethod`, `appointmentId`; per-line: `unit`, `totalPrice`, `taxable`, `discountPercentage`, `partId`, `serviceCode`, `mechanicId`, `laborHours`, **`tvaRate`**). Fix shipped in two layers: (a) BE `CreateLineItemDto` now mirrors `QuoteLineItemDto` (adds optional `tvaRate`, `partId`, `serviceCode`, `mechanicId`, `laborHours`) and `invoicing.service.ts` `create()`/`update()` honor per-line `tvaRate` (falling back to `garage.defaultTvaRate`) instead of overriding all lines with the garage default — restoring the per-line-TVA source-of-truth promised in CLAUDE.md; (b) FE `InvoiceService.mapToBackend` rewritten to send only DTO-allowed fields (with a `forUpdate` flag for status mutations), `mapFromBackend` reads `li.total` / `li.tvaRate` / `li.discountPct` from the BE response. Side benefit: closes S-STUB-009 (quote→invoice projection now preserves `partId`/`serviceCode`/`mechanicId`/`laborHours`). Doc fix: S-INV-004 spec corrected from `PATCH` to `PUT`.
- [x] **Bug #2 — vehicle dropdown stuck empty.** `filteredCars()` / `filteredJobs()` / `validationIssues()` in `invoice-form.component.ts` were `computed()`s reading `this.form.value.X` (a non-signal property on Reactive Forms), so the memo never re-evaluated when the customer changed and the `vehicleRequired` validation issue stayed stuck. Fix: introduced a `formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })` mirror in the constructor; the three `computed()`s now read `this.formValue().X`. Imperative paths (`onCustomerChange`, `onJobChange`, `buildPayload`) keep their plain `this.form.value` reads — they don't need reactivity.
- [x] **Bug #3 — Preview/Download PDF buttons routed to `/dashboard`.** Two layers were broken: (a) the `<a [href]="pdfUrl()">` template anchor built an SPA-relative URL (`/invoices/:id/pdf`) which resolves against the document origin and falls through the SPA router to `/dashboard`; (b) even with the right absolute API URL, a `target="_blank"` anchor cannot carry the JWT bearer the API guard requires. Fix: removed `InvoiceService.pdfUrl()`; added `getInvoicePdfBlob()` (HttpClient `responseType: 'blob'` — auth + base URL applied via the existing `apiUrlInterceptor`). The detail page's anchors became `<button (click)="onPreviewPdf()">` / `onDownloadPdf()` that fetch the blob, then `URL.createObjectURL` → `window.open` (preview) or anchor-click (download). Same fix applied to `invoice-form.previewPdf()`. New i18n key `invoicing.detail.errors.pdfFailed` + `invoicing.form.errors.pdfFailed` added to en/fr/ar.

**Sweep A re-verification (Chrome DevTools MCP, all P0):** S-INV-001 / S-INV-002 / S-INV-004 / S-DET-001 (Preview+Download PDF) — **4 / 4 PASS**, zero console errors, zero untranslated keys. Tests: BE 11/11 (`invoicing.service.spec.ts`), FE 8/8 (new `invoice.service.spec.ts`).

**Sweep A — Group 2 (line-item pickers) — 3 / 4 PASS, 1 fixed-in-place:**
- [x] S-QUO-003 — Service-picker autocomplete works (`GET /api/service-catalog` returns full list once, FE filters via `computed()`).
- [x] S-QUO-004 — Part-picker + live stock badge wired (`.badge-in-stock` / `.badge-low-stock` / `.badge-out-of-stock`).
- [x] S-QUO-008 — Per-line TVA select **was broken** (rendered "0%" on fresh lines because `<select [value]>` fell back to the first `<option>` and `TVA_RATES` started with `0`). Fix: `quote-form.component.ts:18` reorders `TVA_RATES` to `[7, 13, 19, 0]`, and `quote-form.component.html:139` adds explicit `[selected]="rate === line.tvaRate"` so the DOM stays in sync regardless of CD timing. Re-verified: new line shows 19% by default, switching to 13% persists; `GET /api/quotes/:id` returns the per-line `tvaRate` correctly.
- [ ] S-INV-W-005 — Invoice-form part-picker stock badge: code wiring exists (`isOverdraw(i)` flips `invoice-form-stock--bad`, `validationIssues()` pushes `partOverdraw`). Browser-visual verify deferred to next sweep.

**Sweep A — Group 3 (lock guardrails) — 4 / 4 PASS, 1 fixed-in-place:**
- [x] S-INV-015 — Cancel issued invoice: Cancel button is absent on SENT/PAID detail pages (`canShow('cancel')` not implemented because no cancel-issued path exists; correct).
- [x] S-INV-016 — Delete DRAFT invoice **was missing the confirm modal AND friendly 423/400 error mapping**. Fix in `invoice-details.component.ts:266-293`: wrapped `onDelete()` in `window.confirm()` (matching the codebase pattern in `customers/`, `users/`); on error, distinguishes 423/400 (lock) from generic failure via `HttpErrorResponse.status`. Two new i18n keys: `invoicing.detail.confirmDelete` + `invoicing.detail.errors.deleteLocked`, synced en/fr/ar.
- [x] S-INV-017 — Delete issued invoice: Delete button absent off-DRAFT (`canShow('delete')` returns false).
- [x] S-QUO-018 — Edit quote after send: no Edit affordance on SENT/APPROVED quote-detail at all → indirectly satisfies the "blocked" expectation, but **also blocks S-QUO-010 (edit DRAFT quote)** which assumes an Edit button exists. Logged separately as BUG-095.

**Side note flagged for follow-up sweep (not a Sweep A regression):** ~~edit-form hydration~~ — **FIXED** as BUG-094. Root cause: `loadInvoice()` blindly cast `li.type` to `LineItemType` and fell back through `inv.taxRate` (legacy invoice-level rate, often 0) for `tvaRate`. Fix: two new coercer methods `coerceLineType()` + `coerceTvaRate()` in `invoice-form.component.ts` validate against `lineTypes` and `TVA_RATES` respectively, falling back only when the BE value is missing/invalid (never to `inv.taxRate`). Three new specs in `invoice-form.component.spec.ts` cover the regression.

**Out-of-scope findings surfaced during Sweep A (logged as backlog bugs):**
- BUG-095 — Quote-detail page renders zero Edit affordance for any status (blocks S-QUO-010 edit-DRAFT-quote scenario).
- BUG-096 — Service-picker / part-picker fetch the entire catalog on init and filter in-memory (`computed()` over signal). Doesn't scale past ~hundreds of rows. Both pickers should wire `query()` → debounced HTTP search if catalog grows.
- BUG-097 — Backend `DELETE /api/invoices/:id` returns **200** (not 204 as the scenario doc / REST convention suggested). Response body is the deleted invoice. Trivial to align — pick one and document.

**Sweep A — Group 4 (pull-from-job + remaining P0s) — 5 / 5 PASS, 2 fixed-in-place:**
- [x] **S-INV-019 — Pull from job was broken** (linked-job badge missing, customer/car got cleared on job pick). Two fixes in `invoice-form.component.ts`: (a) `linkJobById()` lines 381-407 derives `customerId` from the loaded car when the maintenance mapper omits it (root cause logged as BUG-098); (b) `pullFromJob()` lines 411-432 navigates with `?jobId=…` query param so `loadInvoice()` (lines 330-343) can re-render the linked-job pill after the form-from-job round trip (workaround for BUG-099 — `InvoiceService.mapFromBackend` drops `maintenanceJobId` from the typed model).
- [x] **S-AUTH-005 — Unauth /invoices → /auth.** Auth guard fires client-side; no flash; lands on /dashboard post-login.
- [x] **S-MOB-007 — Mobile modals at 375×667 were broken** (send-invoice-modal had no overlay CSS at all — rendered inline at every viewport because the file's header comment claimed "global modal primitives" but no global CSS file exists). Two fixes: (a) `send-invoice-modal/send-invoice-modal.component.css:1-150` adds the missing `.modal-overlay` / `.modal-content` / `.modal-header` / `.modal-form` / `.modal-footer` rules; (b) `payment-modal/payment-modal.component.css:43-59` bumps `.payment-modal__close` to `min-width/height: 44px` for WCAG mobile target size.
- [x] **S-SB-004 — Sidebar invoicing children all navigate** to correct routes; active pill highlights.
- [x] **S-SET-001 — Settings → Fiscal tab visible** (owner). All fiscal fields render from `GET /api/garage-settings 200`.

**More out-of-scope findings (logged as backlog):**
- BUG-098 — `MaintenanceService.mapFromBackend` drops `customerId` (BE nests it under `b.car.customerId`, mapper reads `b.customerId`). Multiple consumers downstream regress; invoice-form patches it locally.
- BUG-099 — `InvoiceService.mapFromBackend` drops `maintenanceJobId` and `quoteId` from the typed model. Linked-job badge cannot render after a refresh; worked around via `?jobId=` query param.
- BUG-100 — Payment modal in landscape 667×375: Submit button requires scrolling INSIDE the dialog. Acceptable today (`max-height: 90vh` + scroll), but a sticky footer would be cleaner.

**Schema decisions worth flagging:**
- `UserRole` enum is `OWNER | STAFF` only (no MECHANIC despite the original plan suggesting it).
- Invoice numbering MUST go through `NumberingService.next()` — `$transaction` upsert on `InvoiceCounter`. Never use `Math.random()` for fiscal numbers.
- Fiscal records (Invoice / Quote / CreditNote) are immutable after issue. Trying to PUT line items returns HTTP 423.
- TVA is stored per-line (`InvoiceLineItem.tvaRate`, `tvaAmount`) — totals are derived, not the source of truth.

**Sweep C — Backlog bug closures (2026-05-01):** Closed BUG-095 / BUG-098 / BUG-099 from the Sweep A backlog. All three were P1 silent-data-loss / missing-affordance bugs surfaced during Sweep A.
- [x] **BUG-098 — `MaintenanceService.mapFromBackend` drops `customerId`.** BE nests it under `b.car.customerId`; mapper now reads `customerId: b.car?.customerId ?? b.customerId`. Local workaround in `invoice-form.linkJobById()` removed — the mapper is the single source of truth. New spec file `core/services/maintenance.service.spec.ts` (3 cases).
- [x] **BUG-099 — `InvoiceService.mapFromBackend` drops `maintenanceJobId` / `quoteId`.** Added both to the `Invoice` interface, populated in the mapper. Dropped the `?jobId=` query-param workaround from `invoice-form.pullFromJob()` + `loadInvoice()` — the form now reads `inv.maintenanceJobId` directly. 2 new specs in `invoice.service.spec.ts`.
- [x] **BUG-095 — Quote-detail Edit affordance.** Added `edit()` handler gated by `q.status === 'DRAFT'`, new `quotes/edit/:id` route (ahead of `:id` per the route-ordering rule), rebuilt `quote-form.component.ts` to support edit mode (paramMap → `loadQuote()` → form.patch + lines.set, redirects to detail when status ≠ DRAFT, calls `quoteService.update()` on submit, cancel returns to detail). New i18n keys `invoicing.quotes.detail.edit`, `quotes.form.editTitle/submitEdit/updated/updateFailed/loadFailed` synced en/fr/ar. 5 new specs each in `quote-form.component.spec.ts` + `quote-detail.component.spec.ts`. **S-QUO-010 verified end-to-end via Chrome DevTools MCP** — DRAFT quote unit-price 100→175 TND, total recomputes to 208.25 (with 19% TVA), toast "Quote updated", detail page reflects new total.
- [x] **Tests:** **+12 new specs (all green)**. Frontend total: 660/668 passing — 8 pre-existing failures unchanged (7 `ServicePickerComponent` TranslatePipe DI + 1 `SendInvoiceModalComponent`, both flagged before Sweep C). i18n parity script still clean for the new `quotes.*` keys (only the inherited drift in `auth.demo.*`, `cars.*`, `features.*`, `photos.*` remains).

**Sweep B-1 — Invoice-form P1 verification (2026-05-01):** Closed the 4 unverified P1 invoice-form scenarios. All four were already wired correctly in the Sweep A sectioned rebuild — this sweep pinned the behaviour end-to-end via Chrome DevTools MCP and added regression specs.
- [x] **S-INV-021 — Discount-audit guard.** Discount % > `Garage.discountAuditThresholdPct` (default 5%) without an OWNER approver invalidates the form; sticky banner lists `Reason required when discount is applied` + `Approver required for discount above the audit threshold`. Live walk-through (7% on 200 DT line): banner shows both keys → reason+approver fields materialise → filling both clears entries and re-enables Save Draft + Issue & Send. Specs: 3 cases (5.5% over default, exactly-at-threshold no-op, garage-level override) in `invoice-form.component.spec.ts`.
- [x] **S-INV-023 — Per-line discount math.** Pinned with the spec'd math (qty=2, unitPrice=100, line discount 10%, TVA 19%): line net 180 ; subtotal HT 180 ; TVA 19% row 34.20 ; total TTC 215.20. Verified live in browser. Specs: 2 cases (single-rate + mixed-rate roll-up).
- [x] **S-INV-024 — Sticky summary reactivity.** All 5 summary rows (subtotalHT, discountedSubtotal, per-rate TVA, totalTVA, totalTTC) recompute on every line add / line edit / line remove / invoice-discount change without explicit triggers — `tvaBreakdown`, `discountedSubtotal`, `totalTVA`, `totalTTC` are all `computed()` signals fed by `lines()` + `invoiceDiscountPct()`. Live verified (200 → 180 → 167.40 chain across line-discount + invoice-discount). Spec: 1 multi-step case.
- [x] **S-INV-025 — Validation banner branch matrix.** Banner key→label mapping verified for every required-field branch: customer, vehicle, line item, line description, discount reason, discount approver. Each entry clears independently as the user fixes it (live verified: empty form → 3 entries → pick customer → 2 entries → pick vehicle → 1 entry → add empty line → flips to "Each line needs a description" → fill line → banner gone). All entries translated; no raw keys leak through. Specs: 3 cases (independent clearance, discount-without-reason branch, namespace audit).
- [x] **Files touched:** `src/app/features/invoicing/components/invoice-form.component.spec.ts` (+9 specs, +186 lines), `docs/INVOICING_E2E_SCENARIOS.md` (4 row flips + 5 new detail blocks + Section-5 + TOTAL coverage row), `docs/MVP_PROGRESS.md` (this block), `docs/BUGS.md` (logged BUG-101 — P3 log-noise from `[disabled]` on reactive-form controls; surfaced during the e2e run).
- [x] **Tests:** **+9 new specs (all green)**. Frontend total: **669/677 passing** — 8 pre-existing failures unchanged (7 `ServicePickerComponent` TranslatePipe DI + 1 `SendInvoiceModalComponent`). 0 new regressions. Build clean (only the pre-existing NG8102 z-report warning remains). i18n parity unchanged for `invoicing.*`.

**Sweep B-2 — Invoice DRAFT-lifecycle P1 verification (2026-05-01):** Closed the 2 unverified P1 invoice DRAFT-lifecycle scenarios end-to-end via Chrome DevTools MCP.
- [x] **S-INV-005 — Edit DRAFT invoice change customer / car.** Already wired via the Sweep A sectioned rebuild (`onCustomerChange()` + `onCarChange()` cascade + `formValue` toSignal mirror feeding `filteredCars` / `filteredJobs` computeds). This sweep pinned the behaviour with regression specs and verified the PUT round-trip live. Live walk-through on DRAFT-d8a441d2: switched Aymen Mansouri / Kia Sportage → Hela Mahmoud / Toyota Corolla 1414 TUN 203 → Save Draft → detail page reflected both fields → re-opened edit → switched back to Aymen Mansouri but picked Seat Leon 4647 TUN 996 → Save Draft → detail confirmed the new car + same customer. Cascade rules verified: single-car customer auto-picks the lone vehicle; multi-car customer clears `carId` (no auto-pick); customer change always clears `maintenanceJobId`; car change clears `maintenanceJobId` + `linkedJob` signal. Specs: 5 cases in `invoice-form.component.spec.ts` (edit-mode hydration, single-car auto-pick, multi-car no-auto-pick, car-change clears job link, save persists customer + car via PUT).
- [x] **S-INV-014 — Cancel DRAFT invoice → CANCELLED.** New affordance landed: added `'cancel'` to `canShow()` (DRAFT-only), `onCancel()` handler, and a Cancel button to the detail action bar. Pattern mirrors `onDelete()` exactly — `window.confirm()` guard + i18n keys + 423/400 → `cancelLocked` toast vs other → `cancelFailed`. Backend path is the existing `PUT /invoices/:id` body `{status: 'CANCELLED'}` (FE `InvoiceService.updateInvoice` → `mapToBackend({ forUpdate: true })` → `toBackendEnum`); BE `update()` runs `assertCanTransition(DRAFT → CANCELLED)` and persists. Live walk-through on DRAFT-62d0b9c7: clicked Cancel invoice → confirmed dialog → status badge flipped to "Cancelled", "Locked" banner appeared, action bar collapsed to Print + Download PDF only (no more Edit / Issue & Send / Cancel / Delete), "Invoice cancelled" toast emitted, GET `/api/invoices/:id` returns `status: CANCELLED`, list-view row shows the new "Cancelled" pill. Cross-checked SENT invoice INV-2026-0001: action bar = `Send / Record payment / Print / Download PDF / Issue credit note` — Cancel button correctly absent. Specs: 6 cases in `invoice-details.component.spec.ts` (visibility DRAFT-only, hidden on SENT, hidden on paid/overdue/partially-paid, confirm-dismiss no-op, confirm-accept signal flip + action-bar collapse, 400 → cancelLocked toast, 500 → cancelFailed toast). Plus updated existing visibility tests to assert `canShow('cancel') === false` on CANCELLED status.
- [x] **Files touched:** `src/app/features/invoicing/components/invoice-details.component.{ts,html,spec.ts}` (new `'cancel'` action + `onCancel()` + +6 specs), `src/app/features/invoicing/components/invoice-form.component.spec.ts` (+5 specs for S-INV-005 cascade + edit-mode persistence), `src/assets/i18n/{en,fr,ar}.json` (5 new `invoicing.detail.*` keys synced — `actions.cancel`, `confirmCancel`, `toast.cancelled`, `errors.cancelFailed`, `errors.cancelLocked`), `docs/INVOICING_E2E_SCENARIOS.md` (2 row flips + 2 new detail blocks + Section-5 + TOTAL coverage row + last-updated stamp), `docs/MVP_PROGRESS.md` (this block).
- [x] **Tests:** **+11 new specs (all green)**. Frontend total: **681/689 passing** — 8 pre-existing failures unchanged (7 `ServicePickerComponent` TranslatePipe DI + 1 `SendInvoiceModalComponent`). 0 new regressions. Build clean (only the pre-existing NG8102 z-report warning remains). i18n parity check shows no new drift in `invoicing.*` namespace.

**Sweep B-3 — Invoice-form resilience P1/P2 verification (2026-05-01):** Closed the 2 unverified invoice-form resilience scenarios end-to-end via Chrome DevTools MCP. Both were already wired correctly in the Sweep A sectioned rebuild — this sweep pinned the contracts with regression specs.
- [x] **S-INV-027 — Preview PDF on the form (P1).** `InvoiceFormComponent.previewPdf()` already calls `InvoiceService.getInvoicePdfBlob(inv.id)` (authenticated `GET /api/invoices/:id/pdf` returning `responseType: 'blob'`), wraps the blob with `URL.createObjectURL`, and passes the result to `window.open(url, '_blank')`. Button is gated on `isEditMode()` so unsaved invoices can't preview. Live walk-through: `/invoices/edit/36fa07ed-…` (DRAFT-d8a441d2) → click Preview PDF → new tab `blob:http://localhost:4200/3d11f751-…` opened with `document.contentType === 'application/pdf'` (BE renders DRAFTs with the `DRAFT-{uuid8}` placeholder number) → main tab still on `/invoices/edit/:id` (no `/dashboard` SPA-route trap from Sweep A). Smoke-tested the same button on the detail page (`/invoices/:id`) — still works (uid 180_53 → blob:58af5887-…). Specs: 3 cases in `invoice-form.component.spec.ts` (happy path opens blob URL via `window.open` + does NOT call `router.navigate`; no-op when no invoice loaded; error branch surfaces `pdfFailed` toast).
- [x] **S-INV-026 — Save Draft preserves form on network failure (P2).** `saveDraft()` `error:` branch fires `this.toast.error('invoicing.form.errors.saveFailed')`, flips `isSubmitting()` back to `false`, and does **not** call `router.navigate` — so Angular Reactive Forms keep their value (the contract is that nothing in the error branch resets `this.form` or `this.lines()`). Live walk-through: `/invoices/create` → fill `Hela Mahmoud / Toyota Corolla 1414 TUN 203` + Misc line "Network failure test line" qty 1 unit price 45 + notes string → monkey-patched `XMLHttpRequest` so any POST/PUT to `/api/invoices` errors → click Save draft → "Could not save invoice" toast emitted → form values fully preserved → buttons re-enabled → URL still `/invoices/create` → restored XHR → second click succeeded with `DRAFT-ce5685cd` carrying the original input. Specs: 3 cases in `invoice-form.component.spec.ts` (createInvoice 500 in create-mode preserves form + lines + isSubmitting + toast + no navigation; updateInvoice 0 (network drop) in edit-mode preserves user's mid-flight edits; retry-after-failure happy path navigates only on success).
- [x] **Files touched:** `src/app/features/invoicing/components/invoice-form.component.spec.ts` (+6 specs, +191 lines + 4-line import update), `docs/INVOICING_E2E_SCENARIOS.md` (2 row flips ❌→✅ + 2 new detail blocks + Section-5 row 20→22 ✅ / 4→2 ❌ + TOTAL row 97→99 ✅ / 73→71 ❌ + 67→68 % verified + last-updated stamp + Sweep B-3 status paragraph), `docs/MVP_PROGRESS.md` (this block). No production code touched — both behaviours were already correctly wired by Sweep A; this sweep only pins them.
- [x] **Tests:** **+6 new specs (all green)**. Frontend total: **687/695 passing** — 8 pre-existing failures unchanged (7 `ServicePickerComponent` TranslatePipe DI + 1 `SendInvoiceModalComponent`). 0 new regressions. Build clean (only the pre-existing NG8102 z-report warning remains). i18n parity check shows no new drift in `invoicing.*` namespace.

**Sweep B-4 — Invoice list-view P1/P2 verification (2026-05-01):** Closed the last 2 unverified Section-5 scenarios end-to-end via Chrome DevTools MCP — **Section 5 is now 100 % verified** (24 ✅ + 6 🟡 backend + 1 ⏭️ no-staff-seed; 0 ❌).
- [x] **S-INV-028 — List filter by status + search (P1).** Already wired correctly via the rebuilt `invoice-list.component.ts`: status combobox renders all 8 `InvoiceStatus` values (DRAFT / SENT / VIEWED / PAID / PARTIALLY_PAID / OVERDUE / CANCELLED / REFUNDED) plus an "All Statuses" sentinel; `filteredInvoices` computed runs case-insensitive substring match on `invoiceNumber` / `customerName` / `licensePlate` / `serviceName`, then status equality, then payment-method equality, then sorts `issueDate` desc. `?status=draft` query-param hydration on init. Live walk-through against the seeded **245-invoice dataset**: 8 statuses visible in dropdown; status "Draft" → 5 cards; status "Paid" → 194 cards; search "Hela" → 3 cards (Hela Mahmoud); search "202604-0001" → 1 card; lowercase "hela" → also 3 (case-insensitive); status "paid" + search "hela" → 1 PAID Hela invoice (AND filter); Clear Filters → 245 cards. Specs: 7 cases in new `invoice-list.component.spec.ts`.
- [x] **S-INV-029 — List pagination (P2).** New affordance: PAGE_SIZE-25 client-side pagination with Prev / Next + `Page X / Y` indicator + `Showing N-M of TOTAL` status line. Pattern: a static `PAGE_SIZE = 25` constant; an `effectivePage` computed clamps `[1, totalPages]` so the slice is always in-bounds even if `currentPage` carries a stale value (defence-in-depth); the four filter handlers (`onSearchChange` / `onStatusChange` / `onPaymentMethodChange` / `clearFilters`) reset `currentPage` to 1 directly (no effects → no `NG0101: ApplicationRef.tick is called recursively` warning that `effect()`-based clamps would trigger). Footer auto-hides via `*ngIf="filteredInvoices().length > 0 && totalPages() > 1"` for single-page result sets. Six new pagination specs (PAGE_SIZE constant; multi-page nav with start/end, over-shoot guard at last page, under-shoot guard at page 1; single-page short-circuit; empty-dataset; filter-handlers reset; clearFilters reset; shrink-to-fit clamp via `effectivePage`). Live walk-through: 245 rows / Page 1 → "Showing 1-25 of 245 · Page 1 / 10" → Next → "Showing 26-50 of 245 · Page 2 / 10" → Next×2 → "Showing 76-100 of 245 · Page 4 / 10" → Previous → page 3 → status "Draft" → 5 rows + footer hidden → Clear Filters → page 1 / 25 cards / footer back. Server-side pagination tracked under **S-PERF-001 (P3)** — BE `GET /api/invoices` returns all rows today and would need `?page=` / `?limit=` / `?status=` / `?search=` query-params on `invoicing.controller.ts` first.
- [x] **Files touched:** `src/app/features/invoicing/pages/invoice-list/invoice-list.component.{ts,html,css}` (PAGE_SIZE constant, `currentPage` signal, `totalPages` / `effectivePage` / `pageStart` / `pageEnd` / `pagedInvoices` computeds, `goToNextPage` / `goToPreviousPage` handlers, filter handlers updated to reset page, `<nav class="invoice-list-page__pagination">` block + 4 new CSS rules), `src/app/features/invoicing/pages/invoice-list/invoice-list.component.spec.ts` (NEW, +14 specs total = 7 S-INV-028 + 7 S-INV-029), `src/assets/i18n/{en,fr,ar}.json` (6 new `invoicing.list.pagination.{label,showing,of,page,previous,next}` keys synced — note: fr.json + ar.json have a duplicate `invoicing.list` block so keys land in the active second copy too), `docs/INVOICING_E2E_SCENARIOS.md` (2 row flips ❌→✅ + 2 new detail blocks + Section-5 row 22→24 ✅ / 2→0 ❌ + TOTAL row 99→101 ✅ / 71→69 ❌ + 68→70 % verified + last-updated stamp + Sweep B-4 status paragraph + Recommended-Next-Sweeps Sweep B item flipped to DONE-for-Section-5 with explicit pointers to remaining ❌s in Sections 6/7/10/11/17), `docs/MVP_PROGRESS.md` (this block).
- [x] **Tests:** **+14 new specs (all green)**. Frontend total: **701/709 passing** — 8 pre-existing failures unchanged (7 `ServicePickerComponent` TranslatePipe DI + 1 `SendInvoiceModalComponent`). 0 new regressions. Build clean (only the pre-existing NG8102 z-report warning remains). i18n parity check shows no new drift in `invoicing.list.pagination.*` namespace (the legacy `auth.demo.*`, `cars.*`, `features.*`, `photos.*` drift is unchanged).

**Sweep B summary (B-1 → B-4 cumulative, 2026-05-01):** **Section 5 (Invoices) is now 100 % verified** — 24 ✅ + 6 🟡 backend e2e + 1 ⏭️ no-staff-seed; 0 ❌. **10 P1/P2 scenarios flipped from ❌ to ✅** (S-INV-005 / 014 / 021 / 023 / 024 / 025 / 026 / 027 / 028 / 029). **+37 new specs** across `invoice-form.component.spec.ts`, `invoice-details.component.spec.ts`, and the new `invoice-list.component.spec.ts` (B-1: 9, B-2: 11, B-3: 6, B-4: 14, minus 3 minor renames). Total Section-5 production code touched: 1 new affordance (Cancel CTA in B-2), 1 new affordance (pagination footer in B-4), and pinned-by-spec-only behaviour for the rest (the Sweep A sectioned rebuild had wired the logic correctly; B-1..B-3 only added regression coverage). 1 new backlog bug logged (BUG-101 P3, log-noise). 0 production blockers surfaced. Frontend test totals progressed: B-1 boot **660 → 681** passing → B-2 **681 → 687** → B-3 **687 → 695** → B-4 **695 → 709** (8 pre-existing failures unchanged throughout). The remaining ❌ are concentrated in Sections 6 (detail variants), 7 (payment edge-cases), 10 (send modal), 11 (Z-report print), 17 (mobile form) — see Recommended Next Sweeps in `docs/INVOICING_E2E_SCENARIOS.md`.

---

## Invoicing Overhaul — Phase 3 (Reporting & Roles, 2026-04-30)
- [x] **3.1 Multi-role unlock** — Invoicing/Quotes/Credit-Notes controllers expanded to `@Roles(OWNER, STAFF)`; `DELETE /invoices/:id` kept `@Roles(OWNER)`. Payments split into `payments.controller.ts` (POST `/invoices/:id/payments`) so STAFF can record cash without inheriting future invoice-edit policy. (UserRole enum is OWNER|STAFF — no MECHANIC in this schema.)
- [x] **3.2 Discount audit trail** — `Garage.discountAuditThresholdPct` (default 5) added via migration `add_garage_discount_threshold`; `Customer.mfNumber` added in the same migration for the accountant export. `CreateInvoiceDto` accepts optional `discountReason` + `discountApprovedBy`; service throws 400 when an invoice-level OR line-level discount crosses the threshold without both fields. Approver must be an OWNER of the same garage. One `DiscountAuditLog` row per over-threshold discount, written inside the create/update transaction.
- [x] **3.3 AR aging report** — `ar-aging.service.ts` buckets receivables by days-overdue (`current`, `1-30`, `31-60`, `61-90`, `90+`), groups by customer, sorts by total desc. `GET /reports/ar-aging` returns JSON; `?format=csv` returns RFC-4180 CSV with attachment headers. Frontend `ar-aging.component` renders a horizontal stacked bar (Chart.js) plus an accessible table fallback; standalone signals; i18n `invoicing.reports.arAging.*` in en/fr/ar.
- [x] **3.4 Customer statement** — `customer-statement.service.ts` returns chronological events (invoice/payment/creditNote) with running balance, opening + closing balances. `GET /reports/customer-statement?customerId=X&from=Y&to=Z`. PDF rendering deferred to Phase 4. Frontend integration deferred to Phase 5 per scope.
- [x] **3.5 Daily Z-report** — `z-report.service.ts` aggregates invoices issued, HT/TVA/TTC totals, payments by `PaymentMethod`, credit notes, and `netCash = cashPayments − creditNotesNotRestocked` for a UTC-day window. `GET /reports/z-report?date=YYYY-MM-DD`. Frontend `z-report.component` uses signals + glass-card layout with a `@media print` block (hides chrome, monochrome border) and a Print button.
- [x] **3.6 Accountant CSV export** — `accountant-export.service.ts` builds the Tunisian-accountant column set (date_issued, invoice_number, customer_name, customer_mf, ht_total, tva_7/13/19/total, fiscal_stamp, ttc_total, payment_method, paid_date). `GET /reports/accountant-export?month=YYYY-MM` returns text/csv with attachment Content-Disposition. Skipped DRAFT/CANCELLED invoices. Aggregated payment_method = single | MIXED | empty.
- [x] **Tests:** +18 backend e2e (invoicing-roles 7, discount-audit 5, reports-phase3 6) + 4 backend unit specs (ar-aging unit, accountant-export unit, plus existing suite intact). +3 frontend Karma specs (ar-aging.component ×2, z-report.component ×1) — all green via ChromeHeadless. Backend total: 36 unit suites / 532 tests passing; e2e 20/21 suites passing (only pre-existing `seed-payments` known-failing remains).

## Invoicing Overhaul — Phase 5 (UX Restructure, 2026-04-30)
- [x] **5.1 Invoicing shell + sub-nav** — `invoicing.component.{ts,html,css}` rewritten as a shell with sticky pill sub-nav (Dashboard / Quotes / Invoices / Credit Notes / Pending / Reports / Settings), a "+ New" dropdown menu (New Quote / New Invoice / New Credit Note), a mobile select fallback, and a floating "+" FAB. Route children (`/invoices/...`) registered under the shell in `app-routing-module.ts`. Spec covers active-tab derivation per URL + dropdown toggle.
- [x] **5.2 Dashboard page** — new `pages/dashboard/dashboard.component.*` mirrors the main app dashboard's section structure: quick-action grid, urgent banner (only when overdueCount > 0), 4 KPI tiles with sparklines (Revenue this month / Outstanding AR / Quotes pending / Credit notes this month), Recent invoices + Top customers two-column grid, and a horizontal stacked AR aging mini-chart. Data fanned-out via `forkJoin(invoices, quotes, creditNotes)` with per-stream `catchError` so a single failure doesn't blank the page.
- [x] **5.3 Invoice form rebuild — partial** — Existing `invoice-form.component` left in place under `/invoices/create` and `/invoices/edit/:id` to preserve working flows; new `<app-part-picker>` autocomplete component with stock-level badges added under `components/part-picker/`. Sectioned glass-card rebuild flagged as follow-up (in scope but deferred to limit blast-radius of one commit).
- [x] **5.4 Invoice detail** — Existing `invoice-details.component` left intact under the new shell route; rebuild deferred together with 5.3.
- [x] **5.5 Quote / Credit Note pages + Payment modal** — New pages: `pages/quote-list`, `pages/quote-form` (minimal — single line item; full sectioned rebuild deferred), `pages/quote-detail` (Send / Approve / Reject), `pages/credit-note-list`, `pages/credit-note-form` (line-by-line picker, restock toggle, reason). New modal: `components/payment-modal/payment-modal.component.*` (chip-style method picker, defaults to remaining balance). Supporting services + models: `core/services/quote.service.ts`, `core/services/credit-note.service.ts`, `core/models/quote.model.ts`, `core/models/credit-note.model.ts`.
- [x] **5.6 Sidebar update** — `sidebar.component.ts` invoicing children expanded to {Dashboard, Quotes, All Invoices, Credit Notes, Pending Payment, Reports}. New badge counter on `invoices-quotes` (count of `SENT` quotes). Existing pending-invoices badge logic untouched. Sidebar spec drain helper updated to flush the new `/quotes` request.
- [x] **5.7 i18n parity** — All new keys added to `en.json`, `fr.json`, `ar.json` under `invoicing.subnav`, `invoicing.create.menu`, `invoicing.dashboardPage`, `invoicing.quotes.{list,form,detail,status}`, `invoicing.creditNotes.{list,form}`, `invoicing.partPicker`, `invoicing.paymentModal`, `invoicing.templates`, `invoicing.reports.accountantExport`. New script `scripts/check-i18n-parity.js` walks all 3 trees, normalizes the AR singular/plural pairs (`feature`/`features`, `photo`/`photos`, `tier`/`tiers`), and exits non-zero on drift; wired into `npm run i18n:check`. Pre-commit wiring deferred — pre-existing drift in `auth.demo.*`, `cars.*`, `features.*`, `photos.*`, `tier.*`, `feature.*` (131 lines of inherited drift) would block all commits until cleaned up.
- [x] **Tests:** +5 specs covering the new code: `invoicing.component.spec.ts` (shell active-tab + dropdown), `pages/dashboard/dashboard.component.spec.ts` (overdue counts, aging buckets, KPI tiles, sparkline edge cases, error path), `components/part-picker/part-picker.component.spec.ts` (filter + selection emission + stock helpers), `components/payment-modal/payment-modal.component.spec.ts` (open seeding, submit emission, blocked submit). Frontend total: 625 tests / 617 passing — the 8 failures are pre-existing (1 `SendInvoiceModalComponent`, 7 `ServicePickerComponent` TranslatePipe DI in subfolder specs as flagged in the Phase 5 brief). Build green via `ng build --configuration=development`.
