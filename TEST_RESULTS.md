# OpAuto — Full Test Suite Results

**Date**: 2026-04-19
**Tester**: Claude (automated)
**Demo account**: `owner@autotech.tn / password123`
**Backend**: http://localhost:3000/api · **Frontend**: http://localhost:4200

Legend: ✅ pass · ❌ fail · ⚠️ works with issue · ⏭️ not-applicable

---

## Phase 1 — Backend endpoints

### Auth
| Method | Path | Payload | Expected | Result |
|---|---|---|---|---|
| POST | `/auth/login` | valid credentials | 201 | ✅ |
| POST | `/auth/login` | invalid credentials | 401 | ✅ |
| POST | `/auth/refresh` | invalid token | 401 | ✅ |

### Customers
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/customers` | 200 | ✅ (15 records) |
| GET | `/customers/:id` | 200 | ✅ |
| POST | `/customers` | 201 | ✅ |
| PUT | `/customers/:id` | 200 | ✅ |
| DELETE | `/customers/:id` | 200 | ✅ |

### Cars
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/cars` | 200 | ✅ (15 records, includes `totalServices` + `lastServiceDate`) |
| GET | `/cars/:id` | 200 | ✅ |
| GET | `/cars?customerId=…` | 200 | ✅ |
| POST | `/cars` | 201 | ✅ |
| PUT | `/cars/:id` | 200 | ✅ |
| DELETE | `/cars/:id` | 200 | ✅ |

### Employees
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/employees` | 200 | ✅ (5 records) |
| GET | `/employees/:id` | 200 | ✅ |
| POST | `/employees` | 201 | ✅ |
| PUT | `/employees/:id` | 200 | ✅ |
| DELETE | `/employees/:id` | 200 | ✅ |

### Appointments
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/appointments` | 200 | ✅ |
| GET | `/appointments/:id` | 200 | ✅ |
| GET | `/appointments?date=…` | 200 | ✅ |
| POST | `/appointments` (without `status`) | 201 | ✅ (after fix `67a7aa8`) |
| POST | `/appointments` (with `status`) | 400 | ✅ rejected as expected — DTO uses `whitelist: true` |
| PUT | `/appointments/:id` | 200 | ✅ |
| DELETE | `/appointments/:id` | 200 | ✅ |

### Invoices
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/invoices` | 200 | ✅ |
| GET | `/invoices/:id` | 200 | ✅ |
| POST | `/invoices` | 201 | ✅ |
| PUT | `/invoices/:id` | 200 | ✅ |
| POST | `/invoices/:id/payments` | 201 | ✅ (status flips to PAID, `paidAt` set — fix `67a7aa8`) |
| DELETE | `/invoices/:id` | 200 | ✅ |

### Maintenance
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/maintenance` | 200 | ✅ (now includes `car.year`, `car.mileage`, `car.customer` — fix `f7d27d1`) |
| GET | `/maintenance/:id` | 200 | ✅ |
| POST | `/maintenance` | 201 | ✅ |
| POST | `/maintenance` with `notes` | 201 | ✅ (was 400 — `notes` added to DTO) |
| PUT | `/maintenance/:id` with `notes` | 200 | ✅ (was 400 — DTO fix) |
| DELETE | `/maintenance/:id` | 200 | ✅ |

### Inventory (Parts)
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/inventory` | 200 | ✅ (15 parts) |
| GET | `/inventory/:id` | 200 | ✅ |
| GET | `/inventory/suppliers` | 200 | ✅ returns `[]` (was 404 — fix `f7d27d1`) |
| POST | `/inventory` (fields: `name`, `partNumber`, `quantity`) | 201 | ✅ |
| PUT | `/inventory/:id` | 200 | ✅ |
| DELETE | `/inventory/:id` | 200 | ✅ |

### Modules
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/modules` | 200 | ✅ |
| POST | `/modules/:id/purchase` | 201 | ✅ |
| POST | `/modules/:id/deactivate` | 404 | ⚠️ No deactivate endpoint. UI has a "Deactivate" button that calls something — investigate in Phase 2. |

### Approvals
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/approvals` | 200 | ✅ (empty) |

### Notifications
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/notifications` | 200 | ✅ |
| GET | `/notifications/unread-count` | 200 | ✅ |

### Garage Settings
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/garage-settings` | 200 | ✅ |
| PUT | `/garage-settings` | 200 | ✅ |

### AI
| Method | Path | Payload | Expected | Result |
|---|---|---|---|---|
| POST | `/ai/chat` | `{messages:[{role,content}]}` | 201 | ✅ (Groq-backed, returns text) |

### Users
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/users` | 200 | ✅ |

### Reports
| Method | Path | Expected | Result |
|---|---|---|---|
| GET | `/reports/dashboard` | 200 | ✅ (`{totalAppointments, activeJobs, totalRevenue, paidInvoices, totalCustomers}`) |
| GET | `/reports/financial` | 200 | ❌ 404 (endpoint missing; UI has "Financial" tab) |
| GET | `/reports/operational` | 200 | ❌ 404 (endpoint missing; UI has "Operational" tab) |

### Backend issues found
- ❌ **`GET /reports/financial` — 404**: UI Reports page has Financial/Operational/Customer/Inventory tabs but only `/reports/dashboard` exists. Need to add or remove those tabs.
- ❌ **`GET /reports/operational` — 404**: same as above.
- ⚠️ **Module deactivate** — no REST endpoint; the UI button may call something else. Confirm in Phase 2.

### Backend issues fixed in this run
- `CreateMaintenanceDto` missing `notes` → could not save/update notes on maintenance jobs. Added.

---

## Phase 2 — Frontend screens (Chrome DevTools MCP)

Filled in by click-through below.
