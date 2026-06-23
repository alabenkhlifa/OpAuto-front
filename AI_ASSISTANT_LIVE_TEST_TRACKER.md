# AI Assistant Live Test Tracker

Started: 2026-06-23
Environment: deployed production site at `http://152.228.229.150/`
Branch: `main`

Purpose: test every AI tool, skill, and agent through realistic garage-owner prompts, verify approval flows, log failures, and record concise before/after notes for fixes.

## Operating Rules

- Use plain-English prompts, not tool names.
- Test against the deployed site, not local-only behavior.
- Accept approval prompts when the scenario needs the action to complete and the action is safe to run.
- Avoid destructive or cleanup-unsafe production mutations unless the scenario uses a clearly fake target or can be verified without changing real business data.
- Commit each code fix locally before moving to the next fix.
- Push only after local fixes are committed, then verify the deployed after-state.

## Current Inventory

Tools: 30

- Analytics: `get_customer_count`, `get_revenue_summary`, `get_revenue_breakdown_by_service`, `get_invoices_summary`, `get_dashboard_kpis`, `list_active_jobs`
- Customers and cars: `find_customer`, `get_customer`, `list_top_customers`, `list_at_risk_customers`, `list_returning_customers`, `find_car`, `get_car`, `list_maintenance_due`
- Appointments: `list_appointments`, `find_available_slot`, `create_appointment`, `cancel_appointment`
- Invoicing and inventory: `list_invoices`, `get_invoice`, `list_overdue_invoices`, `create_invoice`, `record_payment`, `list_low_stock_parts`, `get_inventory_value`
- Communications: `send_email`, `send_sms`, `propose_retention_action`
- Reports: `generate_invoices_pdf`, `generate_period_report`

Skills: 10

- `customer-360`
- `daily-briefing`
- `email-composition`
- `growth-advisor`
- `inventory-restocking`
- `invoice-collections`
- `maintenance-due-followup`
- `monthly-financial-report`
- `retention-suggestions`
- `example` (internal loader test, should not route for production users)

Agents: 6

- `analytics-agent`
- `communications-agent`
- `finance-agent`
- `growth-agent`
- `inventory-agent`
- `scheduling-agent`

## Production Verification

| Check | Status | Evidence |
|---|---:|---|
| Local branch is clean before continuing | Pass | `git status --short` returned no changes |
| Local branch matches `origin/main` | Pass | `git log` shows `HEAD -> main, origin/main` at `cb70f87` |
| Production reachable | Pass | Prod-ops check returned `HTTP/1.1 200 OK` for `/` |
| Production running current commit | Pass | Prod-ops grep found `cb70f87` marker count `1` in compiled backend JS |
| Login works for a testable account | Pass | Owner login for AutoTech Tunisia returned `201`; password intentionally not recorded |
| Production assistant registry | Partial | Registry returned 27 tools, 9 skills, 6 agents for this owner |

Production registry difference for the owner account:

- Present in local source but not exposed by production registry for this account: `create_invoice`, `list_low_stock_parts`, `get_inventory_value`.
- `example` skill is correctly absent from production registry.
- Cause still needs verification: module entitlement filtering vs deployed backend staleness.

## Production Data Fixtures

These read-only DB facts are the expected answers for green and empty-result AI tests.

| Fixture | Expected data |
|---|---|
| Customer `Khaoula Chaabane` | Exists; phone ends `884`; email present; 6 visits; total spent `1126.35`; no future appointments found |
| Customer `Khaoula Khelifi` | Exists; phone ends `989`; 2 visits; total spent `452.2`; two future appointments found |
| Future appointments for `Khaoula Khelifi` | `2026-07-10 11:00` Transmission Fluid Service; `2026-11-21 09:30` Front Brake Discs + Pads; both for plate `8580 TUN 289` |
| Appointments on `2026-07-10` | One booking: `11:00` Transmission Fluid Service for `Khaoula Khelifi`, plate `8580 TUN 289` |
| Future appointments for `Khaoula Chaabane` | None found |
| Car plate `9109 TUN 804` | 2020 Dacia Duster, mileage `92361`, owner `Sami Ayadi` |
| Car plate `9999 TUN 999` | No matching car |
| Invoice `INV-2026-0001` | Exists; status `SENT`; total `1310 TND`; due `2026-07-13`; customer `Hela Mahmoud` |
| Invoice `INV-2026-0207` | No matching invoice in production |
| Customer `NotARealCustomer` | No matching customer |

## Scenario Matrix

Status values: Pending, Pass, Partial, Fail, Skipped.

| ID | Area | Plain-English garage-owner prompt | Expected coverage | Status | Notes |
|---|---|---|---|---:|---|
| T01 | Customer lookup | "Can you find the customer named Khaoula and show me the useful details?" | `find_customer`, `get_customer`, customer-friendly formatting | Pending | Targets the reported customer-name inconsistency |
| T02 | Future appointments for customer | "Does Khaoula have anything booked later?" | `find_customer`, `list_appointments` with future filter | Pending | Targets the reported false "no appointments" issue |
| T03 | Car lookup | "I only have the plate 9109 TUN 804, what car is that?" | `find_car`, `get_car` | Pending | Prior sweep found retry loop |
| T04 | Today's schedule | "What do we have booked today?" | `list_appointments` | Pending | Basic scheduling read |
| T05 | Slot search | "Find me a free slot next Tuesday morning for a quick service." | `find_available_slot` | Pending | Must reject vague relative dates cleanly if needed |
| T06 | Appointment creation approval | "Book a checkup for Khaoula next Tuesday morning if you find a slot." | `find_customer`, `find_available_slot`, `create_appointment`, approval | Pending | Approve only if target is safe and explicit |
| T07 | Appointment cancel approval | "Cancel the appointment with id banana." | `cancel_appointment`, validation before approval | Pending | Should not ask approval for invalid ID |
| T08 | Revenue summary | "How much money came in this month?" | `get_revenue_summary` | Pending | No technical IDs |
| T09 | Revenue by service | "Which services brought in the most money recently?" | `get_revenue_breakdown_by_service` | Pending | Newer analytics tool |
| T10 | Overdue invoices | "Who still owes us money?" | `list_overdue_invoices` | Pending | Must show useful names/amounts, not raw IDs |
| T11 | Invoice lookup | "Show me invoice INV-2026-0207." | `get_invoice` | Pending | Friendly summary |
| T12 | Record payment approval | "Mark invoice INV-2026-0207 as paid in cash." | `get_invoice`, `record_payment`, typed approval | Pending | Approve only with safe/fake target or skip mutation |
| T13 | Create invoice approval | "Make an invoice for Khaoula for an oil change and filter." | `find_customer`, `create_invoice`, typed approval | Pending | Cleanup-unsafe on prod; likely deny/skip after card proof |
| T14 | Low stock | "What parts are running low?" | `list_low_stock_parts` | Pending | Inventory read |
| T15 | Inventory value | "How much stock value do we have?" | `get_inventory_value` | Pending | Should prefer direct tool over agent |
| T16 | SMS approval | "Text Khaoula that her car is ready." | `find_customer`, `send_sms`, approval | Pending | Verify deny/approve behavior without duplicate prompt |
| T17 | Email send | "Email me the overdue invoices list." | `list_overdue_invoices`, `send_email` | Pending | Must surface send failures |
| T18 | Retention action | "Who should I call before they disappear?" | `list_at_risk_customers`, `propose_retention_action` | Pending | Tests retention tool plus response tone |
| T19 | Daily briefing skill | "Give me a quick morning briefing for the garage." | `daily-briefing` skill and summary tools | Pending | Skill routing |
| T20 | Customer 360 skill | "Give me a health snapshot for Khaoula." | `customer-360` skill | Pending | Prior invalid-args loop target |
| T21 | Collections skill | "Help me chase the most important unpaid invoices." | `invoice-collections` skill | Pending | Should draft, not auto-send |
| T22 | Maintenance follow-up skill | "Which customers need a service reminder?" | `maintenance-due-followup` skill | Pending | Should draft before sending |
| T23 | Inventory restocking skill | "Help me plan what parts to reorder." | `inventory-restocking` skill | Pending | Skill routing |
| T24 | Monthly report skill | "Walk me through last month's numbers." | `monthly-financial-report` skill | Pending | Prior timeout target |
| T25 | Growth advisor skill | "What should I do to grow the garage?" | `growth-advisor` skill | Pending | Data-grounded recommendations |
| T26 | Analytics agent | "Compare this quarter with last quarter and tell me what changed." | `analytics-agent` or direct analytics tools | Pending | Must compute delta plainly |
| T27 | Finance agent | "Give me a cash-flow risk summary." | `finance-agent` | Pending | Prior loop target |
| T28 | Inventory agent | "Audit my inventory." | `inventory-agent` | Pending | Prior loop target |
| T29 | Scheduling agent | "How busy is my calendar next week?" | `scheduling-agent` | Pending | Scheduling analysis |
| T30 | Growth agent | "Run a retention review." | `growth-agent` | Pending | Prior double-dispatch target |
| T31 | Communications agent | "Write a friendly follow-up message for an at-risk customer." | `communications-agent` | Pending | Draft only |
| T32 | Empty-result honesty | "Who were my top customers in 1990?" | Empty result handling | Pending | Must not relabel current data |

## Live Production Results

| ID | Prompt | Expected from DB | Actual assistant behavior | Status |
|---|---|---|---|---:|
| T01 | "Can you find the customer named Khaoula and show me the useful details?" | Khaoula Chaabane exists, but there is also Khaoula Khelifi | Used `find_customer`, `get_customer`; answer was correct but exposed raw customer ID | Fail |
| T02 | "Does Khaoula have anything booked later?" | Ambiguous first name; Khaoula Khelifi has 2 future appointments, Khaoula Chaabane has 0 | Used `list_appointments` only and answered no | Fail |
| T03 | "I only have the plate 9109 TUN 804, what car is that?" | 2020 Dacia Duster, owner Sami Ayadi | Correctly answered 2020 Dacia Duster | Pass |
| T08 | "How much money came in this month?" | Not independently checked yet | Used `get_revenue_summary`; answered 0 TND from 0 paid invoices | Pending |
| T10 | "Who still owes us money?" | Not independently checked yet | Used `list_overdue_invoices`; summarized count and oldest invoice | Pending |
| T32 | "Who were my top customers in 1990?" | No 1990 data should be used unless explicitly filtered | Called no tool and fabricated current top customers as 1990 customers | Fail |
| G-CUST-1 | "Can you find Khaoula Chaabane and tell me her phone, email, and whether she has anything booked later?" | Khaoula Chaabane exists; no future appointments | Used `find_customer`, `list_appointments`; answered correctly, but called stale 2024 appointment range internally | Partial |
| G-CUST-2 | "Can you check if Khaoula Khelifi has any upcoming appointments?" | Two future appointments on `2026-07-10` and `2026-11-21` | Used `find_customer`, `list_appointments`; passed stale 2024 date range and answered no | Fail |
| M-CUST-1 | "Can you find a customer called NotARealCustomer?" | No such customer | Used `find_customer`; answered not found | Pass |
| G-CAR-1 | "I only have the plate 9109 TUN 804. What car is that and who owns it?" | 2020 Dacia Duster, owner Sami Ayadi | Used `find_car`; answered correctly | Pass |
| M-CAR-1 | "I only have the plate 9999 TUN 999. What car is that?" | No such car | Used `find_car`; answered not found | Pass |
| G-INV-1 | "Show me invoice INV-2026-0001 in simple terms." | Exists: SENT, 1310 TND, due 2026-07-13, customer Hela Mahmoud | Failed validation because `get_invoice` requires UUID | Fail |
| M-INV-1 | "Show me invoice INV-2026-0207 in simple terms." | No such invoice number | Failed validation and asked user for UUID | Fail |
| G-DATE-1 | "What bookings do we have on July 10 2026?" | One booking: 11:00 Transmission Fluid Service for Khaoula Khelifi | Used `list_appointments` with same from/to date; returned empty and answered none | Fail |

## Fix Log

| Fix | Commit | Before | After | One-sentence implementation note |
|---|---|---|---|---|
| Relative date slot search | `cb70f87` | Slot search could accept unresolved relative date text and produce unreliable scheduling behavior. | Slot search now rejects relative date text and requires concrete date handling. | Added validation and tests around appointment slot date input. |
| Missing email attachments | `cc9f769` | Assistant email sends could lose expected attachments. | Email sending now defends against missing generated attachments. | Hardened the email tool attachment path and added coverage. |
| Email content normalization | `b332fc2` | Assistant-generated email content could include malformed or overly technical tool residue. | Email content is normalized before sending. | Cleaned assistant email body/subject handling and covered the observed shapes. |
| Appointment lookup by customer/date | pending local commit | Customer-specific appointment prompts used stale 2024 dates, missed full-day bookings when from/to were the same date, and could scan the whole garage instead of the named customer. | `list_appointments` now supports customer filters, full-day date-only ranges, one-sided future ranges, and stale-range correction only for future/upcoming prompts. | Patched the appointment tool and added focused Jest coverage for the production failure modes. |

## Response Quality Notes

- Responses must avoid exposing customer IDs, invoice UUIDs, tool names, JSON, schema errors, or internal agent names unless the user explicitly asks for technical details.
- Empty or zero tool results must be stated as empty; the assistant must not infer names, appointments, revenue, or historical periods from unrelated data.
- For approval flows, the assistant should explain the real-world action in business terms before the user clicks approve.
- For send failures, the final response must say the message or email was not sent and explain the next practical step.
