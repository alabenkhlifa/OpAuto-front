# OpAuto MVP Implementation Progress

> **Session handoff (2026-04-26):** 6 commits landed this session (`87b41e5` → latest) building the AI Orchestrator backend end-to-end (Phases 0, 1, 2, 4, 5 backend). 50+ source files, 227 tests across 17 suites, 28 tools registered, 4 skills × 3 locales, 3 sub-agents, Groq-first/Claude-fallback LLM gateway with SSE streaming, blast-tier-based approval flow, rate limiting + cost cap + expiry cron. **Blocked:** Phase 3 (frontend chat widget) waits on the user's uncommitted pricing-feature work in `src/`. **Action items for the user:** (1) `cd opauto-backend && npm run prisma:migrate` once DB is reachable; (2) set `GROQ_API_KEY`/`ANTHROPIC_API_KEY`/`RESEND_*` env vars; (3) commit or stash the pricing-feature work in `src/` before launching Phase 3. Full design + plan: `docs/superpowers/specs/2026-04-26-ai-orchestrator-design.md`.
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
