# OpAuto — Bug Report & Tracker

Single source of truth for the current bug batch. Add new bugs to **§ Backlog**, promote to **§ Scoped** once investigated, update **§ Status Summary** as we fix them. We fix everything together at the end, not one-by-one.

**Legend:** 🔴 open · 🟡 in progress · 🟢 fixed · ⚪️ deferred

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
| BUG-010 | Reduce excessive hover effects | Theme | 🔴 |

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

---

## Cross-cutting Notes

- All visual fixes must use global classes from `src/styles/` — `glass-card`, `glass-modal`, `glass-dark`, `btn-primary`, `btn-secondary`, `form-input`, `form-select`. No one-off styling.
- i18n changes always hit en + fr + ar (ar uses singular keys per CLAUDE.md). Pre-commit hook validates JSON.
- After implementation: run `test-writer` for unit + integration coverage (customer form, notification bell, tour modal), then `e2e` for the four user-facing flows (tour, notifications, customers list, customer create/edit).
- Route ordering: always put `new` and `:id/edit` before `:id` so the router resolves correctly.
- When adding a new bug here, don't start fixing immediately — we batch everything and fix together.
