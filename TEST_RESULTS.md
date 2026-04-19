# OpAuto — End-to-End Test Results (2026-04-19)

Tester: Claude (automated). Demo account: `owner@autotech.tn / password123`. Fresh `opauto-db` postgres:16-alpine on :5432, Prisma `db push` + `db seed`, backend `npm run start:dev`, frontend `ng serve`.

## Summary
- **Backend API is healthy** — login + CRUD for employees, appointments, invoices, customers, cars all work at the HTTP layer.
- **UI has several real bugs** — most notably, users cannot create appointments from the UI (400 Bad Request), and the Create Invoice page is entirely unusable (untranslated i18n keys + mock data).
- **Perceived "system doesn't work"** is likely driven by (a) the appointment-create 400 bug and (b) the module gating UX: the sidebar shows paid modules the owner hasn't activated, and clicking them silently redirects to the marketplace with no toast/message.

---

## P0 — Blocks core flows

### 1. UI: "Failed to create appointment" — 400 Bad Request
- **Where**: `/appointments` → Add Appointment → Schedule Appointments
- **Request body sent by UI**:
  ```json
  {"title":"...","type":"oil-change","startTime":"...","endTime":"...","carId":"...","customerId":"...","status":"SCHEDULED","priority":"medium"}
  ```
- **Response**: `400 {"message":["property status should not exist"],"error":"Bad Request"}`
- **Root cause**: `CreateAppointmentDto` (opauto-backend/src/appointments/dto/create-appointment.dto.ts) has no `status` field, and the Nest `ValidationPipe` is `forbidNonWhitelisted`. Frontend `AppointmentService` injects `status: "SCHEDULED"` into the create payload.
- **Fix options**: strip `status` in the frontend create payload, OR accept `status?: string` in `CreateAppointmentDto`.
- **Impact**: users cannot schedule appointments from the UI at all → this alone would make users say "it doesn't work".

### 2. UI: Create Invoice page renders raw i18n keys
- **Where**: `/invoices/create`
- **Observed strings**: `invoicing.create.title`, `invoicing.create.customer *`, `invoicing.create.addItem`, `invoicing.create.createInvoice`, `invoicing.create.selectVehicle`, `invoicing.create.unitPlaceholder`, etc. — across ~20 labels.
- **Root cause**: the `invoicing.create.*` keys are missing from `src/assets/i18n/en.json` (and presumably `fr.json`/`ar.json`).
- **Impact**: page looks broken/unfinished; users can't tell what fields mean.

### 3. UI: Create Invoice page uses hardcoded mock customers (and no vehicles)
- **Where**: `/invoices/create` customer dropdown
- **Observed**: only 3 customers ("Ahmed Ben Ali", "Fatma Trabelsi", "Mohamed Khemir") — DB has 15 real customers. Vehicle dropdown is empty.
- **Confirmed via network panel**: the page never called `GET /api/customers` or `GET /api/cars` when opened.
- **Impact**: real customers can't be invoiced from this page.

### 4. UX: Paid modules shown in sidebar redirect to marketplace with zero feedback
- **Where**: sidebar — Calendar, Maintenance, Parts & Inventory, Invoicing, Reports, Pending Approval, Notifications, Employees all appear even when the OWNER hasn't activated them.
- **Behavior**: clicking e.g. Maintenance navigates to `/modules` (marketplace) silently — no toast, no banner explaining "this module requires activation".
- **Impact**: users think the menu item is broken. This is almost certainly a major driver of "the system doesn't work" complaints. Either hide unactivated modules, or show an inline paywall on the route instead of redirecting.

---

## P1 — Bugs / wrong data

### 5. Invoice `paidAt` stays `null` after payment transitions invoice to `PAID`
- **Where**: `POST /api/invoices/:id/payments` succeeds, invoice status flips to `PAID`, but `paidAt` on the invoice remains `null`. Payment record itself has `paidAt` populated.
- **Reproduced via API only**; UI not tested.

### 6. Employees page: role column shows "Senior Mechanic" for every employee regardless of DB `role`
- **Where**: `/employees`, under each employee name.
- **DB values tested**: `MECHANIC`, `TIRE_SPECIALIST` — both display as "Senior Mechanic". Likely a hardcoded label in the template.

### 7. Employees page: department shows untranslated key `employees.departments.tire-alignment` for `TIRE_ALIGNMENT`
- **Where**: Ali Khelifi's card.
- Other departments (`Mechanical`, `Bodywork`, `Electrical`) render correctly — only `tire-alignment` is missing from `employees.departments.*` i18n keys.

### 8. Currency formatting is inconsistent across pages
- Invoicing list: `7 717,150 DT` (space thousands + comma decimal + 3 decimals)
- Customers list: `8 900,00 DT` (2 decimals) and `2 415,333 DT` (3 decimals) on the same page
- Dashboard: `0,000 DT` (literally "0,000" for zero)
- **Impact**: looks unprofessional, suggests locale/format isn't centralized.

### 9. `GET /api/inventory/suppliers` returns 404
- **Where**: loaded by Parts & Inventory page.
- **Root cause**: endpoint not implemented in backend (inventory controller has no `suppliers` route).

### 10. Endpoints that 404 but are called / referenced
- `/api/dashboard` → 404 (frontend doesn't call it currently, but worth noting for future)
- `/api/garage` → 404 (real endpoint is `/api/garage-settings`)
- `/api/services` → 404 (no such controller; services likely live under maintenance/invoicing)
- `/api/modules` → returned 401 on initial load before login (expected), then 200 after auth — fine.

---

## P2 — Minor / cosmetic

### 11. Initial onboarding tour opens unconditionally after login
- First login shows "Welcome to OpAuto Professional!" onboarding modal with "Next / Skip Tour". Probably intentional, but it blocks the dashboard until dismissed.

### 12. Stale mechanic names cached in the Appointment modal dropdown
- "Test Employee" and "Temp Two" (created via API tests) appeared in the "Assigned Mechanic" dropdown even after being deleted — hint that the frontend caches employees and doesn't refresh on delete externally. Low-impact, but noted.

### 13. Unused `TranslatePipe` import in `PartModalComponent`
- Angular compiler warning at startup:
  `TS-998113: TranslatePipe is not used within the template of PartModalComponent (src/app/features/inventory/components/part-modal.component.ts:14)`.

### 14. Prisma client is v5 while CLI has a major upgrade available
- Warning on `db push`: "Update available 5.22.0 → 7.7.0". Not urgent; just noting for the upgrade backlog.

---

## What IS working (confirmed)

### Backend (all 201/200 as expected):
- `POST /api/auth/login` → JWT issued
- `GET  /api/employees | /appointments | /invoices | /customers | /cars | /maintenance | /inventory | /modules`
- `POST /api/employees` → 201
- `POST /api/appointments` → 201 (when `status` is omitted)
- `POST /api/invoices` → 201 with nested line items and totals
- `POST /api/invoices/:id/payments` → 201; invoice status flips to `PAID`
- `PUT  /api/employees/:id | /appointments/:id | /customers/:id` → 200
- `DELETE /api/employees/:id | /appointments/:id | /cars/:id | /customers/:id` → 200
- `POST /api/modules/:moduleId/purchase` → 201 (module activation works)

### UI flows:
- Login + redirect to dashboard
- Sidebar navigation, Appointments list page (empty-for-today view), Customers page (15 customers, top customers, recent), Employees page (list + stats), Invoicing list (totals + recent invoices), Module Marketplace (activate/deactivate works for Invoicing + Employees — confirmed Active Modules: 4 → 6, cost 0 → 48 TND).

---

## Environment notes
- Colima was running; no restart needed.
- Port 5432 was held by `tdx-postgres` (different project's DB, `tdx/tdx/tdx_dev`). Stopped per user approval, replaced with fresh `opauto-db` container (`postgres:postgres@localhost:5432/opauto`). Run `docker start tdx-postgres` when you need it back; note that both containers can't coexist on the host port 5432 — pick one at a time or remap.
- An old `dist/src/main` backend process (PID 37249) had been left running since Tuesday and was failing all DB queries with 500. Killed as part of the setup.
