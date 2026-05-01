# OpAuto — Bug Report & Tracker

Single source of truth for the current bug batch. Add new bugs to **§ Backlog**, promote to **§ Scoped** once investigated, update **§ Status Summary** as we fix them. We fix everything together at the end, not one-by-one.

**Legend:** 🔴 open · 🟡 in progress · 🟢 fixed · ⚪️ deferred

> **Session handoff (2026-04-21):** 15 more bugs fixed end-to-end — BUG-063, 068, 069, 073, 074 from the original list, plus new-found BUG-086a/b/c, 087d, 088a/b/c, 089, 090, 091. BUG-064, 067, 070, 071, 087a/b/c still open as genuine feature gaps (no backend model for user preferences / photos / extended Garage fields / AI page / calendar drag-drop) — these need implementation, not debugging. See **Session 2026-04-21** row block further down.
>
> **Prior handoff (2026-04-20):** BUG-019 → BUG-060 fixed that session. BUG-061 → BUG-085 were the open gaps it left behind (most now resolved above).

---

## Status Summary

**Priority:** P0 = broken core flow · P1 = missing key action · P2 = polish / i18n · P3 = large redesign

### P0 — Broken Functionality (fix first)
| ID | Area | Category | Status |
|----|------|----------|--------|
| BUG-005 | Customer add screen broken | Customers | 🟢 |
| BUG-007 | Customer delete not working | Customers | 🟢 |
| BUG-008 | Customer detail bottom tabs broken | Customers | 🟢 |
| BUG-011 | Record payment returns 404 | Invoicing | 🟢 |
| BUG-018 | Notification page filters inconsistent | Notifications | 🟢 |

### P1 — Missing Key Actions (fix second)
| ID | Area | Category | Status |
|----|------|----------|--------|
| BUG-014 | Calendar missing "Add Appointment" button | Appointments | 🟢 |
| BUG-016 | Appointment sidebar missing Edit + Cancel | Appointments | 🟢 |
| BUG-013 | Sidebar badge counts are static | Navigation | 🟢 |
| BUG-012 | Invoice print broken + needs PDF download | Invoicing | 🟢 |

### P2 — Polish / i18n / UX (fix third)
| ID | Area | Category | Status |
|----|------|----------|--------|
| BUG-001 | Tour modal overflow | Onboarding | 🟢 |
| BUG-002 | Notification panel opacity | Notifications | 🟢 |
| BUG-003 | Notification counter reset on bell click | Notifications | 🟢 |
| BUG-004 | Customers list styling diverges | Customers | 🟢 |
| BUG-006 | Missing `customers.*` i18n keys | i18n | 🟢 |
| BUG-015 | Appointment sidebar untranslated status | i18n | 🟢 |
| BUG-017 | Stock "Add Part" modal untranslated | i18n | 🟢 |

### P3 — Large Redesign (fix last)
| ID | Area | Category | Status |
|----|------|----------|--------|
| BUG-009 | Switch dashboard to white theme | Theme | 🟢 |
| BUG-010 | Reduce excessive hover effects | Theme | 🟢 |

### Session 2026-04-20 — Full-suite audit batch
| ID | Area | Category | Status | Commit |
|----|------|----------|--------|--------|
| BUG-019 | Create appointment UI returns 400 | Appointments | 🟢 | `67a7aa8` |
| BUG-020 | Invoice Create page renders raw i18n keys | i18n | 🟢 | `67a7aa8` |
| BUG-021 | Invoice Create page has 3 hardcoded mock customers | Invoicing | 🟢 | `67a7aa8` |
| BUG-022 | Paid-module click silently redirects | Navigation | 🟢 | `67a7aa8` |
| BUG-023 | All employees display role "Senior Mechanic" | Employees | 🟢 | `67a7aa8` |
| BUG-024 | Invoice `paidAt` stays null after PAID | Invoicing | 🟢 | `67a7aa8` |
| BUG-025 | Maintenance cards show "undefined Ford Focus" | Maintenance | 🟢 | `f7d27d1` |
| BUG-026 | Cars show "Total Services: 0 / N/A" always | Cars | 🟢 | `f7d27d1` |
| BUG-027 | Cars Make filter dropdown empty | Cars | 🟢 | `f7d27d1` |
| BUG-028 | `/api/inventory/suppliers` 404 | Inventory | 🟢 | `f7d27d1` |
| BUG-029 | Dashboard "Generate Invoice" → 404 | Dashboard | 🟢 | `f626fb4` |
| BUG-030 | Customers page shows 0 counts (race) | Customers | 🟢 | `f626fb4` |
| BUG-031 | Invoicing dashboard shows 0 KPIs (race) | Invoicing | 🟢 | `0d6d83b` |
| BUG-032 | Invoicing Pending raw `invoicing.pending.*` keys | i18n | 🟢 | `0d6d83b` |
| BUG-033 | Inconsistent currency format (0,000 / 2 433,55 / 7 209,000) | UI | 🟢 | `26f4de4` |
| BUG-034 | Pluralization ("1 appointments", "1 cars", "1 invoice(s)") | i18n | 🟢 | `26f4de4` |
| BUG-035 | Duplicate top-level `invoicing` key in en/fr/ar.json | i18n | 🟢 | `26f4de4` |
| BUG-036 | Onboarding tour reopens on every login | Onboarding | 🟢 | `26f4de4` |
| BUG-037 | Reports Export button was a `console.log` stub | Reports | 🟢 | `ff0f9b9` |
| BUG-038 | Maintenance "Jobs Needing Approval" confusing label | Maintenance | 🟢 | `ff0f9b9` |
| BUG-039 | Invoice detail (direct nav) shows epoch dates + empty vehicle | Invoicing | 🟢 | `4780b86` |
| BUG-040 | Inventory dashboard shows 0 counts (race) | Inventory | 🟢 | `4780b86` |
| BUG-041 | Maintenance "Complete Job" → 400 (DTO missing `completionDate`) | Maintenance | 🟢 | `4780b86` |
| BUG-042 | Maintenance new-job form raw `maintenance.new.*` keys | i18n | 🟢 | `4780b86` |
| BUG-043 | Notifications Delete silently no-op | Notifications | 🟢 | `53f9404` |
| BUG-044 | Invoice detail footer hardcoded typo `opautogatage.tn` | Invoicing | 🟢 | `a7032df` |
| BUG-045 | Invoice model missing `carId` relation (Vehicle shows empty) | Invoicing | 🟢 | `a7032df` |
| BUG-046 | Employee "Mark Unavailable" silently no-op | Employees | 🟢 | `a7032df` |
| BUG-047 | Inactive employees show "AVAILABILITY: Available" | Employees | 🟢 | `343faf5` |
| BUG-048 | Login bad credentials show no error | Auth | 🟢 | `8e588f5` |
| BUG-049 | Change Password was a stub (no backend route) | Auth | 🟢 | `8e588f5` |
| BUG-050 | Staff `GET /employees` → 403 (blocks appointment modal) | Staff | 🟢 | `0e38c00` |
| BUG-051 | Staff dashboard + sidebar fire `GET /invoices` + `/approvals` → 403 | Staff | 🟢 | `cf8705f` |
| BUG-052 | Owner-only URL redirect was silent; guard race on bootstrap | Staff | 🟢 | `cf8705f` |
| BUG-053 | Maintenance New Job form used 3 hardcoded mock mechanics | Maintenance | 🟢 | `406e2ae` |
| BUG-054 | Maintenance POST → 400 (customerId/status/tasks/approvals/mileage not in DTO) | Maintenance | 🟢 | `406e2ae` |
| BUG-055 | Maintenance PUT → 400 (same field list) | Maintenance | 🟢 | `406e2ae` |
| BUG-056 | New jobs invisible — `PENDING` ↔ `waiting` enum mismatch | Maintenance | 🟢 | `406e2ae` |
| BUG-057 | Maintenance create/update response missing relations (car/customer/mechanic empty after save) | Maintenance | 🟢 | `406e2ae` |
| BUG-058 | Maintenance tasks don't persist — no `/maintenance/:id/tasks` endpoint | Maintenance | 🟢 | `648b7b4` |
| BUG-059 | Task Complete/Start buttons didn't reach backend (updateTaskStatus went through job-update which strips tasks) | Maintenance | 🟢 | `b09b639` |
| BUG-060 | Editing any job reset its status to 'waiting' | Maintenance | 🟢 | `b09b639` |
| BUG-068 | Invoice Draft → Sent → Paid transition via UI verified end-to-end | Invoicing | 🟢 | (testing session 2026-04-21) |
| BUG-086a | Invoice list `/invoices` omitted `payments[]` → paid/remaining/progress always 0 on cards | Invoicing | 🟢 | (testing session 2026-04-21) |
| BUG-086b | Added `invoicing.list.*` namespace to en/fr/ar.json (24 keys) | i18n | 🟢 | (testing session 2026-04-21) |
| BUG-086c | Seeder now creates Payment rows for PAID invoices so UI stats reflect reality | Seed | 🟢 | (testing session 2026-04-21) |
| BUG-073 | Garage Info Save worked end-to-end after relaxing 4 over-strict validators | Settings | 🟢 | (testing session 2026-04-21) |
| BUG-087a | Garage Info form collects registrationNumber/description/website/taxId/city/postalCode/country/bankDetails but backend `Garage` schema + `mapToBackend` drop them — silent data loss | Settings | 🔴 | — |
| BUG-087b | Operations tab: "Save Capacity/Service/Appointment Settings" are silent no-ops (backend + service mapping only support `businessHours`, `currency`, `taxRate`) | Settings | 🔴 | — |
| BUG-087c | System + Integrations tabs save buttons hit backend but nothing is stored (no columns on `Garage`) | Settings | 🔴 | — |
| BUG-087d | Seed `businessHours` used abbreviated keys (`mon/tue/...`) while frontend form expects full names (`monday/tuesday/...`) with `isWorkingDay/openTime/closeTime` → Working Hours checkboxes loaded as all-unchecked, silent overwrite on save | Seed | 🟢 | (testing session 2026-04-21) |
| BUG-074 | Add Customer / Add Car / Add Part / Add Employee submit paths — all four verified end-to-end | Modals | 🟢 | (testing session 2026-04-21) |
| BUG-088a | `/inventory/suppliers` endpoint returned hardcoded `[]` — Add Part modal had no selectable supplier, making part creation impossible via UI | Inventory | 🟢 | (testing session 2026-04-21) |
| BUG-088b | Part-modal filtered suppliers by `s.isActive` but backend Supplier has no `isActive` column → all filtered out even after endpoint fixed | Inventory | 🟢 | (testing session 2026-04-21) |
| BUG-088c | CreateEmployeeDto missing `status` field → frontend sent `{status: "ACTIVE"}` and backend rejected as "property status should not exist" → Add Employee impossible via UI | Employees | 🟢 | (testing session 2026-04-21) |
| BUG-071 | Confirmed: AI module has backend endpoints (`/ai/chat`, `/ai/diagnose`, `/ai/estimate`, `/ai/suggest-schedule`) but no frontend route/page → `/ai` redirects to dashboard. Module is activatable but nothing to activate. **Feature gap, not a bug fix** — needs AI page component built. | AI | 🔴 | (confirmed 2026-04-21) |
| BUG-063 | Profile → Update Profile wired end-to-end. New backend routes `GET /users/me` + `PUT /users/me` (password/role whitelisted out). Frontend form splits "Full Name" on first space → firstName/lastName, PUTs to backend, shows toast. Verified phone update persists in DB. | Profile | 🟢 | (testing session 2026-04-21) |
| BUG-064 | Profile Preferences wired end-to-end. New `UserPreference` Prisma model (1:1 with User, auto-created via upsert), GET + PUT `/users/me/preferences` endpoints (with validation — theme ∈ {dark,light}, language ∈ {en,fr,ar}). Frontend Profile form loads on init + PUTs on save, no more setTimeout. 6 e2e tests added. | Profile | 🟢 | (session 2026-04-21) |
| BUG-065 | Approvals approve/reject buttons verified end-to-end (status + counters update). Creation must go via API — no UI "+ New Approval" button exists. Display shows "Approved by on" (missing name + date — backend has respondedBy/respondedAt but template doesn't render). | Approvals | 🟡 | (testing session 2026-04-21) |
| BUG-089 | Approval type enum aligned: frontend enum + i18n keys now match backend's 4 values (MAINTENANCE, INVOICE, PURCHASE_ORDER, DISCOUNT) | Approvals | 🟢 | (testing session 2026-04-21) |
| BUG-090 | Approval list now renders correct type label (Purchase Order, Discount, etc.) for all rows | Approvals | 🟢 | (testing session 2026-04-21) |
| BUG-066 | Stock Adjustment modal verified end-to-end (stock 8 → 13 via "Add Stock (Incoming)"). Quantity persists. | Inventory | 🟢 | (testing session 2026-04-21) |
| BUG-091 | Stock Adjustment now wired to `POST /inventory/:id/adjust` — creates `stockMovement` audit rows (type, quantity, reason persisted). Backend + frontend aligned. | Inventory | 🟢 | (testing session 2026-04-21) |
| BUG-069 | Invoice Print verified: detail page `onPrint()` calls `window.print()`. List card Print button (was a no-op `$event.stopPropagation()`) now navigates to detail with `?autoPrint=1` query param, which triggers print automatically on load. | Invoicing | 🟢 | (testing session 2026-04-21) |

### Session 2026-04-20 — Known gaps (untested / stubs / missing features)
Each is intentionally left open so the team can pick them up. Context + repro steps included for each. Date the last session touched each = 2026-04-20.

| ID | Area | Category | Status |
|----|------|----------|--------|
| BUG-061 | Forgot Password: verified graceful degradation — `AuthService.forgotPassword()` returns a clean error without hitting backend; UI displays the translated error. Not broken, just unimplemented. | Auth | 🟢 |
| BUG-062 | Expired-JWT auto-refresh — verified by code review: `auth.interceptor.ts` correctly catches 401, calls `refreshToken()`, retries original request, deduplicates concurrent refreshes, falls back to forceLogout on failure. | Auth | 🟢 |
| BUG-063 | Update Profile form submit — wired to new `/users/me` endpoint (see resolved row above) | Profile | 🟢 |
| BUG-064 | Profile Preferences tab — save is still a `setTimeout` stub (confirmed). Needs `UserPreference` Prisma model + endpoint | Profile | 🔴 |
| BUG-065 | Approvals — approve/reject buttons verified end-to-end (see resolved row above) | Approvals | 🟢 |
| BUG-066 | Stock Adjustment modal — verified + audit trail wired (see resolved row above) | Inventory | 🟢 |
| BUG-067 | Photo uploads shipped end-to-end for maintenance. Backend: multer-based `POST /maintenance/:jobId/photos` (10 MB cap, jpeg/png/webp/gif only), GET list, guarded streaming `GET /:jobId/photos/:id/file`, DELETE removes row + disk file. Storage: `uploads/<garageId>/<uuid>.<ext>`. Schema: added `filename`/`originalName`/`mimeType`/`sizeBytes`/`uploadedBy` to MaintenancePhoto. Frontend: `PhotoService` swapped from in-memory mock to HTTP (FormData + batched forkJoin), `PhotoUploadComponent` now imported + mounted in maintenance-details. 6 e2e tests + verified via Chrome DevTools upload round-trip. | Uploads | 🟢 |
| BUG-068 | Invoice Draft → Sent → Paid transition via UI — only API-tested | Invoicing | 🟢 |
| BUG-086a | Invoice list card: Paid/Remaining/Progress always 0 (list endpoint omitted `payments[]`) | Invoicing | 🟢 |
| BUG-086b | `invoicing.list.*` translation namespace missing across en/fr/ar (raw keys rendered) | Invoicing | 🟢 |
| BUG-086c | Seed: PAID invoices had no Payment rows → UI stats/progress wrong after reseed | Seed | 🟢 |
| BUG-069 | Invoice Print / PDF buttons — render but output never verified | Invoicing | 🟢 |
| BUG-070 | Calendar drag-and-drop wired end-to-end. `handleEventDrop` already persisted via appointmentService + AI conflict suggestions + closed-day modal (pre-existing); `handleDateSelect` (only TODO stub remaining) now opens the Add Appointment modal pre-filled with the clicked slot via new `AppointmentModalComponent.setInitialDate(date)`. 3 unit tests added. | Calendar | 🟢 |
| BUG-071 | AI module UI page (`/ai`) — feature gap: no frontend route/component (see confirmed row above) | AI | 🔴 |
| BUG-072 | Users page (`/users`) verified — loads 6 team members. Added ~50 missing i18n keys (`users.*`, `roles.*`, `status.*`, `permissions.*`, plus 9 new `tiers.*`) across en/fr/ar, page was rendering raw keys. | Users | 🟢 |
| BUG-073 | Settings save after edit — Garage Info tab verified end-to-end (see resolved row above). Operations/System/Integrations still silent no-ops under BUG-087a/b/c | Settings | 🟢 |
| BUG-074 | Add Customer / Add Car / Add Part / Add Employee submit — all four verified end-to-end (see resolved row above) | CRUD | 🟢 |
| BUG-075 | 403 error surfacing in components — staff edge-cases (e.g. POST protected route by accident) not verified | Staff | 🔴 |
| BUG-076 | Offline / backend-down handling — no check for how the UI degrades | Resilience | 🔴 |
| BUG-077 | Concurrent edits (two tabs editing same record) — stale-data detection untested | Resilience | 🔴 |
| BUG-078 | i18n exhaustive sweep — we fixed the keys we hit. Sub-pages we never opened may still render raw `key.name` strings | i18n | 🔴 |
| BUG-079 | Prisma migrations initialized — baselined current schema as `20260421000000_init`. Future schema changes should use `npx prisma migrate dev --name <desc>`. | DevOps | 🟢 |
| BUG-080 | Test suites run — **backend unit: 48/48 pass** (fixed 18 pre-existing `ai.service.spec` failures: stale mocks for garage.findUnique + skill query shape + reason text). **Frontend: 300/306** (fixed 14 by adding `HttpClientTestingModule` to cars spec; 6 remaining mock-shape drifts in cars.component.spec unrelated to session work — logged as BUG-092). **Backend e2e**: my 14 new specs all pass in isolation; 27 pre-existing failures in `api.e2e`/`app.e2e` (403 role-gating drift, flagged 2026-04-20) remain — logged as BUG-093. | DevOps | 🟡 |
| BUG-082 | Maintenance task complete toggle — added per-task Status select (Pending / In progress / Completed) to the maintenance form, with translations in en/fr/ar. | Maintenance | 🟢 |
| BUG-084 | Dashboard Export now exports **all** tab data (Dashboard KPIs + Financial + Operational + Customer + Inventory metrics) as a `Section,Metric,Value` CSV instead of just Dashboard KPIs. | Reports | 🟢 |
| BUG-086 | Reports Operational + Customer tabs verified — render real aggregated data (13 appointments, 92% completion, 138min avg, 65% repeat; 18 customers, 15 new, 88.9% retention). | Reports | 🟢 |
| BUG-087 | Reports date-range preset switch verified — fires full refetch of `/invoices`, `/appointments`, `/customers`, `/inventory`. | Reports | 🟢 |
| BUG-088 | Reports Refresh button verified — triggers a fresh round of all 4 data fetches. | Reports | 🟢 |
| BUG-089 | "Approved by on" display fixed — backend `approvals` endpoints now attach `requesterName` + `responderName` via a batched user lookup; frontend `mapFromBackend` routes `respondedBy`/`respondedAt` to `approvedBy`/`approvedAt` or `rejectedBy`/`rejectedAt` based on status. UI now shows "Approved by Ala Ben Khlifa on Apr 20, 2026". | Approvals | 🟢 |
| BUG-092 | `cars.component.spec.ts` — root cause was CustomerService missing from providers (`ngOnInit` forkJoins CarService + CustomerService; unstubbed CustomerService left the observable pending, so `cars` signal stayed empty). Added `CustomerService` spy + `HttpClientTestingModule` — 14/14 pass. | Tests | 🟢 |
| BUG-093 | `api.e2e-spec.ts` 403s — root cause was `/auth/register` activates only 4 free modules (dashboard/customers/cars/appointments), but tests mutated employees/inventory/maintenance/invoicing which are ModuleAccessGuard-gated. Test now activates those 5 modules for its own garage right after register. Also deleted the empty scaffolded `app.e2e-spec.ts` (hits `/` which doesn't exist — we use `/api` prefix). Added `--runInBand` to `npm run test:e2e` so api.e2e's TRUNCATE doesn't race parallel suites. 61/61 pass. | Tests | 🟢 |
| BUG-081 | Arabic RTL layout intentionally disabled (`LanguageService.updateDocumentDirection` hardcodes `dir=ltr`). Many `[dir="rtl"]` CSS selectors are dead code. Team decision to enable at some point | i18n | ⚪️ |
| BUG-082 | Maintenance form UI has no "complete task" toggle — completion only via /details page | Maintenance | 🔴 |
| BUG-083 | Backend `MaintenanceTask` model has only `isCompleted` boolean — no intermediate "in-progress" state to let mechanics track tasks they've started but not finished | Maintenance | 🔴 |
| BUG-084 | Dashboard `Export` only exports the Dashboard tab's KPIs, not the Financial / Operational / Customer / Inventory tab data | Reports | 🔴 |
| BUG-085 | `opauto-db` docker container still running after the session; user's pre-existing `tdx-postgres` is stopped. Need to restart tdx when user needs that other project's DB | Env | ⚪️ |
| BUG-086 | Reports Operational + Customer tabs — clicked but contents never verified | Reports | 🔴 |
| BUG-087 | Reports date-range dropdown — never switched preset to confirm data refetches | Reports | 🔴 |
| BUG-088 | Reports Refresh button — clicked but never confirmed it fires a data reload | Reports | 🔴 |

### Environment notes
- Frontend: `http://localhost:4200` (Angular dev server PID in `/private/tmp/.../bz6bmkmmz.output`)
- Backend: `http://localhost:3000` (Nest dev server PID in `/private/tmp/.../b81ouxdwr.output`)
- DB: `opauto-db` docker container on `localhost:5432` with `postgres:postgres@opauto`
- Seed: last run with `npx prisma db seed` on 2026-04-20. Creates `owner@autotech.tn / password123` + 5 staff accounts (`mohamed/khalil/youssef/hichem/ali` all `staff123`)
- When cleaning up: `docker stop opauto-db` then `docker start tdx-postgres` to restore the other project

---

## Scoped (investigated, ready to fix)

### BUG-001 · Guided tour modal content overflows 🔴
- **Where:** `src/app/shared/components/onboarding-tour/onboarding-tour.component.html` + `.css`
- **Symptom:** Text and Précédent / Suivant buttons spill outside the rounded card (FR, step 3/8 "Gestion des Stocks" reproduces it).
- **Root cause:** `.tour-tooltip` (css:43–55) has no `overflow` or `max-height`; `.tour-content` (css:85–87) has no scrolling; `.tour-actions` (css:114–119) has no `flex-wrap`. Template uses `glass-card` (semi-transparent) instead of `glass-modal`.
- **Fix direction:**
  - Swap `glass-card` → `glass-modal` in the template.
  - `.tour-tooltip`: `overflow: hidden; max-height: 80vh;`
  - `.tour-content`: `overflow-y: auto`; constrained height so body scrolls and actions stay pinned.
  - `.tour-actions`: `flex-wrap: wrap; flex-shrink: 0;`

### BUG-002 · Notification dropdown is semi-transparent 🔴
- **Where:** `src/app/shared/components/notification-bell/notification-bell.component.ts` (inline template, `.notification-dropdown` uses `glass-card`).
- **Symptom:** Page content bleeds through the dropdown (see screenshot — "Contrôle qualité" label visible inside the panel).
- **Fix direction:** Swap `glass-card` → `glass-modal` on `.notification-dropdown`. `glass-modal` is ~95% opaque and already in the global stylesheet.

### BUG-003 · Notification unread counter doesn't reset on bell click 🔴
- **Where:** `notification-bell.component.ts:272` (`toggleDropdown()`).
- **Symptom:** Badge stays at the unread number after the dropdown opens.
- **Decision:** debounce — reset only after the dropdown has been open ≥1s.
- **Fix direction:**
  - In `toggleDropdown()`: on open, start a 1000ms timer; on timeout, call `notificationService.markAllAsRead()` (already exists, `notification.service.ts:54`).
  - If the user closes the dropdown before 1s, cancel the timer (no reset).
  - Clean up the timer in `ngOnDestroy`.
  - Keep the existing "Mark all read" button as an immediate override.

### BUG-004 · Customers list styling diverges from other pages 🔴
- **Where:** `src/app/features/customers/customers.component.html` (header lines 2–44, "Add Customer" button currently at line 243 in the filter row).
- **Symptom:** Add Customer button is buried in the filter row with `btn-primary flex-1`; Cars, Appointments, and Inventory all put it in the page header, top-right.
- **Fix direction:**
  - Move the button out of the filter row into the page header, top-right.
  - Use fixed-width `btn-primary` (drop `flex-1`).
  - Header layout: `flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4` per `docs/UI-SYSTEM.md:94–103`.
  - Keep `btn-clear-filters` in the filter row.

### BUG-005 · Customer "Add" screen is broken 🔴
- **Where:**
  - `src/app/app-routing-module.ts:71–79` — no `/customers/new` route.
  - `src/app/features/customers/customers.component.ts:123` — navigates to non-existent `/customers/add`.
  - `customer-details.component.*` — currently handles view + edit for existing customers only, no create mode.
- **Symptom:** Screen shows read-only detail layout with title "Nouveau client" but no form inputs; most labels are untranslated `customers.*` keys.
- **Decision:** build a dedicated `CustomerFormComponent` that handles both create and edit.
- **Fix direction:**
  - New files: `customer-form.component.ts` / `.html` / `.css` under `src/app/features/customers/components/`.
  - Reactive form fields (port from existing `editForm` in `customer-details.component.ts:34–45`): name, phone, email, street, city, postalCode, country, status, preferredContactMethod, notes.
  - Routes (order matters):
    ```
    { path: 'customers/new',      component: CustomerFormComponent }
    { path: 'customers/:id/edit', component: CustomerFormComponent }
    { path: 'customers/:id',      component: CustomerDetailsComponent }
    ```
  - Save: create → `customerService.createCustomer()` → `/customers/:newId`. Edit → `customerService.updateCustomer()` → `/customers/:id`.
  - Cancel: create → `/customers`, edit → `/customers/:id`.
  - Fix `customers.component.ts:123`: `/customers/add` → `/customers/new`.
  - `CustomerDetailsComponent`: strip the inline `editForm` and `isEditing` signal, turn "Edit" button into `router.navigate(['/customers', id, 'edit'])`.
  - Reuse `glass-card`, `form-input`, `form-select` global classes.

### BUG-006 · Many `customers.*` translation keys are missing 🔴
- **Where:** `src/assets/i18n/en.json`, `fr.json`, `ar.json`.
- **Missing keys (confirmed):**
  - `customers.edit`, `customers.delete`
  - `customers.customerMetrics`
  - `customers.cars`, `customers.visits`, `customers.noCars`
  - `customers.newAppointment`, `customers.createInvoice`
  - `customers.form.contactMethods.phone` / `.email` / `.sms` / `.whatsapp`
- **Decision:** add the new short keys (don't refactor the template to reuse `customers.editCustomer` / `.deleteCustomer`).
- **Fix direction:** add all missing keys in en + fr + ar. Arabic uses singular keys for the relevant cases per CLAUDE.md. Pre-commit hook validates i18n JSON — keep all three files aligned.

### BUG-007 · Customer delete button doesn't work 🔴
- **Where:** `customer-details.component.ts:160–173` (`onDelete()`).
- **Symptom:** User reports delete doesn't work.
- **Status:** needs live reproduction. Handler exists and calls `customerService.deleteCustomer()` (service method exists at `customer.service.ts:135`).
- **Fix direction:** reproduce via Chrome DevTools MCP, inspect Network + console. Likely candidates: missing confirm dialog wire-up, missing post-delete navigation, backend endpoint 404, or RBAC block. Patch the minimum.

### BUG-008 · Customer detail bottom tabs don't switch / show wrong data 🔴
- **Where:** `customer-details.component.html:245–294` (Cars / Appointments / Invoices tabs).
- **Symptoms:**
  - Tabs are static — no active-tab state or click handler.
  - Tab labels are untranslated (`customers.cars (0)`, `customers.noCars`) — covered by BUG-006.
  - User reports tables "don't work or show incorrect data".
- **Fix direction:**
  - Add `activeTab` signal (default `'cars'`), wire each header to set it, use `*ngIf` / `*ngSwitch` to render the matching section.
  - Data already fetched by `loadHistory()` → `history()` signal from `customerService.getCustomerHistory()` at `customer.service.ts:281`.
  - Verify counts and row fields match backend response; patch the mapper in `getCustomerHistory` if the shape is off.

### BUG-009 · Switch whole dashboard to white theme 🔴
- **Where:** global — `src/styles/` (tokens, glass classes), every feature module that uses dark backgrounds directly.
- **Symptom:** App is currently dark glassmorphism throughout; user wants a light/white themed dashboard instead.
- **Scope:** this is a large cross-cutting redesign, not a one-file fix. Needs a dedicated pass.
- **Fix direction (to confirm with user before starting):**
  - Introduce a light color palette in `src/styles/` (background, surface, text, border, accent).
  - Recolor the global glass classes (`glass-card`, `glass-modal`, `glass-dark`, `glass-nav`) — either flip them to light variants or replace with new `card` / `surface` classes.
  - Audit every feature page that uses hard-coded dark colors (`bg-gray-900`, `#0b0829`, `rgba(11,8,41,...)`, etc.) and replace with the new tokens.
  - Update the onboarding tour, notifications, sidebar, top bar, and charts (FullCalendar, dashboard widgets) for contrast.
  - Keep RTL + i18n intact. Re-verify color contrast (WCAG AA) for text on light backgrounds.
- **Open question:** do we need a theme toggle (light + dark) or full replacement? Confirm before implementation.

### BUG-010 · Reduce excessive hover effects across the app 🔴
- **Where:** global — buttons, cards, nav items, table rows, tiles, stat cards, modals. Many components apply `:hover` transforms, glows, scale, and color shifts simultaneously.
- **Symptom:** Hovering almost anything triggers a visual effect — feels busy and distracting. Especially noticeable on **cards** (stock page part cards, dashboard stat cards, customer cards, etc.) which are not clickable actions but still glow/scale on hover.
- **Example:** stock/inventory page cards all light up on hover despite being static display panels.
- **Fix direction:**
  - **Cards/panels first (highest priority):** remove hover from `glass-card` and all static display cards across every feature page. Cards that are NOT clickable should have zero hover effect.
  - Audit `src/styles/` for `:hover` rules on shared classes (`glass-card`, `btn-*`, `nav-*`, list rows, stat tiles).
  - Audit every feature component's own CSS for local `:hover` rules on cards/panels.
  - Keep hover only on truly interactive elements (buttons, links, clickable table rows, nav items).
  - For interactive elements, keep a single subtle effect (background/border shift) — drop combos like transform + glow + shadow + scale on the same element.
  - Respect `prefers-reduced-motion`.

### BUG-011 · Record payment returns 404 🔴
- **Where:** invoicing / payments flow — frontend payment service call + backend endpoint.
- **Symptom:** Clicking "Record Payment" fails with HTTP 404.
- **Status:** needs investigation. Likely mismatch between frontend URL and backend route, or the endpoint is missing entirely.
- **Fix direction (to verify live):**
  - Reproduce in browser, capture the exact request URL + method + payload from Network tab.
  - Check frontend payment service (likely `src/app/core/services/` or `src/app/features/invoicing/`) for the request path.
  - Check backend for the matching controller route (likely `opauto-backend/src/invoicing/` or `opauto-backend/src/payments/`).
  - Fix whichever side is wrong — prefer fixing the frontend path if the backend contract is already established, otherwise add the missing backend endpoint.
  - Verify with curl against `http://localhost:3000/api/...` before touching code.

### BUG-012 · Invoice print is broken + needs PDF download 🔴
- **Where:** invoicing feature — likely `src/app/features/invoicing/` (invoice detail or list component).
- **Symptom:** Clicking "Print" renders a messy output — the dark glassmorphism theme, sidebars, and interactive elements all bleed into the print view. No PDF download option exists.
- **Fix direction:**
  - **Print view:** create a dedicated print-friendly layout (white background, clean typography, no nav/sidebar/header chrome). Use `@media print` in a global print stylesheet + hide non-printable elements. Alternatively, render a separate print-optimized component in a hidden container and call `window.print()` on it.
  - **PDF download:** generate a client-side PDF from the print-ready HTML. Options:
    - `html2canvas` + `jsPDF` (lightweight, no backend dependency)
    - Or backend-side PDF generation via a `/api/invoices/:id/pdf` endpoint if server-rendered is preferred.
  - Invoice layout should include: garage logo/name, invoice number, date, customer info, line items table, totals, payment status, footer notes. All properly formatted for A4.
  - Add a "Download PDF" button next to the existing "Print" button.
  - Respect i18n — the printed invoice should match the user's current locale (FR/EN/AR+RTL).

### BUG-013 · Sidebar badge counts are static, not dynamic 🔴
- **Where:** sidebar / nav component — likely `src/app/shared/components/sidebar/` or `src/app/core/components/sidebar/`.
- **Symptom:** Badge numbers next to sidebar items (e.g. Rendez-vous, En attente d'approbation) are hardcoded. They don't reflect actual counts from the backend.
- **Fix direction:**
  - Identify every sidebar item that has a badge and determine what each count should represent (e.g. today's appointments, pending approvals, overdue invoices, unread notifications, low-stock parts).
  - Create or reuse a dashboard/stats service that fetches counts from the backend (likely `/api/reports/dashboard` or individual endpoints).
  - Bind each badge to the live count via signals or observables.
  - Poll or refresh on navigation / relevant CRUD operations so badges stay current.
  - Hide the badge when the count is 0.

### BUG-014 · Calendar view missing "Add Appointment" button 🔴
- **Where:** `src/app/features/appointments/` — the calendar view (likely uses FullCalendar).
- **Symptom:** No way to create a new appointment from the calendar view; the list view has the button but the calendar view does not.
- **Fix direction:**
  - Add a `btn-primary` "Add Appointment" button to the top-right of the calendar view header, matching the standard page-header pattern from `docs/UI-SYSTEM.md:94–103`.
  - Button navigates to the appointment creation form (same target as the list view's add button).
  - Note: `handleDateSelect` in the calendar component has a TODO stub (per CLAUDE.md) — consider wiring date-click to open the add form pre-filled with the selected date/time slot as a bonus, but the button alone is the minimum fix.

### BUG-015 · Appointment detail sidebar shows untranslated status keys 🔴
- **Where:** calendar appointment detail sidebar — likely `src/app/features/appointments/` (a side-panel or drawer component that opens on event click).
- **Symptom:** Status field displays raw translation keys like `dashboard.status.confirmed` instead of the translated text.
- **Root cause (to verify):** the template is passing the key through `{{ }}` interpolation without the `translate` pipe, or the keys under `dashboard.status.*` are missing from the i18n files.
- **Fix direction:**
  - Check the sidebar template — ensure status uses `{{ statusKey | translate }}` (or `[translate]` directive).
  - Verify `dashboard.status.confirmed`, `dashboard.status.pending`, `dashboard.status.cancelled`, etc. exist in en.json, fr.json, and ar.json. Add any missing keys.
  - If the sidebar uses a different key namespace than the rest of the appointment flow, unify them.

### BUG-016 · Appointment sidebar missing Edit + Cancel actions 🔴
- **Where:** calendar appointment detail sidebar (same component as BUG-015).
- **Symptom:** No way to edit or cancel an appointment from the sidebar — it's read-only.
- **Fix direction:**
  - **Edit button:** add a `btn-secondary` "Edit" action that navigates to the appointment edit form (or opens an inline edit mode, depending on existing pattern). Should always be visible.
  - **Cancel button:** add a `btn-danger` "Cancel" action with **status-dependent visibility**:
    - Show only when the appointment status allows cancellation (e.g. `pending`, `confirmed`).
    - Hide when the appointment is already `cancelled`, `completed`, or `in_progress`.
    - On click: show a confirmation dialog before calling the cancel/update endpoint.
    - After cancellation: update the calendar event color/status, refresh the sidebar, and update sidebar badge counts (ties into BUG-013).
  - Check the appointment service for existing `updateAppointment` / `cancelAppointment` methods — reuse if available.
  - Translate all button labels and confirmation dialog text in en/fr/ar.

### BUG-017 · Stock "Add Part" modal strings not translated 🔴
- **Where:** `src/app/features/inventory/` — the add/edit part modal/dialog.
- **Symptom:** All strings in the "Add New Part" modal display as raw keys or English-only text, no translation.
- **Fix direction:**
  - Identify every string in the modal template (field labels, placeholders, buttons, validation messages).
  - Add corresponding keys under the `inventory.*` or `parts.*` namespace in en.json, fr.json, ar.json.
  - Apply `| translate` pipe to all strings in the template.
  - Verify with FR and AR locales.

### BUG-018 · Notification page filters not working consistently 🔴
- **Where:** notification list/page — likely `src/app/features/notifications/` or a dedicated notifications page (not the bell dropdown). Top filter buttons/chips for filtering by type, read/unread, etc.
- **Symptom:** Filters behave inconsistently — some don't filter, some filter wrong items, or state resets unexpectedly.
- **Status:** needs investigation. Reproduce each filter combination, check the filtering logic (client-side pipe/computed signal vs server-side query params), and identify which specific filters are broken.
- **Fix direction (after investigation):**
  - Map each filter to its handler — check whether it's filtering the local array or re-fetching from the backend.
  - Verify filter predicates match the notification data shape (field names, enum values).
  - Ensure filters compose correctly when multiple are active simultaneously.
  - Check for state reset bugs (e.g. switching filters clears previous selections).

---

## Backlog (add new bugs here)

_Use this template:_

```
### BUG-NNN · <one-line title> 🔴
- **Where:** <page / file>
- **Symptom:** <what the user sees>
- **Screenshot:** <optional path or description>
- **Notes:** <any extra context>
```

### BUG-094 · Invoice edit-form hydrates line items with wrong `type` and `tvaRate` 🟢
- **Where:** `src/app/features/invoicing/components/invoice-form.component.ts:299-313` (`loadInvoice` → `lines.set(...)`).
- **Symptom:** After saving a DRAFT invoice and reopening `/invoices/edit/:id`, line items displayed `type` = "Service" and TVA = "0%" regardless of persisted values. Silent data-corruption risk on re-save.
- **Root cause:** (a) `type: li.type as LineItemType` cast a backend `String?` column blindly — the `<select [value]>` template binding fell back to the first `<option>` when the cast value didn't match the union; (b) `(li as any).tvaRate ?? inv.taxRate ?? this.defaultTva()` cascaded through the legacy invoice-level `inv.taxRate` (often 0 or undefined post-fiscal-overhaul), and `normalizeTvaRate()` zeroed non-bucket values.
- **Fix (2026-04-30):** added `coerceLineType(raw): LineItemType` and `coerceTvaRate(raw): TvaRate` helpers; `loadInvoice` now calls those and never falls through to `inv.taxRate`. Three new specs in `invoice-form.component.spec.ts` cover persisted lines, missing/unknown type, and numeric-string tvaRate. `docs/INVOICING_E2E_SCENARIOS.md → S-INV-031` flipped to ✅.

### BUG-095 · Quote-detail page is missing an Edit affordance for DRAFT quotes 🟢
- **Where:** `src/app/features/invoicing/pages/quote-detail/` (HTML template — search for the action bar near `recordPayment`/`approve`/`send`/`reject`).
- **Symptom:** S-QUO-018 (Edit-quote-after-send → blocked) passes incidentally because the Edit button is absent for **all** statuses, not just SENT/APPROVED. That same absence breaks **S-QUO-010** (Edit DRAFT quote — totals recompute on line change): users can't reopen a DRAFT quote to edit lines, and the only path to fix a typo is to delete + recreate.
- **Surfaced by:** Sweep A Group 3 e2e validator pass (2026-04-30).
- **Reproduce:** create a DRAFT quote → open detail page → confirm there is no "Edit" button. Compare with `invoice-details.component.html` which renders an Edit button when `canShow('edit')` returns true (DRAFT path).
- **Fix (Sweep C — 2026-05-01):** added `edit()` handler in `quote-detail.component.ts` (gated by `q.status === 'DRAFT'`, navigates to `/invoices/quotes/edit/:id`); added `quotes/edit/:id` route ahead of `quotes/:id`; rebuilt `quote-form.component.ts` to support edit mode via paramMap (`loadQuote()` → form.patch + lines.set, redirects to detail when status ≠ DRAFT, calls `quoteService.update()` on submit, cancel returns to detail); new i18n keys `invoicing.quotes.detail.edit`, `quotes.form.editTitle`, `submitEdit`, `updated`, `updateFailed`, `loadFailed` (en/fr/ar). 5 new specs in `quote-form.component.spec.ts` cover hydration, lock redirect, update path, and cancel routing; 5 new specs in `quote-detail.component.spec.ts` cover the Edit button visibility + navigation guard. S-QUO-010 verified end-to-end via Chrome DevTools MCP (DRAFT quote 100 → 175 TND, total recomputes to 208.25 with TVA).
- **Priority:** P1.

### BUG-096 · Service-picker and part-picker fetch the entire catalog and filter in-memory 🔴
- **Where:** `src/app/features/invoicing/components/service-picker/service-picker.component.ts` (`ngOnInit` → one-shot `GET /api/service-catalog`); same pattern in `part-picker/part-picker.component.ts` against `GET /api/inventory`.
- **Symptom:** Both pickers are O(n) on the entire catalog every keystroke (signal `computed()` over the full client-cached array). Acceptable for the seeded handful of rows; will not scale past low hundreds.
- **Surfaced by:** Sweep A Group 2 e2e validator (S-QUO-003 / S-QUO-004) — the validator noted that no `?search=` query param is sent, divergent from the worded scenario expectation but not a regression today.
- **Suggested fix:** add a `query` signal driven by the user's typed text, debounce ~250ms with `toObservable()` → `switchMap` to `this.http.get(?search=...)`, render results as they arrive. Backend service-catalog and inventory routes already accept search/limit query params (verify). Keep the in-memory path as a fallback for offline / cold cache.
- **Priority:** P3 — perf gap, ship-blocking only when the catalog grows.

### BUG-097 · Backend `DELETE /api/invoices/:id` returns 200 instead of 204 🔴
- **Where:** `opauto-backend/src/invoicing/invoicing.controller.ts:95-100` (`@Delete(':id')` → `service.remove(...)` returns the deleted invoice; controller returns it directly).
- **Symptom:** Successful DELETE responds with status 200 and the deleted invoice as body. Standard REST convention (and our `S-INV-016` scenario doc) expects 204 No Content for DELETE.
- **Surfaced by:** Sweep A Group 3 e2e validator (2026-04-30).
- **Suggested fix:** either (a) annotate the controller method with `@HttpCode(HttpStatus.NO_CONTENT)` and return `void` from the service path, OR (b) update `S-INV-016` in the scenario doc to expect 200 + body. Pick one and document the FE expectation. The FE side currently doesn't read the response body anyway (just navigates on success).
- **Priority:** P3 — works today, just an inconsistency.

### BUG-098 · `MaintenanceService.mapFromBackend` drops `customerId` 🟢
- **Where:** `src/app/core/services/maintenance.service.ts:266` (search for `mapFromBackend` — likely reads `b.customerId`).
- **Symptom:** Any consumer reading `job.customerId` gets `undefined` because the backend payload nests the customer id under `b.car.customerId`, not at the top level. Invoice-form's `linkJobById()` was assigning `customerId: undefined` into the FormGroup, which silently cleared the form's customer field when a user picked a maintenance job. Now patched locally inside invoice-form (commit pending), but other consumers (anywhere that reads `MaintenanceJob.customerId` after `mapFromBackend`) silently regress.
- **Surfaced by:** Sweep A Group 4 e2e validator (S-INV-019 — 2026-04-30).
- **Fix (Sweep C — 2026-05-01):** `mapFromBackend` now reads `customerId: b.car?.customerId ?? b.customerId`. Also dropped the local workaround in `invoice-form.linkJobById()` that derived the customerId from the cars list — the mapper is now the single source of truth. 3 new specs in `maintenance.service.spec.ts` cover nested-customer, top-level fallback, and the prefer-nested-over-top precedence.
- **Priority:** P1 — silent regression risk for any future consumer that grabs `job.customerId`.

### BUG-099 · `InvoiceService.mapFromBackend` drops `maintenanceJobId` and `quoteId` 🟢
- **Where:** `src/app/core/services/invoice.service.ts:152-200` (the `mapFromBackend` method).
- **Symptom:** The typed `InvoiceWithDetails` model exposes `appointmentId` but not `maintenanceJobId` or `quoteId`, even though the backend persists both. After a page refresh on `/invoices/:id`, the invoice-form cannot show the linked-job badge or the linked-quote attribution because the mapper has already discarded the IDs. Worked around for the pull-from-job flow via a `?jobId=` query param, but proper fix is to expose both fields on the typed model.
- **Surfaced by:** Sweep A Group 4 e2e validator (S-INV-019 — 2026-04-30).
- **Fix (Sweep C — 2026-05-01):** added `maintenanceJobId?: string` and `quoteId?: string` to the `Invoice` interface (inherited by `InvoiceWithDetails`), populated both in `InvoiceService.mapFromBackend`. Removed the `?jobId=` query-param workaround from `invoice-form.pullFromJob()` and `loadInvoice()` — the form now reads directly from `inv.maintenanceJobId`. 2 new specs in `invoice.service.spec.ts` cover the round-trip + the undefined-when-omitted contract.
- **Priority:** P1 — blocks S-DET-014 (page focus refresh / linked-document badge persistence) and BUG-095's quote-edit flow once that lands.

### BUG-100 · Payment modal in landscape 667×375 requires scroll inside dialog 🔴
- **Where:** `src/app/features/invoicing/components/payment-modal/payment-modal.component.css` (`.payment-modal__content` `max-height: 90vh` overflows in landscape).
- **Symptom:** On a 667×375 landscape phone, the Submit button is below the fold inside the dialog; user must scroll within the modal to reach it. Acceptable today since the dialog is scrollable, but a sticky footer pattern would be cleaner UX.
- **Surfaced by:** Sweep A Group 4 e2e validator (2026-04-30, side note from S-MOB-007).
- **Suggested fix:** convert the modal footer to `position: sticky; bottom: 0` with a backdrop fade, or split the body into a flex column with `flex: 1; overflow: auto` for the content and the action row pinned outside it.
- **Priority:** P3 — works today, just suboptimal in landscape.

### BUG-102 · S-DET-010 print-emulation walk-through blocked by local Postgres outage 🔴
- **Where:** Local dev environment — `localhost:5432` was unreachable during Sweep C-1, so `POST /api/auth/login` returned 500 and the Chrome DevTools MCP browser pass for **S-DET-010** (`@media print` chrome hiding) couldn't run.
- **Symptom:** Login fails with "Invalid username/email or password" toast; backend `/private/tmp/opauto-backend.log` shows `PrismaClientKnownRequestError: Can't reach database server at localhost:5432`. Frontend e2e flows that need authenticated routes (any `/invoices/*` page) are blocked. Affects S-DET-010 specifically because the print-emulation contract can only be verified visually, not via Karma — the spec coverage is solid (DOM-class regression + `onPrint()` invocation) but a full snapshot in print-mode is the gold standard.
- **Surfaced by:** Sweep C-1 Chrome DevTools MCP run (2026-05-01).
- **Suggested fix:** restart the local DB (Docker Compose / Postgres-app / however the dev environment is wired). Repro the print-emulation walk-through once the DB is back: navigate to a SENT invoice → `mcp__chrome-devtools__emulate` with `colorScheme: 'light'` (or `media: 'print'` if the tool exposes it) → `take_snapshot` → confirm only the invoice content is visible (no sidebar, no top bar, no action bar, no aside, no FAB). Flip S-DET-010 from ⚠️ to ✅ in `docs/INVOICING_E2E_SCENARIOS.md` once verified.
- **Priority:** P3 — **NOT a product bug**, just a local-env blocker that prevented one of the four Sweep C-1 visual checks. The spec coverage is sufficient to lock the contract; this is logged for sweep-completeness audit only.

### BUG-101 · Invoice form spams Angular `disabled`-attribute warnings under reactive forms 🔴
- **Where:** `src/app/features/invoicing/components/invoice-form.component.html` — every `[disabled]="isLocked() || ..."` binding on a control declared via `formControlName` (`customerId`, `carId`, `maintenanceJobId`, `dueDate`, `notes`) trips Angular's `Reactive form …disabled attribute` warning.
- **Symptom:** Console accumulates 7 `[warn]` messages on every invoice-form render. Functional behaviour is correct (the inputs do disable when the invoice is locked), but the noise drowns out real warnings during e2e debugging.
- **Surfaced by:** Sweep B-1 Chrome DevTools MCP run (2026-05-01) on `S-INV-021` / `S-INV-024`.
- **Suggested fix:** disable the controls from the component class (`this.form.get('customerId')?.disable()`) inside an `effect()` that watches `isLocked()`, OR drop `formControlName` on the locked-aware fields and read/write through `[value]` + `(input)` like the line-item rows already do.
- **Priority:** P3 — pure log-noise, no user-visible impact. Logged for the next form-cleanup sweep.

---

## Cross-cutting Notes

- All visual fixes must use global classes from `src/styles/` — `glass-card`, `glass-modal`, `glass-dark`, `btn-primary`, `btn-secondary`, `form-input`, `form-select`. No one-off styling.
- i18n changes always hit en + fr + ar (ar uses singular keys per CLAUDE.md). Pre-commit hook validates JSON.
- After implementation: run `test-writer` for unit + integration coverage (customer form, notification bell, tour modal), then `e2e` for the four user-facing flows (tour, notifications, customers list, customer create/edit).
- Route ordering: always put `new` and `:id/edit` before `:id` so the router resolves correctly.
- When adding a new bug here, don't start fixing immediately — we batch everything and fix together.
