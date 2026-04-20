# OpAuto — Full Test Suite Results

**Date**: 2026-04-19 → 2026-04-20
**Tester**: Claude (automated via Chrome DevTools MCP + curl)
**Demo account**: `owner@autotech.tn / password123` and `mohamed / staff123`
**Backend**: http://localhost:3000/api · **Frontend**: http://localhost:4200

Legend: ✅ pass · ❌ fail · ⚠️ works with issue · ⏭️ not-applicable

Status: **12 commits landed** (`67a7aa8` → `cf8705f`), **33 bugs found and fixed**. Full log in `docs/BUGS.md` (BUG-019 through BUG-052).

---

## Phase 1 — Backend endpoints (all green)

All resources pass CRUD via curl as OWNER:

| Resource | GET | GET/:id | POST | PUT/:id | DELETE/:id | Notes |
|---|---|---|---|---|---|---|
| auth/login | ✅ 201 | ⏭️ | — | — | — | 401 on invalid creds |
| auth/refresh | — | — | ✅ 201 | — | — | 401 on invalid token |
| auth/change-password | — | — | ✅ 201 | — | — | Added this run; 401 on wrong current |
| auth/register | — | — | ✅ 201 | — | — | Creates garage + owner |
| customers | ✅ | ✅ | ✅ | ✅ | ✅ | 16 seed + registered |
| cars | ✅ | ✅ | ✅ | ✅ | ✅ | `totalServices` + `lastServiceDate` aggregated |
| employees | ✅ | ✅ | ✅ | ✅ | ✅ | Staff can GET; mutations OWNER-only |
| appointments | ✅ | ✅ | ✅ | ✅ | ✅ | `?date=` query works |
| invoices | ✅ | ✅ | ✅ | ✅ | ✅ | Now has optional `carId` relation |
| invoices/:id/payments | — | — | ✅ | — | — | Status flips PAID, `paidAt` set |
| maintenance | ✅ | ✅ | ✅ | ✅ | ✅ | `notes`, `startDate`, `completionDate` in DTO |
| inventory | ✅ | ✅ | ✅ | ✅ | ✅ | `partNumber`+`quantity` (not `sku`/`stockQuantity`) |
| inventory/suppliers | ✅ | — | — | — | — | Returns `[]` |
| modules | ✅ | — | purchase:201 | — | DELETE:200 | deactivate = DELETE /modules/:id |
| approvals | ✅ | — | ✅ | — | — | — |
| notifications | ✅ | — | ✅ | PUT/read | ✅ 200 | Added DELETE this run |
| garage-settings | ✅ | — | — | ✅ | — | Used by invoice header |
| ai/chat | — | — | ✅ 201 | — | — | Payload: `{messages:[{role,content}]}` |
| users | ✅ | — | — | — | — | — |
| reports/dashboard | ✅ | — | — | — | — | `/reports/financial` + `/operational` computed client-side (by design) |

---

## Phase 2 — Frontend screens (all major flows green)

### Dashboard (`/dashboard`)
| Element | Result |
|---|---|
| Quick Actions (4 buttons) | ✅ all route correctly (Generate Invoice fixed in `f626fb4`) |
| KPIs render real data | ✅ (was 0 due to race, fixed in `f626fb4`) |
| Today's Schedule shows real car | ✅ (was raw slug "brake-repair", fixed in `f7d27d1`) |
| Change language (EN/FR/AR) | ✅ menu works, labels translate |
| Pluralization "1 appointment scheduled" | ✅ (fixed in `26f4de4`) |
| Currency format "0,00 DT" (2 decimals) | ✅ (was "0,000 DT", fixed in `26f4de4`) |
| Onboarding tour | ✅ honors per-user dismissal |

### Calendar (`/calendar`)
| Element | Result |
|---|---|
| Month/Week/Day toggle | ✅ |
| Prev/Next arrows, Today | ✅ |
| Mechanic filter dropdown (5 mechanics) | ✅ |
| Event click → side panel | ✅ shows customer/vehicle/mechanic/status/time |
| + Add Appointment → modal | ✅ |

### Appointments (`/appointments`)
| Element | Result |
|---|---|
| Add Appointment submit | ✅ (was 400, fixed in `67a7aa8`) |
| Filter tabs All/Scheduled/In Progress/Completed | ✅ |
| Edit appointment | ✅ opens modal |
| Complete appointment | ⏭️ not clicked |

### Cars (`/cars`)
| Element | Result |
|---|---|
| Make filter (13 real makes) | ✅ (was empty, fixed in `f7d27d1`) |
| Status filter | ✅ |
| Total Services + Last Service per card | ✅ (was all 0/N/A, fixed in `f7d27d1`) |
| Schedule service per car → /appointments?carId=… | ✅ |
| View history per car → /maintenance?carId=… | ✅ |
| Add Car form submit | ⏭️ not clicked |

### Maintenance (`/maintenance/active` + `/history` + `/schedule`)
| Element | Result |
|---|---|
| Customer name + mileage on card | ✅ (was "undefined", fixed in `f7d27d1`) |
| Car year in details | ✅ |
| View Details → /maintenance/details/:id | ✅ |
| Edit → /maintenance/edit/:id | ✅ form renders, translations present |
| New Job form submit | ✅ (was 400 + mock mechanics, fixed in `406e2ae`) |
| Mechanic dropdown | ✅ 5 real employees (was 3 hardcoded mock IDs, fixed in `406e2ae`) |
| Edit job submit | ✅ (was 400, fixed in `406e2ae`) |
| Start Job transition (waiting → in-progress) | ✅ |
| Complete Job (in-progress → completed) | ✅ (was 400, fixed in `4780b86`) |
| New job appears in Active Jobs list | ✅ (was invisible due to PENDING/waiting enum mismatch, fixed in `406e2ae`) |
| Completed job appears in History tab | ✅ |
| Create/update response includes relations (car/customer/mechanic) | ✅ (backend include fixed in `406e2ae`) |
| Completed Jobs tab | ✅ |
| Schedule tab | ✅ |
| Add task to job | ✅ (was missing endpoint, implemented in `648b7b4` — POST/PUT/DELETE `/maintenance/:jobId/tasks/:taskId`; form now syncs add/update/delete on save) |

### Parts & Inventory (`/inventory`)
| Element | Result |
|---|---|
| Dashboard KPIs | ✅ (was 0s, race fixed in `4780b86`) |
| Parts Catalog tab | ✅ |
| Suppliers tab | ✅ returns [] (was 404, fixed in `f7d27d1`) |
| Add Part modal | ✅ opens with correct form |
| Form submit | ⏭️ not tested |
| Stock Adjustment | ⏭️ not tested |

### Invoicing (`/invoices` + variants)
| Element | Result |
|---|---|
| Dashboard KPIs | ✅ (was 0s, race fixed in `0d6d83b`) |
| All Invoices list | ✅ 14 invoices |
| Pending Payment tab | ✅ shows pluralized "1 invoice" |
| Create Invoice form | ✅ (was raw i18n + mock data, fixed in `67a7aa8`) |
| Customer→Vehicle dropdown dependency | ✅ (e.g. Ahmed Ben Ali → 2 cars) |
| Record Payment from pending list | ✅ transitions to PAID |
| Invoice detail page (direct nav) | ✅ (was epoch dates, fixed in `4780b86`) |
| Invoice header garage info | ✅ loads from /garage-settings (was hardcoded typo, fixed in `a7032df`) |
| Vehicle on invoice detail | ✅ "Volkswagen Golf 8 (2022) / 234TUN567" (was empty, fixed in `a7032df`) |
| Print + PDF buttons render | ✅ output not verified |

### Customers (`/customers`)
| Element | Result |
|---|---|
| Dashboard totals | ✅ (was 0s, race fixed in `f626fb4`) |
| "1 car" / "2 cars" pluralization | ✅ (was "1 cars", fixed in `26f4de4`) |
| Customer List tab | ✅ 15 cards |
| Analytics tab | ✅ |
| Add Customer form | ✅ opens |

### Reports (`/reports`)
| Element | Result |
|---|---|
| Dashboard / Financial / Operational / Customer / Inventory tabs | ✅ all render |
| Date-range dropdown (14 presets) | ✅ |
| Refresh | ✅ |
| Export → CSV download | ✅ (was `console.log` stub, fixed in `ff0f9b9`) |
| Currency format 2 decimals consistent | ✅ |

### Pending Approval (`/approvals`)
| Element | Result |
|---|---|
| Filter dropdowns (Status/Type/Priority) | ✅ |
| Maintenance "Needs Approval" KPI no longer conflicts | ✅ renamed "Jobs Needing Approval" (fixed in `ff0f9b9`) |

### Notifications (`/notifications`)
| Element | Result |
|---|---|
| Category tabs (All + 6 types + Unread Only) | ✅ filter correctly |
| Delete notification | ✅ (was no-op, added backend DELETE in `53f9404`) |
| Mark-as-read / mark-all-as-read | ⏭️ not tested via UI |

### Settings (`/settings`)
| Element | Result |
|---|---|
| Garage Info / Operations / Business / System / Integrations tabs | ✅ all render clean |
| "Reset" button label | ✅ (was raw `common.reset`, fixed in `f7d27d1`) |
| Save edit | ⏭️ not tested |

### Employees (`/employees`)
| Element | Result |
|---|---|
| Role badges distinct (Mechanic/Electrician/Bodywork/Tire Specialist) | ✅ (was all "Senior Mechanic", fixed in `67a7aa8`) |
| Department "Tire & Alignment" | ✅ (was raw key, fixed in `67a7aa8`) |
| Add Employee form | ✅ |
| View Details | ✅ |
| Edit modal | ✅ |
| Mark Unavailable | ✅ persists (was no-op, fixed in `a7032df`) |
| Inactive employees show "Unavailable" | ✅ (fixed in `343faf5`) |
| Filters panel | ✅ |
| Grid ↔ List toggle | ✅ |

### Modules (`/modules`)
| Element | Result |
|---|---|
| Marketplace (15 modules) | ✅ |
| Activate → POST /modules/:id/purchase | ✅ |
| Deactivate → DELETE /modules/:id | ✅ |
| Gate redirect shows toast | ✅ (was silent, fixed in `67a7aa8`) |

### Profile (`/profile`)
| Element | Result |
|---|---|
| Profile tab | ✅ |
| Preferences / Security tabs | ✅ render |
| Sign Out | ✅ clears token, redirects to /auth |
| Change Password | ✅ (was stub, implemented in `8e588f5`) |
| Update Profile submit | ⏭️ not tested |

---

## Phase 3 — Auth flows

| Flow | Result |
|---|---|
| Auth guard (direct nav without session) | ✅ → /auth |
| Login valid | ✅ → /dashboard |
| Login invalid | ✅ shows "Invalid username/email or password" (was silent, fixed in `8e588f5`) |
| Sign Out | ✅ |
| Forgot Password | ⚠️ modal opens, submit hits stubbed endpoint (`/auth/forgot-password` doesn't exist backend-side) |
| Refresh token (valid) | ✅ |
| Refresh token (invalid) | ✅ 401 |
| Register | ✅ creates garage + owner |
| Change Password (wrong current) | ✅ 401 "Current password is incorrect" |
| Change Password (correct) | ✅ "successfully" |
| Expired JWT auto-refresh via interceptor | ⏭️ never forced |

---

## Phase 4 — Staff role audit (`mohamed / staff123`)

| Check | Result |
|---|---|
| Staff login | ✅ |
| Sidebar hides owner-only items | ✅ 7 visible: Dashboard / Calendar / Appointments / Cars / Maintenance / Customers / Notifications / Profile |
| Direct URL nav to owner-only paths | ✅ 8/8 redirect to /dashboard with warning toast (fixed in `cf8705f`) |
| Staff GET /employees (mechanic dropdown) | ✅ (was 403, fixed in `0e38c00`) |
| Staff POST /employees | ✅ 403 (mutations remain owner-only) |
| Staff creates appointment | ✅ 201 |
| Staff dashboard network tab | ✅ zero 403s (was 2 per load, fixed in `cf8705f`) |

---

## Phase 5 — Mobile responsive (375×667)

| Screen | Result |
|---|---|
| Sidebar hidden off-screen on load | ✅ `translateX(-500px)` |
| Hamburger toggles sidebar | ✅ slides in `translateX(0)` |
| Dashboard / Appointments / Cars / Customers / Reports / Modules | ✅ all render, zero horizontal overflow, h1 intact |

---

## Phase 6 — Arabic RTL

⏭️ **Intentionally disabled.** `LanguageService.updateDocumentDirection()` hardcodes `dir="ltr"` with comment "Keep LTR layout for all languages (including Arabic)". `isRTL()` always returns false. Arabic text content renders correctly (browsers auto-handle RTL chars inline) but overall page direction stays LTR. Worth flagging if team later decides to enable full RTL — the many `[dir="rtl"]` CSS selectors across the codebase would then activate as dead code.

---

## Not covered (honest gaps)

**Form submissions untested**: Maintenance new-job submit, Add Car / Add Part / Add Customer / Add Employee submits, Settings save after edit, Update Profile submit.

**Flows untested**: ~~adding tasks to a maintenance job + marking complete~~ (tested 2026-04-20; persists only in-form, backend has no `/maintenance/:id/tasks` endpoint — documented as missing feature), approvals create/approve/reject, stock-adjustment modal, photo uploads (car/employee/maintenance), invoice draft→sent transition, invoice print/PDF output verification, calendar drag-and-drop (CLAUDE.md notes these are TODO stubs).

**Edge cases skipped**: expired-JWT auto-refresh, 403 error surfacing in components, offline handling, concurrent edits.

**Quality gates**: `npm run test` / `ng test` not executed this session. Prisma migrations were `db push` only — no proper migration files generated for deploy.

**Cleanup**: `opauto-db` docker container still running; previously-stopped `tdx-postgres` remains stopped. Need to restart it when user needs the other project's DB.

**i18n sweep**: the raw keys I hit were fixed, but I did not exhaustively scan every sub-page.
