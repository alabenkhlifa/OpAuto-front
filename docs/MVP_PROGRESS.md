# OpAuto MVP Implementation Progress

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
- [ ] Predictive Maintenance — AI section on car detail view, backend endpoint, service timeline
- [ ] Customer Churn Prediction — identify at-risk customers, backend endpoint, UI display

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
- [ ] **Tasks don't persist** — backend has no `/maintenance/:id/tasks` endpoint; frontend sends `tasks` array but it's stripped. Separate feature to implement.
