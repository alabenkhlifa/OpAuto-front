# OpAuto Invoicing Overhaul — Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per project memory, this plan is intentionally **conceptual** — no code snippets. Implementation code is written at task time, not in the plan.

**Goal:** Turn invoicing from "demo" into a Tunisian-fiscal-compliant garage system: job→invoice→inventory wiring, fiscal numbering + immutability + credit notes, PDF + delivery, plus reporting and multi-role workflow. UX follows the existing dashboard component language.

**Architecture:** 6 phases, ~32 tasks. Phase 1 is sequential (schema is the bottleneck). Phases 2–5 fan out as four parallel tracks via separate agents. Phase 6 is full test sweep + e2e-validator. Every task ends with a test-writer agent dispatch (unit + integration). Tests run against a dedicated `opauto_test` database.

**Tech Stack:** NestJS 10 + Prisma + PostgreSQL backend; Angular 20 standalone components + signals frontend; Resend for email; **pdfkit** (programmatic, ~10MB, no headless browser) for PDF; existing Groq/Claude AI gateway is out of scope here.

**Pre-decided choices** (locked at planning time):
- PDF library: **pdfkit** (rejected Puppeteer for deploy-size reasons)
- WhatsApp v1: **wa.me link** (Business API deferred)
- Scope: **all 6 phases** (no incremental cutoff)

---

## File Map

### Backend (`opauto-backend/`)
- `prisma/schema.prisma` — extend `Invoice`, `InvoiceLineItem`, `Garage`; add `Quote`, `CreditNote`, `InvoiceCounter`, `ServiceCatalog`, `DiscountAuditLog`, `DeliveryLog`
- `prisma/seed-test.ts` (new) — deterministic test fixtures
- `src/invoicing/` — split:
  - `invoicing.service.ts` (refactor for state machine + immutability)
  - `numbering.service.ts` (new)
  - `tax-calculator.service.ts` (new)
  - `from-job.service.ts` (new)
  - `pdf-renderer.service.ts` (new — pdfkit)
  - `delivery.service.ts` (new)
  - `invoice-state.ts` (new — state machine)
  - `quotes.controller.ts` + `quotes.service.ts` (new)
  - `credit-notes.controller.ts` + `credit-notes.service.ts` (new)
  - `payments.controller.ts` (split out of invoicing.controller.ts)
- `src/services-catalog/` (new module — labor/service rates)
- `src/inventory/inventory.service.ts` (extend for sale + restock)
- `src/maintenance/maintenance.service.ts` (extend — emit ready-to-invoice)
- `src/reports/` — `ar-aging`, `customer-statement`, `z-report`, `accountant-export`
- `src/garage-settings/` (extend — fiscal identity)
- `src/public/invoice-public.controller.ts` (new — public token-gated PDF view)
- `.env.test` (new)

### Frontend (`src/app/features/invoicing/`)
- `invoicing.component.*` — restructure as shell with sub-nav
- `pages/` (new sub-route shells): `dashboard/`, `quotes/`, `list/`, `pending/`, `credit-notes/`, `reports/`, `templates/`, `settings/`
- `components/`:
  - `invoice-form.component.*` (rebuild)
  - `invoice-details.component.*` (rebuild)
  - `invoice-pdf-preview.component.*` (new)
  - `quote-form.component.*` (new)
  - `quote-list.component.*` (new)
  - `credit-note-form.component.*` (new)
  - `credit-note-list.component.*` (new)
  - `payment-modal.component.*` (new)
  - `send-invoice-modal.component.*` (new)
  - `service-picker.component.*` (new — autocomplete from catalog)
  - `part-picker.component.*` (new — autocomplete with stock badge)
  - `ar-aging.component.*` (new)
  - `z-report.component.*` (new)
- `services/` (new): `invoice.service.ts`, `quote.service.ts`, `credit-note.service.ts`, `service-catalog.service.ts`, `payment.service.ts`
- `core/models/`: extend `invoice.model.ts`; add `quote.model.ts`, `credit-note.model.ts`, `service-catalog.model.ts`
- `shared/components/sidebar/sidebar.component.ts` — expand invoicing group children
- `assets/i18n/{en,fr,ar}.json` — all new keys
- Routes added in `app-routing-module.ts`

---

## Phase 1 — Fiscal Foundation *(sequential — blocks Phases 2–5)*

### Task 1.1 — Prisma schema extension
**Files:** `opauto-backend/prisma/schema.prisma`
- [ ] Add to `Invoice`: `appointmentId?`, `maintenanceJobId?`, `currency` default `TND`, `fiscalStamp` default 1.0, `lockedAt?`, `lockedBy?`, `issuedNumber?` (gapless seq for fiscal year), `discountReason?`, `discountApprovedBy?`, `quoteId?`
- [ ] Add to `InvoiceLineItem`: `partId?`, `serviceCode?`, `mechanicId?`, `laborHours?`, `tvaRate`, `tvaAmount`, `discountPct?`
- [ ] Add to `Garage`: `mfNumber`, `rib`, `bankName`, `address`, `logoUrl`, `defaultPaymentTermsDays`, `numberingPrefix`, `numberingResetPolicy` enum NEVER/YEARLY/MONTHLY, `numberingDigitCount`, `defaultTvaRate`, `fiscalStampEnabled`
- [ ] New: `Quote` (status DRAFT/SENT/APPROVED/REJECTED/EXPIRED, `validUntil`, `convertedToInvoiceId?`)
- [ ] New: `CreditNote` (id, invoiceId FK, reason, total, lineItems, lockedAt)
- [ ] New: `InvoiceCounter` (garageId, year, lastIssued; unique on garageId+year)
- [ ] New: `ServiceCatalog` (garageId, code, name, defaultPrice, defaultLaborHours, defaultTvaRate, isActive)
- [ ] New: `DiscountAuditLog` (invoiceId, percentage, reason, approvedBy, approvedAt)
- [ ] New: `DeliveryLog` (invoiceId, channel, recipient, sentAt, status, error?)
- [ ] Run `npm run prisma:generate`
- [ ] Run `npm run prisma:migrate` with name `invoicing_fiscal_foundation`
- [ ] Commit
- [ ] **Test-writer dispatch:** schema validation tests in `test/prisma/invoicing-schema.spec.ts` — create row per new model, FK constraints, unique constraint on `InvoiceCounter(garageId,year)`

### Task 1.2 — `NumberingService` (gapless atomic counter)
**Files:** `src/invoicing/numbering.service.ts` + spec
- [ ] Implement `next(garageId, kind: 'INVOICE'|'QUOTE'|'CREDIT_NOTE')` using Prisma `$transaction` to lock the `InvoiceCounter` row, increment, format
- [ ] Prefixes: `INV-` / `DEV-` / `AVO-`
- [ ] Honor `numberingResetPolicy` NEVER/YEARLY/MONTHLY (year segment / month segment / no segment)
- [ ] Padding to `numberingDigitCount`
- [ ] Commit
- [ ] **Test-writer dispatch:** unit tests (formatting, padding, year reset, monthly reset) + integration test (100 concurrent calls via `Promise.all` produce 100 unique consecutive numbers — guards against the random-collision bug in current `invoicing.service.ts:12`)

### Task 1.3 — `TaxCalculatorService` (per-line TVA)
**Files:** `src/invoicing/tax-calculator.service.ts` + spec
- [ ] Per-line TVA (7/13/19/exempt), discount applied before TVA, rounding at line level (Tunisian convention)
- [ ] Fiscal stamp: 1 TND if any payment expected to be cash AND `garage.fiscalStampEnabled`
- [ ] Returns: `subtotalHT`, `breakdownByRate[]`, `totalTVA`, `fiscalStamp`, `totalTTC`
- [ ] Commit
- [ ] **Test-writer dispatch:** unit covering each rate, mixed rates in same invoice, discount math, rounding boundaries (0.5 cent edge cases), fiscal stamp logic

### Task 1.4 — Invoice state machine + immutability
**Files:** `src/invoicing/invoice-state.ts` (new) + refactor `invoicing.service.ts`
- [ ] States: DRAFT → SENT → (VIEWED) → PARTIALLY_PAID → PAID; CANCELLED only from DRAFT
- [ ] Issuing locks the invoice (`lockedAt`, `lockedBy`); only `status` and `notes` mutable thereafter; line-item or amount changes throw `InvoiceLockedException` (HTTP 423)
- [ ] CANCELLED only valid transition from DRAFT (else require credit note)
- [ ] Commit
- [ ] **Test-writer dispatch:** unit on transitions table; integration `PUT /invoices/:id` after SENT returns 423 for line edits, 200 for status

### Task 1.5 — Garage fiscal identity settings
**Files:** `src/garage-settings/*` (extend), frontend `features/garage-settings/`
- [ ] Backend: extend DTOs to include MF, RIB, bank name, address, logo URL, numbering prefix/policy/digits, default TVA, fiscal stamp toggle, default payment terms (days)
- [ ] Frontend section "Fiscal Information" in garage-settings page (use existing `glass-card` + `form-input`/`form-select` from UI-SYSTEM.md)
- [ ] MF format validator: `^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$` (matricule fiscal pattern)
- [ ] Logo upload via existing photo service
- [ ] Commit
- [ ] **Test-writer dispatch:** unit on MF validator; integration round-trip (settings save → NumberingService and TaxCalculator read the values correctly)

### Task 1.6 — Credit note model + service
**Files:** `src/invoicing/credit-notes.{controller,service}.ts` + DTOs + spec
- [x] `POST /credit-notes` body: `invoiceId`, `reason`, `lineItems[]` (subset of original), `restockParts: bool`
- [x] On issue: lock immediately (no DRAFT state), restore stock if requested, decrement source invoice's `paidAmount` if applicable, recompute source invoice status
- [x] `GET /credit-notes`, `:id` (PDF route deferred to Phase 4 per task scope)
- [x] **Footgun guard:** partial credit on a PAID invoice should not blindly flip status back — explicit test for this
- [x] Commit
- [x] **Test-writer dispatch:** integration full flow on a paid invoice with parts → stock restored, source invoice status correct

---

## Phase 2 — Workflow Integration *(parallel track A, after P1)*

### Task 2.1 — `from-job` invoice builder
**Files:** `src/invoicing/from-job.service.ts` (new), extend `src/maintenance/maintenance.service.ts`
- [ ] `POST /invoices/from-job/:jobId` pulls labor (mechanic hours × hourlyRate from employee), parts (from PartUsage), services from job → DRAFT invoice with `maintenanceJobId` set
- [ ] Reject if job already has linked invoice
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — fixture job with parts + labor, expect lineItems match (count, prices, totals)

### Task 2.2 — Inventory ↔ invoice wiring
**Files:** `src/inventory/inventory.service.ts`, hook into invoice state machine
- [ ] DRAFT→SENT transition: for each lineItem with `partId`, create `StockMovement(SALE, -qty)`
- [ ] Insufficient stock returns 422 with shortage list; don't transition status
- [ ] Credit note with `restockParts=true`: reverse movements (RESTOCK type)
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — issue → stock drops; insufficient → 422 + shortage list; credit note → stock restored

### Task 2.3 — Quote (devis) flow
**Files:** `src/invoicing/quotes.{controller,service}.ts` + frontend `components/quote-form.component.*`, `components/quote-list.component.*`
- [ ] Quote = same shape as Invoice, no fiscal stamp, `validUntil`, status DRAFT/SENT/APPROVED/REJECTED/EXPIRED
- [ ] `POST /quotes/:id/approve` copies lines into a new DRAFT Invoice, sets quote.convertedToInvoiceId
- [ ] Auto-expire cron: nightly job marks SENT quotes past `validUntil` as EXPIRED
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — create→approve→verify invoice + linkage; expiry cron test

### Task 2.4 — Service catalog CRUD
**Files:** `src/services-catalog/*` (new Nest module), frontend `service-picker.component.*`
- [ ] CRUD endpoints for ServiceCatalog rows (owner-only for write, all roles for read)
- [ ] Frontend: `service-picker` autocompletes line items in invoice/quote forms
- [ ] Commit
- [ ] **Test-writer dispatch:** CRUD unit + autocomplete integration

---

## Phase 3 — Reporting & Roles *(parallel track B, after P1)*

### Task 3.1 — Multi-role unlock
**Files:** `src/invoicing/invoicing.controller.ts`, `quotes.controller.ts`, `payments.controller.ts`
- [ ] Change `@Roles(OWNER)` to `@Roles(OWNER, MECHANIC, STAFF)` for GET/POST/PUT
- [ ] Keep DELETE owner-only
- [ ] Commit
- [ ] **Test-writer dispatch:** auth integration — mechanic JWT can POST invoice, only owner can DELETE; staff can record payment

### Task 3.2 — Discount audit trail
**Files:** invoice service, `DiscountAuditLog` model usage, frontend invoice form
- [ ] Discount > configurable threshold (default 5%) requires `approverId` (owner role); writes row in `DiscountAuditLog`
- [ ] Frontend: "Approver" picker (owners only) appears in invoice form when threshold crossed
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — 10% as mechanic without approver → 403; with approverId → 201 + audit row exists

### Task 3.3 — AR aging report
**Files:** `src/reports/ar-aging.service.ts` (new), controller endpoint, frontend `components/ar-aging.component.*`
- [ ] Buckets: current, 1-30, 31-60, 61-90, 90+
- [ ] Group by customer, sum `remainingAmount`
- [ ] CSV export endpoint
- [ ] Frontend: horizontal stacked bar (reuse Chart.js setup from dashboard)
- [ ] Commit
- [ ] **Test-writer dispatch:** unit on bucketer logic; integration on full pipeline (fixtures across all buckets)

### Task 3.4 — Customer statement
**Files:** `src/reports/customer-statement.service.ts`, frontend link from `customers/:id`
- [ ] All invoices + payments per customer over date range with running balance
- [ ] PDF export (uses pdfkit renderer from Phase 4.1 — depends on it being ready)
- [ ] Commit
- [ ] **Test-writer dispatch:** mixed paid/unpaid fixture, assert running balance correct row-by-row

### Task 3.5 — Daily Z-report (cash close)
**Files:** `src/reports/z-report.service.ts`, frontend `components/z-report.component.*`
- [ ] For a given date: count of invoices issued, total HT/TVA/TTC, breakdown by payment method, count of credit notes, net cash
- [ ] Print-friendly card layout (reports page)
- [ ] Commit
- [ ] **Test-writer dispatch:** fixture day with cash + card + check payments, assert totals match

### Task 3.6 — Accountant CSV export
**Files:** `src/reports/accountant-export.service.ts`
- [ ] Monthly journal export — columns: date, invoice#, customer, MF, HT, TVA breakdown columns (7%/13%/19%), TTC, payment method, paid date
- [ ] CSV download endpoint
- [ ] Commit
- [ ] **Test-writer dispatch:** fixture month, assert column count, header row, row count, totals tally with sum of invoices

---

## Phase 4 — Output & Delivery *(parallel track C, after P1)*

### Task 4.1 — PDF renderer (pdfkit)
**Files:** `src/invoicing/pdf-renderer.service.ts` (new) + spec
- [ ] Programmatic pdfkit layout: garage logo, MF, RIB, customer/car block, line items table with per-line TVA, totals breakdown by TVA rate, fiscal stamp line, payment terms, QR code → public invoice URL
- [ ] A4 portrait, all text in Arial/sans-serif (pdfkit built-in fonts)
- [ ] Cache invalidation key: `invoiceId+updatedAt`
- [ ] Same renderer reused for quotes (different header) and credit notes
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — generate PDF, parse via `pdf-parse`, assert required fields present (MF, RIB, line items, totals)

### Task 4.2 — Email delivery (Resend)
**Files:** `src/invoicing/delivery.service.ts` (new)
- [ ] `POST /invoices/:id/send` body `{channel: 'EMAIL'|'WHATSAPP'|'BOTH', to?: string}`
- [ ] EMAIL: HTML body + PDF attachment via existing Resend integration; logs `DeliveryLog` row
- [ ] DRAFT → SENT transition fires (with stock decrement from Phase 2.2)
- [ ] Commit
- [ ] **Test-writer dispatch:** integration with Resend mock; live regression sender uses sandbox-verified `ala.khliifa@gmail.com` per memory `reference_resend_sandbox` (NOT the maibornwolff address)

### Task 4.3 — WhatsApp delivery (`wa.me` link)
**Files:** delivery.service.ts (extend)
- [ ] WHATSAPP channel: builds `https://wa.me/{phone}?text={pre-filled msg with public URL}`
- [ ] Frontend `send-invoice-modal` opens link in new tab
- [ ] Logs `DeliveryLog` with status PENDING (we can't confirm delivery)
- [ ] Commit
- [ ] **Test-writer dispatch:** unit on URL builder + token expiry; phone normalization for Tunisian numbers (+216)

### Task 4.4 — Public invoice link
**Files:** `src/public/invoice-public.controller.ts` (new, no JWT guard)
- [ ] `GET /public/invoices/:token` returns PDF (or read-only HTML view)
- [ ] Token: signed JWT with invoiceId + 30-day expiry
- [ ] Viewing transitions SENT → VIEWED once (idempotent)
- [ ] Commit
- [ ] **Test-writer dispatch:** integration — valid token returns PDF; expired token rejected; viewed transition fires once only

---

## Phase 5 — UX Restructure *(parallel track D — frontend, can stub backend with mocks)*

### Task 5.1 — Invoicing shell with sub-navigation
**Files:** `features/invoicing/invoicing.component.*`, `app-routing-module.ts`
- [ ] New routes mounted under `/invoices`:
  - `/invoices` → Dashboard
  - `/invoices/list` → All invoices
  - `/invoices/pending` → Pending payments (existing)
  - `/invoices/quotes`, `/invoices/quotes/new`, `/invoices/quotes/:id`
  - `/invoices/credit-notes`, `/invoices/credit-notes/new`
  - `/invoices/reports`
  - `/invoices/templates`
  - `/invoices/settings` (links into garage-settings#fiscal anchor)
  - `/invoices/create`, `/invoices/edit/:id`, `/invoices/:id` (refactored)
- [ ] Sticky sub-nav pill row using `nav-button-active`/`nav-button-inactive` from UI-SYSTEM.md: Dashboard | Quotes | Invoices | Credit Notes | Pending | Reports | Settings
- [ ] Right side: "+ New" dropdown — New Quote / New Invoice / New Credit Note / Record Payment
- [ ] Mobile: collapses to single dropdown selector + floating "+" FAB
- [ ] Commit

### Task 5.2 — Dashboard view (the new home for `/invoices`)
**Files:** `pages/dashboard/dashboard.component.*`
Layout mirrors main dashboard structure (`section-container` + `glass-card` + `quick-action-grid`):
- [ ] Section 1 — `quick-action-grid` (4 tiles): New Invoice, New Quote, Record Payment, AR Aging
- [ ] Section 2 — Urgent banner (only if overdue > 0): red `urgent-card` "X overdue • Y TND outstanding • Review →"
- [ ] Section 3 — KPI row (4 `glass-card` KPI tiles): Revenue this month, Outstanding AR, Quotes pending, Credit notes this month — each with sparkline
- [ ] Section 4 — Two-column glass-card row: Recent invoices (last 5 with status badge) | Top customers by revenue
- [ ] Section 5 — Aging mini-chart (full-width `glass-card`): horizontal stacked bar 0-30 / 31-60 / 61-90 / 90+
- [ ] Commit

### Task 5.3 — Invoice form rebuild
**Files:** `components/invoice-form.component.*`
Single-page sectioned (each section in its own `glass-card`):
- [ ] Section 1: Customer & Vehicle — autocomplete customer → car (filtered) → optional "link to job" picker
- [ ] Section 2: Pull-from-job CTA appears when a job is linked — pre-fills line items
- [ ] Section 3: Line items table — row types Service / Part / Labor / Misc; service rows pull from catalog autocomplete; part rows pull from inventory with live stock badge ("12 in stock"); labor rows = hours × hourly rate
- [ ] Section 4: Per-line TVA select (7/13/19/exempt), default from settings
- [ ] Section 5: Discount — % or amount + reason; if > threshold, Approver picker appears (owners only)
- [ ] Sticky right summary panel: subtotal HT, TVA breakdown, fiscal stamp, total TTC, due date, payment terms
- [ ] Footer actions: Save Draft / Preview PDF / Issue & Send
- [ ] Sticky validation banner at top listing missing required fields
- [ ] Commit

### Task 5.4 — Invoice detail rebuild
**Files:** `components/invoice-details.component.*`
- [ ] Header: invoice# + status pill + lock icon (if locked) + actions (Send, Record Payment, Print, Download PDF, Issue Credit Note)
- [ ] Two-column layout: Left — invoice content rendering. Right — activity timeline (created/sent/viewed/payment events) + payment progress ring + linked credit notes list
- [ ] Locked invoices: edit buttons hidden, read-only banner
- [ ] Commit

### Task 5.5 — Send invoice modal
**Files:** `components/send-invoice-modal.component.*`
- [ ] Channel chips (Email / WhatsApp / Both) — radio-style
- [ ] Recipient picker (defaults from customer email/phone)
- [ ] Preview pane (shows the email subject/body or WhatsApp message text)
- [ ] Send button → POST `/invoices/:id/send`; toast confirms; shows DeliveryLog status
- [ ] Commit

### Task 5.6 — Sidebar update
**Files:** `shared/components/sidebar/sidebar.component.ts`
- [ ] Update existing invoicing group children at line 105-107 to: Dashboard / Quotes / All Invoices / Credit Notes / Pending Payment / Reports
- [ ] Badge counts: pending invoices, expired quotes, overdue
- [ ] Commit

### Task 5.7 — i18n parity
**Files:** `assets/i18n/{en,fr,ar}.json`
- [ ] All new strings added to all 3 locales (Arabic uses singular keys per memory `pitfall_translations`)
- [ ] Add a parity check script `scripts/check-i18n-parity.js` to validate all 3 files have identical key sets
- [ ] Commit
- [ ] **Test-writer dispatch:** wire parity check into pre-commit hook + CI; fails build if drift

---

## Phase 6 — Final Validation *(sequential, after Phases 2–5 all green)*

### Task 6.1 — Run all suites
- [ ] Frontend: `npm run test`, `npm run lint`
- [ ] Backend: `cd opauto-backend && npm run test && npm run test:e2e && npm run build`
- [ ] If any failure: dispatch the appropriate agent to fix; do not proceed
- [ ] Commit any fixes

### Task 6.2 — E2E validation via `e2e-validator` agent
**Agent dispatch:** `e2e-validator` against `http://localhost:4200`. Each scenario gets a `take_snapshot` (primary) plus screenshot on failure, console + network capture per memory `feedback_e2e_post_action_screenshots`.

Scenarios:
1. Owner login → `/invoices` → KPIs render, no console errors
2. Create quote → 2 line items → Save Draft → status DRAFT
3. Send quote → status SENT
4. Approve quote → DRAFT invoice created with same lines + linkage visible
5. Issue & Send invoice → number formatted `INV-2026-NNNN`, lockedAt set, lock icon visible
6. Edit sent invoice line items → blocked with toast (HTTP 423)
7. Record half payment → PARTIALLY_PAID, remaining shown
8. Record balance payment → PAID
9. Issue credit note for half (with restock) → linked credit note in timeline, stock restored
10. Reports page → AR aging buckets correct; Z-report totals; accountant CSV downloaded
11. Mechanic login → can create invoice; DELETE button hidden
12. Mobile viewport (375×667) → sub-nav collapses, FAB visible
13. Switch to Arabic (RTL) → layout intact across all new pages

- [ ] All 13 scenarios pass; report any console/network errors
- [ ] Update `docs/MVP_PROGRESS.md` to check off all completed items
- [ ] Final commit

---

## Parallel Execution Map

```
P1 (sequential, 1 agent) ──┐
                           ├──→ P6 (sequential, 1 agent — final tests + e2e)
P2 ──┐                     │
P3 ──┼── parallel after P1 ┤
P4 ──┤                     │
P5 ──┘                     │
```

**Dispatch model:**
- **Phase 1**: 1 main agent (general-purpose) doing schema + foundation services. Test-writer agent fired per task.
- **Phases 2–5**: dispatched as 4 simultaneous `general-purpose` agents — each gets only their phase's task list, exact file paths (no rediscovery, per `token-efficiency` rule), test-writer dispatch instructions per task, acceptance criteria. They share no state and write to non-overlapping files.
- **Coordinator** (the main session) waits for all four to return ✅ before starting Phase 6.
- **Phase 6**: 1 agent runs all suites; on green, dispatches `e2e-validator` with the 13-scenario brief.

## Test Database Setup

- [ ] Create `opauto-backend/.env.test` with `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/opauto_test`
- [ ] Add `package.json` script `test:reset` — runs `prisma migrate reset --force --skip-seed && prisma db seed` against `DATABASE_URL_TEST`
- [ ] New `prisma/seed-test.ts` — deterministic UUIDs/dates: 1 garage with YEARLY numbering, 1 with MONTHLY, 5 customers with mixed payment histories, 10 parts with varied stock levels, 1 mechanic, service catalog rows for the 5 most common services
- [ ] Jest globalSetup runs `test:reset` once per integration suite

## Risk Register

- **Numbering atomicity** — must use Prisma `$transaction`; naive `findUnique`+`update` will race under concurrent issuing. The 100-concurrent-calls test in 1.2 catches this.
- **Tunisian VAT changes** — keep rates configurable; never hardcode.
- **Discount audit threshold** — settings-driven, not hardcoded per garage.
- **Credit note status interplay** — partial credit on a PAID invoice should NOT flip status back to PARTIALLY_PAID without explicit test (footgun guard in 1.6).
- **WhatsApp Business API** — out of scope; `wa.me` link is the pragmatic v1.
- **pdfkit + Arabic** — RTL text in PDFs needs verification; if pdfkit's Arabic rendering is broken, fall back to PDFs in French/English only with a noted limitation.

---

## Self-review notes

- Spec coverage: every blocker/high-value item from the diagnosis maps to at least one task. Server-side filter (#15 in diagnosis) folds into Task 5.2 backend list endpoints accepting query params.
- No unresolved placeholders.
- Type consistency: `lockedAt`, `lockedBy`, `mfNumber`, `numberingResetPolicy`, `tvaRate` used consistently across all referencing tasks.
- Open decision before kickoff: none (PDF library locked to pdfkit, scope locked to all 6 phases).

---

## Execution Handoff

Recommended execution mode: **Subagent-Driven** (`superpowers:subagent-driven-development`) — fresh subagent per task with two-stage review.

Phase 1 must complete before Phases 2–5 dispatch. After Phase 1, coordinator dispatches 4 agents in a single tool-call burst (parallel) and waits for all to return before Phase 6.
