# Invoicing — E2E Scenario Test Catalog

Comprehensive, button-by-button scenario coverage for the fiscal invoicing system shipped Apr 2026 (commits `001a658` → `7ef7d9f`). Every scenario is reproducible against `http://localhost:4200` with a fresh dev DB.

**How to use this doc**
- Run scenarios manually (browser) or wire each into the e2e-validator agent (`/e2e {scenario-id}`).
- Priority: **P0** = ship-blocker, **P1** = important, **P2** = polish/edge.
- Status: ✅ verified in Phase 6.2 e2e validation, ⚠️ partially verified, ❌ not yet covered, 🟡 backend-only verified (no browser pass), ⏭️ blocked / SKIPped.
- Routes column: backend endpoint(s) the scenario exercises.
- Each scenario has a unique ID (e.g. `S-QUO-003`) for tracking.

**Test data assumptions**
- Garage `autotech.tn` exists (`owner@autotech.tn` / `password123`).
- Customers, cars, parts, mechanics seeded via `prisma db seed`.
- Garage settings: MF set, RIB set, default TVA 19%, fiscal stamp enabled, monthly numbering reset (`INV-YYYYMM-NNNN`).
- A `STAFF` user (`staff@autotech.tn`) — currently NOT seeded; scenarios needing it are SKIP until added.

---

## Section 1 — Authentication & Role Access

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-AUTH-001 | Owner login → /invoices dashboard renders | P0 | ✅ |
| S-AUTH-002 | Staff login → can access /invoices | P0 | ⏭️ no staff seed |
| S-AUTH-003 | Staff cannot DELETE invoice (button hidden) | P0 | ⏭️ no staff seed |
| S-AUTH-004 | Owner can DELETE invoice | P1 | ❌ |
| S-AUTH-005 | Unauthenticated → /invoices redirects to /auth | P0 | ❌ |
| S-AUTH-006 | Staff records payment (no DELETE invoice rights) | P1 | ⏭️ no staff seed |
| S-AUTH-007 | Cross-garage tenant isolation: GET /invoices/:id from other garage → 404 (no leak) | P0 | 🟡 backend test |

**Detail — S-AUTH-001:**
- **Steps:** Navigate `/auth` → fill `owner@autotech.tn` / `password123` → click "Sign in" → land on `/dashboard` → click "Invoices" in sidebar.
- **Expected:** /invoices dashboard renders; 4 KPI tiles populated; no console errors; sub-nav pills visible.
- **Routes:** `POST /api/auth/login`, `GET /api/invoices`, `GET /api/quotes`, `GET /api/credit-notes`, `GET /api/reports/ar-aging`.

---

## Section 2 — Sub-navigation Shell

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-NAV-001 | Each of 7 sub-nav pills navigates to correct page | P0 | ✅ |
| S-NAV-002 | Active pill highlighted on each route | P1 | ✅ |
| S-NAV-003 | "+ New" dropdown shows 4 options (Quote / Invoice / Credit Note / Payment) | P1 | ✅ |
| S-NAV-004 | "+ New → Quote" opens `/invoices/quotes/new` | P0 | ✅ |
| S-NAV-005 | "+ New → Invoice" opens `/invoices/create` | P0 | ✅ |
| S-NAV-006 | "+ New → Credit Note" opens `/invoices/credit-notes/new` | P0 | ✅ |
| S-NAV-007 | "+ New → Payment" → AskUser invoice picker → opens payment-modal | P1 | ❌ |
| S-NAV-008 | Mobile (375px): pill row collapses to `<select>` | P0 | ✅ |
| S-NAV-009 | Mobile: floating "+" FAB at bottom-LEFT (no overlap with AI button) | P1 | ✅ |
| S-NAV-010 | "Settings" sub-nav pill deep-links to garage-settings#fiscal anchor | P2 | ❌ |

---

## Section 3 — Dashboard (`/invoices`)

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-DASH-001 | 4 KPI tiles render with values + sparklines | P0 | ✅ |
| S-DASH-002 | Quick-action grid: 4 tiles all clickable | P1 | ✅ |
| S-DASH-003 | Quick-action "Record Payment" opens modal with invoice picker | P1 | ❌ |
| S-DASH-004 | Urgent banner appears when overdue count > 0 | P0 | ✅ |
| S-DASH-005 | Urgent banner hidden when 0 overdue | P1 | ❌ |
| S-DASH-006 | "Recent invoices" section shows last 5 with status pills | P1 | ✅ |
| S-DASH-007 | Clicking a recent invoice → navigates to `/invoices/:id` | P1 | ❌ |
| S-DASH-008 | "Top customers by revenue" section renders (last 30d) | P2 | ✅ |
| S-DASH-009 | AR aging mini-chart: 5-bucket horizontal stacked bar | P1 | ✅ |
| S-DASH-010 | All KPIs translate when language switches | P1 | ❌ |
| S-DASH-011 | Failed KPI fetch (e.g. backend down) → tile shows "—", page still renders | P2 | ❌ |

---

## Section 4 — Quotes (Devis)

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-QUO-001 | Create quote with 1 line item, Save Draft | P0 | ✅ |
| S-QUO-002 | Create quote with 2+ line items (Add line button works) | P0 | ✅ |
| S-QUO-003 | Add line — type=Service via service-picker autocomplete | P0 | ✅ |
| S-QUO-004 | Add line — type=Part via part-picker; stock badge displays | P0 | ✅ |
| S-QUO-005 | Add line — type=Labor with hours × rate auto-compute | P1 | ❌ |
| S-QUO-006 | Add line — type=Misc free-text | P1 | ❌ |
| S-QUO-007 | Remove line via × button | P1 | ❌ |
| S-QUO-008 | Per-line TVA select (7 / 13 / 19 / exempt 0) | P0 | ✅ (after Sweep A Group 2 fix — TVA_RATES reorder + explicit `[selected]`) |
| S-QUO-009 | Quote DRAFT has no quote number (`DRAFT-{uuid8}` placeholder) | P0 | ✅ |
| S-QUO-010 | Edit DRAFT quote — totals recompute on line change | P1 | ❌ |
| S-QUO-011 | Send DRAFT quote → SENT, number formatted `DEV-YYYY-NNNN` | P0 | ✅ |
| S-QUO-012 | Approve SENT quote → DRAFT invoice created with copied lines | P0 | ✅ |
| S-QUO-013 | Approve auto-navigates to new draft invoice (currently fails — UX glitch) | P2 | ❌ known glitch |
| S-QUO-014 | Reject SENT quote → REJECTED (terminal) | P1 | ❌ |
| S-QUO-015 | Re-send REJECTED quote → 400 (terminal state) | P2 | ❌ |
| S-QUO-016 | Approve DRAFT quote (no number) → 400 (must SEND first) | P1 | ❌ |
| S-QUO-017 | Quote with `validUntil = yesterday` → `expireOldQuotes()` marks EXPIRED | P1 | 🟡 backend test |
| S-QUO-018 | Edit quote AFTER send → 423 / blocked by UI | P0 | ✅ (Edit button absent on quote-detail; see BUG-095 — also blocks DRAFT edit) |
| S-QUO-019 | Quote list filters by status (DRAFT / SENT / APPROVED / REJECTED / EXPIRED) | P1 | ❌ |
| S-QUO-020 | Approved quote → source quote shows `convertedToInvoiceId` link | P1 | ❌ |
| S-QUO-021 | Quote line item DTO contract: only spec'd fields accepted (no `unit`/`totalPrice`) | P0 | ✅ (after fix d28a940) |
| S-QUO-022 | Discount > threshold without approver → 400 | P1 | ❌ |
| S-QUO-023 | Discount > threshold with approver → 201 + DiscountAuditLog row | P1 | 🟡 backend test |

**Detail — S-QUO-001:**
- **Steps:** /invoices/quotes/new → pick customer → pick car → add 1 line (type=Misc, desc="Test", qty=1, unitPrice=100, tvaRate=19) → Save Draft.
- **Expected:** Toast "Quote saved"; redirects to detail; status badge DRAFT; `quoteNumber` matches `^DRAFT-[a-f0-9]{8}$`; total displayed = 100 + 19% = 119 TND.
- **Routes:** `POST /api/quotes`.

**Detail — S-QUO-011 (Send):**
- **Steps:** Open DRAFT quote → click "Send".
- **Expected:** Toast "Quote sent"; status badge SENT; `quoteNumber` updated to `DEV-{YYYY|YYYYMM}-NNNN` per garage policy. Approve / Reject buttons appear.
- **Routes:** `POST /api/quotes/:id/send`.

---

## Section 5 — Invoices

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-INV-001 | Create DRAFT invoice with 1 line item | P0 | ❌ |
| S-INV-002 | Create DRAFT invoice with mixed line types (service+part+labor+misc) | P0 | ❌ |
| S-INV-003 | DRAFT invoice number is placeholder `DRAFT-{uuid8}` (no fiscal seq burn) | P0 | ✅ |
| S-INV-004 | Edit DRAFT invoice — totals recompute on line change (`PUT /api/invoices/:id`) | P0 | ❌ |
| S-INV-005 | Edit DRAFT invoice — change customer / car | P1 | ❌ |
| S-INV-006 | Issue DRAFT invoice — gets `INV-YYYY-NNNN` (or `INV-YYYYMM-NNNN`), `lockedAt`, `lockedBy` | P0 | ✅ |
| S-INV-007 | Issue triggers stock decrement for each `partId` line | P0 | 🟡 backend test |
| S-INV-008 | Issue with insufficient stock → 422 + shortage list | P0 | 🟡 backend test |
| S-INV-009 | Issue → send-invoice-modal opens automatically | P0 | ✅ |
| S-INV-010 | Issue is gapless under concurrency (100 parallel calls → 1..100) | P0 | 🟡 backend test |
| S-INV-011 | Edit issued invoice line items → 423 InvoiceLockedException | P0 | ✅ |
| S-INV-012 | Edit issued invoice notes → 200 (only notes mutable) | P0 | 🟡 backend test |
| S-INV-013 | Issued invoice form renders read-only with "locked" banner | P0 | ✅ |
| S-INV-014 | Cancel DRAFT invoice → CANCELLED | P1 | ❌ |
| S-INV-015 | Cancel issued invoice → 400 (must use credit note) | P0 | ✅ (button absent off-DRAFT) |
| S-INV-016 | Delete DRAFT invoice (owner only) | P0 | ✅ (after Sweep A Group 3 — confirm modal + 423 toast) |
| S-INV-017 | Delete issued invoice → 400 (must credit-note instead) | P0 | ✅ (button absent off-DRAFT) |
| S-INV-018 | DELETE button hidden for STAFF role | P0 | ⏭️ no staff seed |
| S-INV-019 | Pull from job: link maintenance job → click "Pull from job" → lines pre-fill | P0 | ❌ |
| S-INV-020 | Pull from job: already-converted job → 409 | P1 | 🟡 backend test |
| S-INV-021 | Discount % > threshold without approver → form invalid + sticky banner | P1 | ❌ |
| S-INV-022 | Discount % > threshold with approver picker → form valid; on save, DiscountAuditLog row | P1 | 🟡 backend test |
| S-INV-023 | Per-line discount % auto-recomputes line total + invoice TVA | P1 | ❌ |
| S-INV-024 | Sticky right summary panel updates reactively on every change | P1 | ❌ |
| S-INV-025 | Validation banner lists missing required fields (no customer / no lines / etc.) | P1 | ❌ |
| S-INV-026 | Save Draft preserves form on network failure (toast error, no data loss) | P2 | ❌ |
| S-INV-027 | Preview PDF button: opens new tab with `/api/invoices/:id/pdf` (DRAFT also works) | P1 | ❌ |
| S-INV-028 | List view: filter by status, search by invoice number / customer | P1 | ❌ |
| S-INV-029 | List view: pagination (or all-in-one if dataset small) | P2 | ❌ none yet |
| S-INV-030 | Invoice DTO contract: line items only carry spec'd fields | P0 | ✅ (after d28a940) |
| S-INV-031 | Re-entering /invoices/edit/:id correctly hydrates each line's `type` and `tvaRate` (no fallback to "Service" / 0%) | P1 | ✅ (after BUG-094 fix) |

**Detail — S-INV-006 (Issue):**
- **Steps:** Open DRAFT → fill required fields → click "Issue & Send".
- **Expected:** Toast "Invoice issued"; status SENT; lock icon appears in header; `invoiceNumber` matches `^INV-(2026|202604)-\d{4}$`; `lockedAt`, `lockedBy` set; send-invoice-modal opens with email channel pre-selected.
- **Routes:** `POST /api/invoices/:id/issue` → `POST /api/invoices/:id/deliver` (when modal submits).

**Detail — S-INV-013 (Locked read-only):**
- **Steps:** Navigate `/invoices/edit/{issued-id}`.
- **Expected:** Banner "This invoice is locked. Issued invoices are immutable for fiscal compliance." All inputs disabled. Footer shows only "Issue Credit Note" CTA → navigates to `/invoices/credit-notes/new?invoiceId=:id`.

---

## Section 6 — Invoice Detail

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-DET-001 | DRAFT detail: actions = Edit / Issue&Send / Preview PDF / Delete | P0 | ❌ |
| S-DET-002 | SENT detail: actions = Send / Record Payment / Print / Download PDF / Issue Credit Note | P0 | ✅ |
| S-DET-003 | PARTIALLY_PAID detail: same as SENT minus Send (already delivered) | P1 | ✅ |
| S-DET-004 | PAID detail: actions = Print / Download PDF / Issue Credit Note (no payment) | P1 | ✅ |
| S-DET-005 | CANCELLED detail: actions = Print / Download PDF only | P2 | ❌ |
| S-DET-006 | OVERDUE detail: same as PARTIALLY_PAID + visual overdue cue | P1 | ❌ |
| S-DET-007 | Activity timeline: created → issued → viewed → payment 1 → payment 2 → credit note (sorted desc) | P0 | ✅ |
| S-DET-008 | Payment progress ring: SVG renders correct percentage | P1 | ✅ |
| S-DET-009 | Linked credit notes summary in right column | P1 | ✅ |
| S-DET-010 | Print: `@media print` hides chrome, shows only invoice content | P1 | ❌ visual |
| S-DET-011 | Download PDF: returns valid PDF with correct filename | P0 | ❌ browser |
| S-DET-012 | Issue Credit Note button → `/invoices/credit-notes/new?invoiceId=:id` | P0 | ✅ |
| S-DET-013 | Header lock icon appears when status !== DRAFT | P1 | ✅ |
| S-DET-014 | Page focus refresh: returning from credit note → detail re-fetches | P1 | ❌ |
| S-DET-015 | `formatDateTime` handles null `paymentDate` without RangeError | P0 | ✅ (after 602815a) |

---

## Section 7 — Payments

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-PAY-001 | Record full payment on SENT invoice → PAID | P0 | ✅ |
| S-PAY-002 | Record half payment on SENT → PARTIALLY_PAID | P0 | ✅ |
| S-PAY-003 | Record balance on PARTIALLY_PAID → PAID | P0 | ✅ |
| S-PAY-004 | Record payment on DRAFT → 400 "Issue invoice first" | P0 | 🟡 backend test |
| S-PAY-005 | Record payment on PAID → 400 (already paid) | P1 | ❌ |
| S-PAY-006 | Method=CASH posts with method=CASH | P1 | ✅ |
| S-PAY-007 | Method=CARD / CHECK / BANK_TRANSFER all submit correctly | P1 | ❌ |
| S-PAY-008 | Modal opens cleanly first time | P0 | ✅ |
| S-PAY-009 | Modal reopens cleanly after partial payment (openKey signal fix) | P0 | ✅ (after d28a940) |
| S-PAY-010 | Reference field optional, notes field optional | P2 | ❌ |
| S-PAY-011 | Amount pre-filled to remaining balance | P1 | ✅ |
| S-PAY-012 | Submitting amount > remaining → over-payment warning OR clamped | P1 | ❌ |
| S-PAY-013 | Submitting amount = 0 or negative → form invalid | P1 | ❌ |
| S-PAY-014 | Date defaults to today | P2 | ✅ |
| S-PAY-015 | Payment failure (network) → toast error, modal stays open with values | P2 | ❌ |

---

## Section 8 — Credit Notes (Avoir)

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-CN-001 | Issue credit note for full invoice with restock=true → AVO-... + stock restored | P0 | ✅ |
| S-CN-002 | Issue credit note for half invoice → over-credit math correct | P0 | 🟡 backend test |
| S-CN-003 | Issue credit note with restock=false → stock unchanged | P1 | 🟡 backend test |
| S-CN-004 | Issue credit note against DRAFT invoice → 400 | P0 | 🟡 backend test |
| S-CN-005 | Issue credit note against CANCELLED invoice → 400 | P1 | 🟡 backend test |
| S-CN-006 | Issue credit note against OVERDUE → 400 (must pay or cancel first) | P1 | 🟡 backend test |
| S-CN-007 | Credit note line with partId NOT on source invoice → 400 | P1 | 🟡 backend test |
| S-CN-008 | Credit note over-credit on PAID invoice → status stays PAID + `overCredited: true` | P0 | 🟡 backend test |
| S-CN-009 | Credit note is locked on issue (no further edits) | P0 | 🟡 backend test |
| S-CN-010 | Credit note number formatted `AVO-YYYY-NNNN` | P0 | ✅ |
| S-CN-011 | Credit note appears in source invoice's activity timeline | P1 | ✅ |
| S-CN-012 | Credit note list at /invoices/credit-notes shows all + restock badge | P1 | ✅ |
| S-CN-013 | Source invoice DELETE cascades to credit notes | P2 | 🟡 backend test |
| S-CN-014 | Credit note DTO contract: lineItems require `tvaRate` | P0 | ✅ (after d28a940) |
| S-CN-015 | Credit note form pre-fills lines from source invoice | P0 | ✅ |
| S-CN-016 | Reason field required (form invalid without it) | P1 | ❌ |

---

## Section 9 — PDF Rendering

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-PDF-001 | Invoice PDF: starts with `%PDF` magic bytes | P0 | 🟡 backend test |
| S-PDF-002 | Invoice PDF includes garage MF, RIB, customer name, line items, totals | P0 | 🟡 backend test |
| S-PDF-003 | Invoice PDF QR code links to public token URL | P1 | 🟡 backend test |
| S-PDF-004 | Quote PDF renders (uses DEV-... in header) | P1 | ❌ browser |
| S-PDF-005 | Credit note PDF renders (uses AVO-... in header) | P1 | ❌ browser |
| S-PDF-006 | LRU cache: same `${id}:${updatedAt}` returns cached buffer | P1 | 🟡 backend test |
| S-PDF-007 | Cache invalidates when invoice updatedAt changes | P1 | 🟡 backend test |
| S-PDF-008 | RTL/Arabic in customer name: renders LTR (documented v1 limitation) | P2 | ❌ |
| S-PDF-009 | Public PDF route: `GET /public/invoices/:token` returns PDF | P0 | 🟡 backend test |
| S-PDF-010 | Public route transitions SENT → VIEWED on first call (idempotent on subsequent) | P0 | 🟡 backend test |
| S-PDF-011 | Expired token (>30d) → 401 | P0 | 🟡 backend test |
| S-PDF-012 | Wrong-type token (quote token on invoice route) → 401 | P1 | 🟡 backend test |

---

## Section 10 — Delivery

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-DEL-001 | EMAIL channel: PDF attached, DeliveryLog status=SENT | P0 | 🟡 backend test (live verified) |
| S-DEL-002 | EMAIL with no recipient on file → 400 + DeliveryLog FAILED | P1 | 🟡 backend test |
| S-DEL-003 | EMAIL Resend failure → DeliveryLog FAILED with error message | P1 | 🟡 backend test |
| S-DEL-004 | WHATSAPP channel: returns `wa.me/{216-phone}?text=...` URL | P0 | 🟡 backend test |
| S-DEL-005 | WhatsApp phone normalization: `0XXXXXXXX`, `+216 XXXXXXXX`, `216XXXXXXXX`, plain 8-digit all → `216XXXXXXXX` | P0 | 🟡 backend test |
| S-DEL-006 | WHATSAPP invalid phone format → 400 | P1 | 🟡 backend test |
| S-DEL-007 | BOTH channel: EMAIL fails, WHATSAPP still returns URL | P1 | 🟡 backend test |
| S-DEL-008 | Send modal: channel chips (Email / WhatsApp / Both) work | P0 | ✅ |
| S-DEL-009 | Send modal: recipient input swaps validators (email vs phone) | P1 | ❌ |
| S-DEL-010 | Send modal: preview pane shows subject + body | P2 | ❌ |
| S-DEL-011 | Send modal: submit emits payload `{channel, to}` | P1 | ❌ |
| S-DEL-012 | Re-send (deliver again) on already-SENT invoice → new DeliveryLog row | P1 | ❌ |

---

## Section 11 — Reports

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-RPT-001 | AR aging: bucket counts (current / 1-30 / 31-60 / 61-90 / 90+) | P0 | ✅ |
| S-RPT-002 | AR aging: customers sorted by total desc | P1 | 🟡 backend test |
| S-RPT-003 | AR aging: CSV export with `?format=csv` | P0 | 🟡 backend test |
| S-RPT-004 | AR aging chart: horizontal stacked bar renders | P1 | ✅ |
| S-RPT-005 | Z-report for today: counts, totals HT/TVA/TTC, payment method breakdown, net cash | P0 | ✅ |
| S-RPT-006 | Z-report: CASH-only day, multi-method day, no-activity day all render | P1 | 🟡 backend test |
| S-RPT-007 | Z-report Print button → print stylesheet applies | P1 | ❌ visual |
| S-RPT-008 | Customer statement: opening balance, items chronological, running balance, closing | P0 | 🟡 backend test |
| S-RPT-009 | Customer statement: DRAFT invoices skipped | P1 | 🟡 backend test |
| S-RPT-010 | Customer statement: form submits, table renders | P1 | ✅ |
| S-RPT-011 | Accountant CSV export: 13 columns (date, number, customer, MF, HT, TVA 7/13/19, fiscal stamp, TTC, payment method, paid date) | P0 | 🟡 backend test |
| S-RPT-012 | Accountant CSV: month with 0 invoices returns headers + 0 rows | P1 | 🟡 backend test |
| S-RPT-013 | Accountant CSV: row totals tally with sum of invoices in period | P0 | 🟡 backend test |
| S-RPT-014 | Reports landing page: 4 cards (AR / Z / Statement / CSV) | P0 | ✅ |

---

## Section 12 — Service Catalog

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-CAT-001 | Service-picker autocomplete: type 2 chars → filtered results | P1 | ❌ |
| S-CAT-002 | Service-picker selection prefills line description, unitPrice, tvaRate | P1 | ❌ |
| S-CAT-003 | Service-picker hides inactive (soft-deleted) entries | P1 | 🟡 backend test |
| S-CAT-004 | Owner: POST /service-catalog creates entry | P1 | 🟡 backend test |
| S-CAT-005 | Staff: GET /service-catalog allowed (read open to all garage roles) | P1 | 🟡 backend test |
| S-CAT-006 | Staff: POST /service-catalog → 403 | P1 | 🟡 backend test |
| S-CAT-007 | Duplicate code in same garage → 409 | P1 | 🟡 backend test |
| S-CAT-008 | Soft delete: `isActive=false` on DELETE; `?hard=true` actually deletes | P2 | 🟡 backend test |
| S-CAT-009 | No admin UI page (picker only) — documented gap | — | ❌ planned |

---

## Section 13 — Inventory Wiring

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-INV-W-001 | Issue invoice with parts → StockMovement(type='out') rows + Part.quantity decremented | P0 | 🟡 backend test |
| S-INV-W-002 | Insufficient stock → 422 with `shortages: [{partId, partName, requested, available}]` | P0 | 🟡 backend test |
| S-INV-W-003 | Credit note with restockParts=true → StockMovement(type='in') + Part.quantity incremented | P0 | 🟡 backend test |
| S-INV-W-004 | Stock movement reference includes `invoice:{number}` for traceability | P1 | 🟡 backend test |
| S-INV-W-005 | Part-picker shows live stock badge "{qty} in stock" next to selected part | P0 | ❌ |
| S-INV-W-006 | Part-picker row turns red (`.error`) when row qty > available | P1 | ❌ |

---

## Section 14 — Garage Settings (Fiscal Identity)

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-SET-001 | Settings page → Fiscal tab visible (owner only) | P0 | ❌ |
| S-SET-002 | MF format validator: `1234567/A/B/000` accepted | P0 | 🟡 backend test |
| S-SET-003 | MF invalid format (e.g. `"abc"`) → 400 with class-validator message | P0 | 🟡 backend test |
| S-SET-004 | RIB validator: 20 digits accepted, anything else rejected | P0 | 🟡 backend test |
| S-SET-005 | Numbering policy change (NEVER → YEARLY → MONTHLY) reflects in next issue | P0 | 🟡 backend test |
| S-SET-006 | numberingDigitCount changes affect padding (3 → 8) | P1 | 🟡 backend test |
| S-SET-007 | defaultTvaRate change reflects in new invoice form | P1 | ❌ |
| S-SET-008 | fiscalStampEnabled toggle: stamp = 1 TND vs 0 in totals | P0 | 🟡 backend test |
| S-SET-009 | discountAuditThresholdPct change: form approver-required threshold updates | P1 | ❌ |
| S-SET-010 | Logo URL input persists; renders on PDF (URL-based, no upload pipeline yet) | P2 | ❌ |

---

## Section 15 — i18n & RTL

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-I18N-001 | Switch to French → all invoicing strings translated | P0 | ❌ |
| S-I18N-002 | Switch to Arabic → all invoicing strings translated | P0 | ❌ |
| S-I18N-003 | Arabic mode: `<html dir="rtl">` set | P0 | ✅ (after 7e3f3a6) |
| S-I18N-004 | Arabic mode: `<html lang="ar">` set | P1 | ✅ |
| S-I18N-005 | RTL: layout flips (sidebar right, content RTL) | P0 | ✅ |
| S-I18N-006 | i18n parity script: `node scripts/check-i18n-parity.js` reports drift | P1 | ✅ |
| S-I18N-007 | Toast strings translated (no raw keys visible) | P0 | ✅ (after d28a940) |
| S-I18N-008 | Form placeholders translated (selectCustomer / selectVehicle / notesPlaceholder) | P1 | ✅ (after d28a940) |
| S-I18N-009 | Status badge labels translated (DRAFT / SENT / PARTIALLY_PAID / PAID / etc.) | P0 | ✅ |
| S-I18N-010 | Number formatting respects locale (e.g. fr-TN: `1 234,567 DT`) | P1 | ✅ |
| S-I18N-011 | Date formatting respects locale | P2 | ✅ |
| S-I18N-012 | Arabic uses singular keys (`feature` not `features`, `tier` not `tiers`) | P1 | ✅ |

---

## Section 16 — Sidebar & Badge Counts

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-SB-001 | Invoicing group has 6 children: Dashboard / Quotes / All Invoices / Credit Notes / Pending Payment / Reports | P0 | ✅ |
| S-SB-002 | Quotes badge: count of SENT quotes | P1 | ✅ |
| S-SB-003 | Pending Payment badge: count of unpaid invoices (SENT + PARTIALLY_PAID + OVERDUE) | P1 | ❌ |
| S-SB-004 | Click each child → navigates to correct route | P0 | ❌ |
| S-SB-005 | Active child highlighted | P1 | ❌ |
| S-SB-006 | Sidebar collapsed mode: invoicing icon visible, hover shows children | P2 | ❌ |

---

## Section 17 — Mobile & Responsive

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-MOB-001 | 375×667 viewport: dashboard renders without horizontal scroll | P1 | ✅ |
| S-MOB-002 | Sub-nav collapses to `<select>` dropdown | P0 | ✅ |
| S-MOB-003 | "+" FAB at bottom-LEFT (no AI button overlap) | P0 | ✅ |
| S-MOB-004 | KPI tiles stack vertically | P1 | ✅ |
| S-MOB-005 | Invoice form sticky right summary collapses to bottom | P1 | ❌ |
| S-MOB-006 | Line items table: horizontal scroll OR wrapped layout | P1 | ❌ |
| S-MOB-007 | Modals (payment, send-invoice) usable at 375px | P0 | ❌ |
| S-MOB-008 | Touch targets ≥ 44×44px (WCAG) | P2 | ❌ |
| S-MOB-009 | iPad (768×1024): grid layout adapts | P2 | ❌ |

---

## Section 18 — Edge Cases & Error Handling

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-EDGE-001 | Concurrent issue: 100 parallel calls produce 100 unique gapless numbers | P0 | 🟡 backend test |
| S-EDGE-002 | Backend down: dashboard tiles show "—", page still renders | P1 | ❌ |
| S-EDGE-003 | Network failure on save: toast error, form data preserved | P1 | ❌ |
| S-EDGE-004 | Empty line items at save → form invalid | P1 | ❌ |
| S-EDGE-005 | Negative quantity / unit price → form invalid OR clamped | P1 | ❌ |
| S-EDGE-006 | Zero unit price (free service) → allowed (line total 0) | P2 | ❌ |
| S-EDGE-007 | Wrong garage tenant: GET /invoices/:id from other garage → 404 | P0 | 🟡 backend test |
| S-EDGE-008 | Wrong garage tenant: POST quote with foreign customerId → 400 | P0 | 🟡 backend test |
| S-EDGE-009 | Customer with no email and EMAIL channel → 400 + DeliveryLog FAILED | P1 | 🟡 backend test |
| S-EDGE-010 | Customer with no phone and WHATSAPP channel → 400 | P1 | ❌ |
| S-EDGE-011 | Quote auto-expire cron: SENT quotes past validUntil → EXPIRED | P1 | 🟡 backend test |
| S-EDGE-012 | Numbering allocation succeeds but invoice update fails: counter consumed (gap risk; documented trade-off) | P2 | 🟡 backend test |
| S-EDGE-013 | Credit note partial restock: only some lines restocked, others not | P2 | ❌ |
| S-EDGE-014 | LRU cache eviction: 51st PDF render evicts oldest | P2 | 🟡 backend test |
| S-EDGE-015 | Public token after invoice deletion → 404 (not 401) | P2 | ❌ |
| S-EDGE-016 | Form 423 from server: user-friendly toast (no raw error) | P1 | ❌ |
| S-EDGE-017 | Transient RangeError on payment submit re-render — non-blocking; fresh reload clean | P2 | ❌ known glitch |

---

## Section 19 — Security & Multi-Tenancy

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-SEC-001 | All `/api/invoices/*`, `/quotes/*`, `/credit-notes/*` require JWT auth | P0 | 🟡 backend test |
| S-SEC-002 | Owner of garage A cannot read invoices of garage B | P0 | 🟡 backend test |
| S-SEC-003 | Owner of garage A cannot DELETE invoice of garage B | P0 | 🟡 backend test |
| S-SEC-004 | Public token signed with `INVOICE_TOKEN_SECRET` (not generic JWT_SECRET if separate) | P1 | 🟡 backend test |
| S-SEC-005 | Public token tampered → 401 | P0 | 🟡 backend test |
| S-SEC-006 | Discount approver must be OWNER of same garage | P0 | 🟡 backend test |
| S-SEC-007 | Module access guard: invoicing requires module enabled | P1 | ❌ |
| S-SEC-008 | Rate limiting on /auth/login (existing infra; not invoicing-specific) | P2 | — |

---

## Section 20 — Performance & Scale (deferred — soft P3)

| ID | Scenario | Priority | Status |
|---|---|---|---|
| S-PERF-001 | List 1000 invoices → backend `findAll` returns all (no pagination yet) | P3 | ❌ documented gap |
| S-PERF-002 | Search "Karoui" across 1000 invoices → backend filters server-side | P3 | ❌ no server filter yet |
| S-PERF-003 | PDF render p95 < 500ms for typical 5-line invoice | P3 | ❌ |
| S-PERF-004 | Concurrent issue throughput: 50/sec sustainable | P3 | ❌ |
| S-PERF-005 | LRU cache hit ratio > 80% in steady state | P3 | ❌ |

---

## Section 21 — Stubs / Future Scope (excluded from happy-path)

| ID | Stub | Plan |
|---|---|---|
| S-STUB-001 | Templates page is "coming soon" — no real CRUD | Future task |
| S-STUB-002 | Logo file upload is URL-only (no upload pipeline) | Future task |
| S-STUB-003 | Service Catalog admin page (CRUD UI) — picker exists, no admin page | Future task |
| S-STUB-004 | Discount Audit Log viewer UI (backend writes, no UI) | Future task |
| S-STUB-005 | MECHANIC role (schema only has OWNER \| STAFF) | Schema decision |
| S-STUB-006 | Multi-currency UI (`currency` field exists, TND only in UI) | Future task |
| S-STUB-007 | Quote auto-expire cron (`expireOldQuotes()` exists, not wired to `@Cron`) | Future task |
| S-STUB-008 | Customer Statement detail page (currently inline form on Reports) | Future task |
| S-STUB-009 | Quote line `partId/mechanicId/laborHours` lost on approve→invoice | Future task |
| S-STUB-010 | Test database isolation (`prisma/seed-test.ts` + `.env.test` planned) | Future task |
| S-STUB-011 | WhatsApp Business API (currently `wa.me` link only) | Future task |
| S-STUB-012 | Recurring invoices (fleet customers, monthly contracts) | Future task |
| S-STUB-013 | Bulk actions (mark paid, batch print, batch export) | Future task |
| S-STUB-014 | Customer portal / invoice payment online | Future task |

---

## Coverage Summary

| Section | Total | ✅ | 🟡 | ⚠️ | ⏭️ | ❌ |
|---|---:|---:|---:|---:|---:|---:|
| Auth & Roles | 7 | 1 | 1 | 0 | 3 | 2 |
| Sub-navigation | 10 | 6 | 0 | 0 | 0 | 4 |
| Dashboard | 11 | 6 | 0 | 0 | 0 | 5 |
| Quotes | 23 | 4 | 2 | 0 | 0 | 17 |
| Invoices | 30 | 4 | 5 | 0 | 1 | 20 |
| Detail | 15 | 9 | 0 | 0 | 0 | 6 |
| Payments | 15 | 6 | 1 | 0 | 0 | 8 |
| Credit Notes | 16 | 5 | 8 | 0 | 0 | 3 |
| PDF | 12 | 0 | 8 | 0 | 0 | 4 |
| Delivery | 12 | 1 | 6 | 0 | 0 | 5 |
| Reports | 14 | 4 | 8 | 0 | 0 | 2 |
| Service Catalog | 9 | 0 | 6 | 0 | 0 | 3 |
| Inventory | 6 | 0 | 4 | 0 | 0 | 2 |
| Garage Settings | 10 | 0 | 7 | 0 | 0 | 3 |
| i18n & RTL | 12 | 8 | 0 | 0 | 0 | 4 |
| Sidebar | 6 | 2 | 0 | 0 | 0 | 4 |
| Mobile | 9 | 4 | 0 | 0 | 0 | 5 |
| Edge cases | 17 | 0 | 7 | 0 | 0 | 10 |
| Security | 8 | 0 | 6 | 0 | 0 | 2 |
| Performance | 5 | 0 | 0 | 0 | 0 | 5 |
| Stubs | 14 | — | — | — | — | — |
| **TOTAL** | **261 + 14 stubs** | **60** | **69** | **0** | **4** | **114** |

**Verified happy paths:** ~50% (✅ 60 + 🟡 69 of 261). Backend e2e and unit suites cover most fiscal logic; frontend e2e validation covered the critical user journey (12/13 scenarios from Phase 6.2). The 114 ❌ are mostly button-level scenarios that exist in code but were never explicitly clicked in a browser e2e pass.

---

## Recommended Next Sweeps

1. **Sweep A — Browser-verify all P0 ❌ scenarios** (~25 scenarios): cancel-draft, delete-draft, edit-draft, every line-type add/remove, mobile modals, settings save flow.
2. **Sweep B — Browser-verify all P1 ❌ scenarios** (~50 scenarios).
3. **Sweep C — Close documented stubs**: templates, logo upload, Service Catalog admin, MECHANIC role, pagination + server-side filter.
4. **Sweep D — Performance baseline**: pagination implementation + load test invoicing list / PDF render p95.

---

## How to Run

### Manually
1. Start backend: `cd opauto-backend && npm run start:dev`
2. Start frontend: `ng serve`
3. Login as `owner@autotech.tn` / `password123`
4. Walk a section by ID order. Mark ✅ / ❌ as you go.

### Via e2e-validator agent
- `/e2e S-INV-006` — runs a single scenario.
- `/e2e Section 5` — runs all S-INV-* (28 scenarios).
- `/e2e P0` — runs every P0 across all sections.

### Via integration tests (backend, where 🟡)
- `cd opauto-backend && npm run test:e2e -- {feature-name}`
- Pre-existing `seed-payments` flake is unrelated; ignore.

---

**Last updated:** 2026-04-30 after commit `7ef7d9f` (docs update for invoicing fiscal overhaul).
