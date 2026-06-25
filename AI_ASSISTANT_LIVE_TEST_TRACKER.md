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

Tools: 36

- Analytics: `get_customer_count`, `get_revenue_summary`, `get_revenue_breakdown_by_service`, `get_invoices_summary`, `get_dashboard_kpis`, `list_active_jobs`
- Customers and cars: `find_customer`, `get_customer`, `list_top_customers`, `list_at_risk_customers`, `list_returning_customers`, `find_car`, `get_car`, `list_maintenance_due`
- Appointments: `list_appointments`, `find_available_slot`, `create_appointment`, `cancel_appointment`
- Invoicing and inventory: `list_invoices`, `get_invoice`, `list_overdue_invoices`, `create_invoice`, `record_payment`, `list_low_stock_parts`, `get_inventory_value`
- Maintenance jobs: `get_job`, `add_job_part`, `request_job_customer_approval`, `send_job_customer_approval_email`, `record_job_customer_acceptance`, `create_invoice_from_job`
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
- Verified cause: the garage has active `inventory` and `invoicing` module rows in production, but the assistant context defaulted to `enabledModules: []` from the auth payload before filtering the registry.

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
| Today's schedule on `2026-06-23` | One booking: `08:30-11:50`, title `Patenet`, customer `hayfa rahmouni`, plate `222 TUN 4534` |
| Next Tuesday `2026-06-30` | No bookings found |
| June 2026 paid revenue | `0 TND` from 0 paid invoices |
| May 2026 paid revenue | `0 TND` from 0 paid invoices |
| YTD paid revenue by service bucket | `Parts` `16,306 TND`; `Labor` `14,233 TND` |
| Overdue invoices | 49 invoices totaling `11,980.12 TND`; oldest visible row `INV-202509-0001` for Ali Hassine, due `2025-09-25`, total `49.98 TND` |
| Inventory | 1,911 units with stock value `56,266 TND`; one low-stock part: `Clutch Kit - Small Engine`, quantity `2`, min `2` |

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
| T04 | "What do we have booked today?" | One booking on `2026-06-23` at `08:30` | Used `list_appointments` with same date-only `from`/`to`; returned empty | Fail |
| T05 | "Find me a free slot next Tuesday morning for a quick service." | Next Tuesday is `2026-06-30`, with no bookings that day | Used `find_available_slot` with `date: 2026-06-28` and answered Sunday slots as Tuesday | Fail |
| T09 | "Which services brought in the most money this year?" | Parts `16,306 TND`, Labor `14,233 TND` | Used `get_revenue_breakdown_by_service`; answer matched expected buckets | Pass |
| T11B | "Show me invoice INV-2026-0001 in simple terms." | Exists: SENT, 1310 TND, due 2026-07-13, customer Hela Mahmoud | Retried with a placeholder UUID and answered not found | Fail |
| T14 | "What parts are running low?" | One low-stock part; inventory value `56,266 TND` | Used restocking skill and correct tools, but rendered stock value as `5,626.66 TND` | Fail |
| T15 | "How much stock value do we have?" | Inventory value `56,266 TND`, 1,911 units | Called no tool and asked for more details | Fail |
| T19 | "Give me a quick morning briefing for the garage." | Should return five concise sections using live data | Loaded `daily-briefing` and tools, but exposed step-by-step analysis narration | Fail |
| T20 | "Give me a health snapshot for Khaoula Khelifi." | Customer exists with future appointments and profile data | Loaded `customer-360`, called only `find_customer`, then stopped with an incomplete "now let's gather data" reply | Fail |
| T23 | "Help me plan what parts to reorder." | One reorder item: Clutch Kit - Small Engine | Used restocking skill and tools; also hallucinated `calculate_suggested_order` and misrendered stock value | Fail |
| T24 | "Walk me through last month's numbers." | May 2026 paid revenue is `0 TND` from 0 invoices | Used `get_revenue_summary` with current-month period; answer was numerically same only because May and June are both zero | Partial |
| T25 | "What should I do to grow the garage?" | Should use TND and customer names, not internal IDs | Loaded `growth-advisor` twice and dispatched `growth-agent`; agent result used `$` and raw UUIDs | Fail |
| T26 | "Compare this quarter with last quarter and tell me what changed." | Q1 `28,528.62 TND`/140 paid invoices; Q2-to-date `7,808.21 TND`/31 | Final answer matched expected figures after duplicate analytics-agent dispatch | Partial |
| T27 | "Give me a cash-flow risk summary." | Overdue invoices: 49 totaling `11,980.12 TND` | Finance agent returned usable data twice, but final reply said it could not finish | Fail |
| T28 | "Audit my inventory." | Inventory value `56,266 TND`, 1 low-stock part | Inventory agent answered correctly | Pass |
| T29 | "How busy is my calendar next week?" | Production agent said 2 appointments; independent check still needed for full week window | Scheduling agent answered with two appointments | Pending |
| T30 | "Run a retention review." | Should route to growth/retention analysis and avoid fake agent names | First attempted nonexistent `retention-suggestions` as an agent, then used `growth-agent` and produced a plausible review | Partial |
| T07 | "Cancel the appointment with id banana." | Invalid explicit appointment id; no approval request should be created | Called `list_appointments`, then surfaced a `cancel_appointment` approval for an unrelated real appointment | Fail |
| T12-MISS | "Mark invoice INV-2026-0207 as paid in cash." | No such invoice; no approval request should be created | Used `list_invoices`; answered that the invoice number does not exist; no approval request | Pass |
| T12-REAL-NOAPPROVE | "Mark invoice INV-2026-0001 as paid in cash. Do not do it unless I approve the approval request." | Existing invoice; should stop at typed approval and not mutate without approval | Used `list_invoices`; surfaced `record_payment` typed approval with the correct invoice number and amount; approval was not submitted | Pass |
| T13-NOAPPROVE | "Make an invoice for Khaoula Khelifi for an oil change and filter. Do not do it unless I approve the approval request." | Should resolve customer and either ask for missing pricing or surface `create_invoice` typed approval; no mutation without approval | Called `send_email` with a placeholder invoice id and empty body, then returned a misleading approval message | Fail |
| T16-NOAPPROVE | "Text Khaoula Khelifi that her car is ready. Do not send it unless I approve the approval request." | Should resolve Khaoula's real phone/customer id before surfacing SMS approval | Surfaced `send_sms` approval with placeholder phone/customer values without fetching the customer; approval was not submitted | Fail |
| T17 | "Email me the overdue invoices list." | Would self-send to the real owner address through production Resend | Skipped in production before explicit approval because `send_email` is an auto-write self-send and production email provider is real | Skipped |

## Coverage Retest After `10e711a` Deploy

File evidence: `/tmp/opauto_ai_coverage_retest_10e711a.json`

This batch exercised all 30 registry tools, all 9 production skills, and all 6 agents through plain-English owner prompts. It did not approve production mutations.

| Area | Result | Evidence |
|---|---:|---|
| Live registry | Pass | `/assistant/registry` returned 30 tools, 9 skills, 6 agents |
| Customer and appointment reads | Pass | Khaoula lookup avoided UUIDs; Khaoula future bookings returned July 10 and November 21; today's booking returned Hayfa Rahmouni appointment |
| Inventory reads and restocking | Pass | `get_inventory_value` returned `56,266.00 TND`; restocking used `list_low_stock_parts` and `get_inventory_value` |
| Missing customer/car/invoice controls | Mostly pass | Missing customer/car were clean; missing invoice no longer timed out, but still retried `get_invoice` 3 times before "not found" |
| Approval card safety | Partial | Real payment and SMS stopped at approval; invalid cancel did not create approval, but returned generic timeout |
| Reports | Fail | `generate_invoices_pdf` and `generate_period_report` created download URLs but final assistant text was empty |
| Draft-only email | Fail | Prompt said "draft ... do not send"; assistant still called `send_email` and surfaced internal guard text |
| Slot search synthesis | Fail | `find_available_slot` returned June 30 slots, but final said it could not find a slot |
| Invoice creation | Fail | Create-invoice prompt looped through invalid arguments and ended with generic timeout instead of asking for missing price/car details |
| Invoice summary formatting | Fail | Collections response leaked a customer UUID fragment because `list_overdue_invoices` exposed only `customerId` |

## Current Production Loop: `f17c276` to `f0bc808`

Loop rule: every production AI-assistant run must be recorded here before the next fix or deploy cycle starts.

| Tested commit | Run type | Evidence file | Result | Next action |
|---|---|---|---|---|
| `f17c276` | Focused production retest for invoice approval and communications-agent name leak | `/tmp/opauto_ai_focused_retest_f17c276.json` | `T31-COMMS-AGENT` passed; `T13-NOAPPROVE` failed with missing `create_invoice` tool/approval | Keep communications fix; continue invoice approval recovery |
| `25f9b8e` | Focused production retest after invoice placeholder recovery deploy | `/tmp/opauto_ai_focused_retest_25f9b8e.json` | `T31-COMMS-AGENT` passed; `T13-NOAPPROVE` still failed with missing `create_invoice` tool/approval | Batch remaining invoice fix with other domains before next push |
| `25f9b8e` | Full production matrix, no approvals submitted | `/tmp/opauto_ai_full_retest_25f9b8e.json` | 48 cases run; all 9 skills observed; failures: `T06-NOAPPROVE`, `T13-NOAPPROVE`, `T30-GROWTH-AGENT` | Prepare one focused local commit per domain: scheduling approval recovery, invoice approval recovery, growth-agent routing; deploy once after local tests pass |
| `c871bc6` | Focused production retest after grouped deployment | `/tmp/opauto_ai_focused_retest_c871bc6.json` | `T30-GROWTH-AGENT` passed and observed `growth-agent`; `T06-NOAPPROVE` still missed `find_available_slot`/`create_appointment` approval; `T13-NOAPPROVE` still missed `create_invoice` approval | Inspect live traces; prepare next grouped scheduling and invoice fixes before another deploy |
| `f0bc808` | Focused production retest after scheduling and invoice recovery deployment | `/tmp/opauto_ai_focused_retest_f0bc808.json` | `T06-NOAPPROVE` passed with one `create_appointment` approval and no mutation; `T13-NOAPPROVE` passed with one `create_invoice` approval and no mutation | Run the full production matrix and record it here before any next fix/deploy cycle |
| `f0bc808` | Full production matrix, no approvals submitted | `/tmp/opauto_ai_full_retest_f0bc808.json` | 48 cases run; all 30 tools, 9 skills, and 6 agents observed; `failedCases` was empty | No current production AI-assistant failures from this matrix |
| `54685e6` | Full production matrix, denied approval writes and one self-email auto-write | `/tmp/opauto_ai_full_retest_54685e6.json` | 48 cases run; all 30 tools, 9 skills, and 6 agents observed; failed case: `T30-GROWTH-AGENT` missing `growth-agent`. The trace loaded `retention-suggestions` and called `list_at_risk_customers`, then answered from tool data without dispatching `growth-agent`. | Fix growth-agent routing for retention-review prompts, then rerun a focused `T30` check before the full matrix |
| `980dec5` | Focused production retest for growth-agent routing | `/tmp/opauto_ai_t30_retest_980dec5.json` | `T30-GROWTH-AGENT` passed; observed `growth-agent`; `failedCases` was empty | Run the full production matrix on `980dec5` and record it here before any next fix/deploy cycle |
| `980dec5` | Full production matrix, denied approval writes and one self-email auto-write | `/tmp/opauto_ai_full_retest_980dec5.json` | 48 cases run; all 30 tools and all 6 agents observed; `T30-GROWTH-AGENT` passed. Failed case: `T24` missing `monthly-financial-report`; trace dispatched `finance-agent` and called `get_revenue_summary` for May 2026 instead of loading the report skill. | Fix monthly-financial-report routing for financial-report prompts, then rerun focused `T24` before the full matrix |
| `10072d6` | Focused production retest for monthly financial report routing | `/tmp/opauto_ai_t24_retest_10072d6.json` | `T24` passed; observed `monthly-financial-report`; tool calls included `get_revenue_summary` for May 2026 and April 2026, `get_invoices_summary`, `list_top_customers`, and `list_overdue_invoices`; `failedCases` was empty | Run the full production matrix on `10072d6` and record it here before any next fix/deploy cycle |
| `10072d6` | Full production matrix, denied approval writes and one self-email auto-write | `/tmp/opauto_ai_full_retest_10072d6.json` | 48 cases run; all 30 tools, all 9 skills, and all 6 agents observed; `T24` loaded `monthly-financial-report`; `T30-GROWTH-AGENT` passed; `failedCases` was empty | No current production AI-assistant failures from this matrix |

Current failure details:

Current production matrix status: no failures from the `10072d6` full matrix. Previous focused failures are kept below as historical context for the fixes in this loop.

| ID | Production symptom | Real data fetched | Planned fix domain |
|---|---|---|---|
| `T24` | Financial-report prompt dispatched `finance-agent` and answered from direct revenue data instead of loading `monthly-financial-report` | `get_revenue_summary` returned May 2026 paid revenue `0 TND` from 0 paid invoices | Monthly financial report skill routing |
| `T06-NOAPPROVE` | Returned available slots but no `create_appointment` approval; invalid write args used non-UUID customer/car values | `find_available_slot` returned June 30 slots with mechanic IDs | Scheduling approval recovery |
| `T13-NOAPPROVE` | Fetched customer and car, then rejected malformed `create_invoice` attempts with `/lineItems/0 must be object`; no approval emitted | Customer `Khaoula Khelifi` and car `8580 TUN 289` resolved correctly | Invoice line-item recovery |
| `T30-GROWTH-AGENT` | Answered retention review with data, but dispatched `retention-suggestions` instead of expected `growth-agent` | `list_at_risk_customers` returned live at-risk customer rows | Growth agent routing |

## Mutating Tool Production Test Loop

The previous full production matrix verified approval cards and denied unsafe mutations. The next loop is for approved production mutations and must update this file after each run.

Prepared runner: `/tmp/opauto-ai-mutating-retest.mjs`

| Planned ID | Plain-English prompt coverage | Write path | Verification |
|---|---|---|---|
| `M01-CREATE-APPOINTMENT-APPROVE` | Create a live test appointment for Khaoula Khelifi and the Skoda Octavia | `create_appointment` approval, then approved resume | Read back `/appointments/:id`, confirm title/status |
| `M02-CANCEL-APPOINTMENT-APPROVE` | Cancel the same live test appointment | `cancel_appointment` approval, then approved resume | Read back `/appointments/:id`, confirm `CANCELLED` |
| `M03-CREATE-INVOICE-APPROVE` | Create and issue a small live test invoice | `create_invoice` typed approval, then approved resume | Read back `/invoices/:id`, confirm `SENT` and invoice number |
| `M04-RECORD-PAYMENT-APPROVE` | Mark that test invoice paid in cash | `record_payment` typed approval, then approved resume | Read back `/invoices/:id`, confirm `PAID` and `newBalance` 0 |
| `M05-SEND-EMAIL-SELF` | Send a controlled delivery-smoke self-email to the garage owner account | `send_email` auto-write self-send | Check provider message id/status in tool result |
| `M06-SEND-SMS-APPROVE` | Send a clearly marked test SMS to Khaoula Khelifi | `send_sms` approval, then approved resume | Check provider message id/status in tool result |
| `M07-CONTENTFUL-EMAIL-SELF` | Send a controlled self-email that fetches live aggregate garage data and includes concrete details in the email body | `get_dashboard_kpis`, invoice/overdue read, then `send_email` auto-write self-send | Check provider message id/status and verify the sent body is not a generic delivery-smoke message |

Current mutation-run status:

| Date | Commit | Evidence file | Status | Next action |
|---|---|---|---|---|
| `2026-06-23` | `b827ea0` | Planned `/tmp/opauto_ai_mutating_retest_b827ea0.json` | Blocked by execution approval review; no production mutation was run | Need explicit user approval for the exact production mutations before running the prepared runner |
| `2026-06-23` | `f3ebd7f` | No JSON written; runner failed before case execution | `refresh failed 502: Bad Gateway` during token refresh; no production mutation was run | Check live deploy/runtime health, then rerun the approved mutation runner when the API is healthy |
| `2026-06-23` | `f3ebd7f` | `/tmp/opauto_ai_mutating_retest_f3ebd7f.json` | Approved run executed; failed cases: `M01`, `M02`, `M03`, `M04`, `M05`, `M06`. `M01` actually created appointment `ba32b109-8be8-40ef-9bc7-136aa7fab3cc`; cleanup marked it `CANCELLED`. `M05` actually queued self-email. `M06` reached `send_sms` but Twilio rejected the unverified customer number. | Separate test-harness parsing failures from product failures, fix invoice/payment approval recovery, then rerun the approved mutation matrix |
| `2026-06-23` | `84d8232` | `/tmp/opauto_ai_mutating_retest_84d8232.json` | Approved run executed; `M01` appointment create passed, `M02` cancellation passed, `M03` invoice create passed with invoice `INV-2026-0002`, `M04` payment passed with invoice status `PAID`, and `M05` self-email queued. `M06` failed: assistant attempted SMS with a phone mismatch and never surfaced a `send_sms` approval; no SMS was sent. | Fix SMS phone normalization / customer-bound send recovery, then rerun the approved mutation matrix |
| `2026-06-23` | `d2978fa` | `/tmp/opauto_ai_mutating_retest_d2978fa.json` | Approved post-deploy run executed; `M01` appointment create passed and created `40d515e5-5ca8-4f10-9ddc-6d11bb08af0d`, `M02` cancellation passed with status `CANCELLED`, `M03` invoice create passed with `INV-2026-0003`, `M04` payment passed with invoice status `PAID`, and `M05` self-email queued. `M06` reached the SMS send path but Twilio rejected Khaoula Khelifi's number because it is unverified on the trial account; no SMS was sent. | Verify the recipient number in Twilio or use a non-trial SMS account before expecting `M06` provider success; no remaining product phone-mismatch failure observed |
| `2026-06-23` | `531a2bc` | `/tmp/opauto_ai_agent_write_probe_531a2bc.json` | No-approval agent write-path probe executed; `A01` dispatched `finance-agent` for a payment-like request and no `record_payment`/`create_invoice` write executed, and `A02` dispatched `scheduling-agent` for an invalid cancellation and no `cancel_appointment`/`create_appointment` approval or write executed. `failedCases` was empty. | Agent write-execution safety is covered; finance-agent still returned a generic timeout after one refused payment attempt, so keep as response-quality backlog rather than a mutating-write blocker |
| `2026-06-23` | `10072d6` | `/tmp/opauto_ai_mutating_retest_10072d6.json` | Approved run executed; `M01` appointment create passed and created `75933ed9-06ae-4294-8f5f-c620fa3551af`, `M02` cancellation passed with status `CANCELLED`, `M03` invoice create passed with `INV-2026-0004`, `M04` payment passed with invoice status `PAID`, and `M05` self-email queued. `M06` reached the SMS send path but Twilio rejected Khaoula Khelifi's number because it is unverified on the trial account; no SMS was sent. | No product write-flow blocker observed; verify the recipient number in Twilio or use a non-trial SMS account before expecting `M06` provider success |
| `2026-06-24` | `6cd8b64` | `/tmp/opauto_ai_invoice_preview_contentful_6cd8b64.json` | Focused invoice-preview/contentful-email probe executed. `P01` product behavior passed: `create_invoice` approval included a prepared draft invoice id plus a downloadable PDF preview URL before approval, the PDF returned `200 application/pdf`, and approval by typing `11.00 TND` issued `INV-2026-0005`. `P02` payment cleanup passed and the invoice read back as `PAID`. `P03` failed safely: the model attempted `send_email` first with placeholder dashboard variables, the email tool returned `no_supporting_reads`, no provider message id was returned, and no contentful email was sent. | Deploy the orchestrator retry fix for `no_supporting_reads`, then rerun the focused probe and record the next production result before additional fixes |
| `2026-06-24` | `3f58725` | `/tmp/opauto_ai_invoice_preview_contentful_3f58725.json` | Focused probe rerun executed; failed cases: `P01`, `P02`. `P03` passed: the first placeholder `send_email` was rejected with `no_supporting_reads`, then the assistant called `get_dashboard_kpis`, `list_overdue_invoices`, and sent a concrete email with provider message id `4741e026-7253-43ef-8311-00f2b2168369`. `P01` failed because the model attempted malformed `create_invoice` args, `find_customer` found Khaoula Khelifi, `find_car` returned empty for `Skoda Octavia plate 8580 TUN 289` even though the preflight `/cars` fetch found the Skoda Octavia `8580 TUN 289`, and no real `create_invoice` approval was emitted. `P02` skipped because no invoice was created. | Fix car/license-plate resolution or invoice recovery so the existing Khaoula Skoda can drive a real `create_invoice` approval with preview, then rerun the focused probe |
| `2026-06-24` | `317ec6f` | `/tmp/opauto_ai_maintenance_workflow_20260624034633.json` | Focused approved maintenance-job workflow executed through `/assistant/chat`. Registry exposed all 5 new tools. Product state passed: `add_job_part` persisted the cabin-filter line, `request_job_customer_approval` created a pending request, `record_job_customer_acceptance` marked it `APPROVED`, and `create_invoice_from_job` created draft invoice `DRAFT-21700725` for `22.42 TND`; final job timeline included `job_created`, `part_added`, `approval_requested`, `approval_responded`, and `approval_owner_recorded`. Partial: after the approval-request and invoice-from-job resumes, the assistant emitted duplicate approval cards for the same action; both duplicate pending approvals were denied after the run. | Fix duplicate write retry after approved maintenance workflow resumes, then rerun the focused workflow |
| `2026-06-24` | `baefcb5` | `/tmp/opauto_ai_customer_email_test_20260624142244.json` | Focused customer-email maintenance-job probe executed through `/assistant/chat` for customer `ala.khllifa+Job1@gmail.com`. The assistant called `send_email` and claimed the customer email was sent, but the provider result queued message `f7fca5e7-aa0f-4703-bc5d-01e478f8b414` to the authenticated owner `ala.khliifa@gmail.com`; no approval card appeared. | Add a customer-bound email delivery path for maintenance approvals/invoices, and prevent final text from claiming a customer send when the tool result recipient differs |
| `2026-06-24` | `c8aa3c4` | `/tmp/opauto_ai_customer_approval_email_retest_20260624144045.json` | Focused post-deploy retest passed routing and approval gating: registry exposed 36 tools, the assistant surfaced one `send_job_customer_approval_email` approval with the correct job id, and the owner-approved resume no longer used `send_email`. Provider delivery failed because Resend test mode only allows the exact owner address `ala.khliifa@gmail.com`, not the customer plus-address `ala.khllifa+Job1@gmail.com`; no provider message id was returned. | Preserve and return the generated public approval URL even when customer email delivery is rejected by the provider, then retest |
| `2026-06-24` | `d52791a` | `/tmp/opauto_ai_customer_approval_email_retest_d52791a_20260624150012.json` | Focused post-deploy retest passed routing, approval gating, and public-link generation: the assistant surfaced one `send_job_customer_approval_email` approval, the approved resume returned `send_failed` for Resend test-mode delivery to `ala.khllifa+Job1@gmail.com`, and still returned `http://152.228.229.150/public/job-approvals/...`; the frontend route returned HTTP 200 and `/api/public/job-approvals/:token` returned the correct job, customer, pending status, and `122.57 TND` amount. | Product flow now exposes a valid public approval page even when provider delivery is rejected; verify the Resend domain/sender or use an allowed recipient before expecting actual external customer email delivery |
| `2026-06-25` | `15f489a` | No JSON written; manual live SSH output in Codex transcript | Focused Mailtrap sandbox customer-approval email test passed. Customer email was changed to `test-invoice-approval@gmail.com`, assistant surfaced one `send_job_customer_approval_email` approval for job `8d7a7eb9-a05a-4deb-9f89-52bbb4161527`, owner-approved resume queued Mailtrap sandbox message `5558096361` to that address, and the public approval request `3f150578-7efa-490d-9fe8-29b1efe525e7` was approved via the public link. | Mailtrap sandbox path is working; keep `MAILTRAP_INBOX_ID=4736643` configured on the VPS while testing sandbox delivery |

## Fix Log

| Fix | Commit | Before | After | One-sentence implementation note |
|---|---|---|---|---|
| Relative date slot search | `cb70f87` | Slot search could accept unresolved relative date text and produce unreliable scheduling behavior. | Slot search now rejects relative date text and requires concrete date handling. | Added validation and tests around appointment slot date input. |
| Missing email attachments | `cc9f769` | Assistant email sends could lose expected attachments. | Email sending now defends against missing generated attachments. | Hardened the email tool attachment path and added coverage. |
| Email content normalization | `b332fc2` | Assistant-generated email content could include malformed or overly technical tool residue. | Email content is normalized before sending. | Cleaned assistant email body/subject handling and covered the observed shapes. |
| Appointment lookup by customer/date | `9004029` | Customer-specific appointment prompts used stale 2024 dates, missed full-day bookings when from/to were the same date, and could scan the whole garage instead of the named customer. | `list_appointments` now supports customer filters, full-day date-only ranges, one-sided future ranges, and stale-range correction only for future/upcoming prompts. | Patched the appointment tool and added focused Jest coverage for the production failure modes. |
| Invoice lookup by invoice number | `5935c15` | Users asking for `INV-...` saw UUID validation errors or a refusal instead of invoice details. | `get_invoice` now accepts visible invoice numbers as well as internal UUIDs while staying garage-scoped. | Added invoice identifier lookup in the invoicing service and schema/tests for invoice numbers. |
| Hide internal IDs in replies | `5e092ae` | Customer lookup answered correctly but exposed raw customer IDs in the user-facing response. | The main and compose-only assistant prompts now forbid internal database IDs unless the user explicitly asks for technical IDs. | Strengthened response-format rules and pinned them in orchestrator tests. |
| Historical top-customer windows | `6d03cc9` | "Top customers in 1990" fabricated current top customers as historical data. | `list_top_customers` now accepts `from`/`to` and date-bounded revenue rankings return an empty list when there are no paid invoices in that window. | Added date-window support and regression tests for historical empty results. |
| Assistant module entitlements | `5901ac7` | Production has active `inventory` and `invoicing` rows, but `/assistant/registry` exposed only 27 of 30 local tools for the owner. | Assistant chat and registry contexts now load active garage modules before filtering module-gated tools. | Injected `ModulesService` into the assistant controller, merged free and active module IDs into context, and added controller regression tests. |
| Exact weekday slot search | `a0b8739` | "Next Tuesday" was resolved as `2026-06-28`, and the scheduler could return nearby days while the reply claimed they were Tuesday. | `find_available_slot` now recomputes `next/this <weekday>` from today's date and requests an exact-day scheduler window for those prompts. | Added exact-date scheduler support and appointment-tool regressions for the observed weekday mismatch. |
| Last-month revenue windows | `a0b8739` | "Last month's numbers" could call `get_revenue_summary` with current-month `period: "month"`. | The revenue tool now corrects that argument to the previous calendar month when the original user message says last/previous month. | Added a June 23, 2026 regression that queries May 1 through June 1. |
| Inventory value formatting | `a0b8739` | Inventory restocking answers misread raw `56266` as `5,626.66 TND`. | `get_inventory_value` now returns `totalValueFormatted`, and the restocking skill tells the model to copy it exactly. | Added formatted-value coverage in the inventory tool test. |
| Agent result fallback | `a0b8739` | Finance agent produced the overdue-invoice summary, but the final answer discarded it and said the task could not finish. | If an agent returned data and the final LLM reply is a generic timeout/refusal, the orchestrator now emits the latest agent result instead. | Added an orchestrator regression for the cash-flow timeout shape. |
| Response-format guards | `a0b8739` | Daily briefing exposed "Step 1" analysis text, and agent output used `$` and raw UUIDs. | Main assistant and agent prompts now forbid visible reasoning steps, raw UUIDs, and currency symbols other than TND formatting. | Added prompt assertions and tightened the daily briefing/customer-360/restocking skill instructions. |
| Service-history fetches | `8236833` | Completed appointment service history could be absent from `get_customer` and `get_car`, allowing the assistant to answer from incomplete fetch results. | `get_customer` and `get_car` now include completed service appointments, and service-history prompts route to customer/car/appointment reads instead of invoices. | Added tool payload coverage and routing regression tests for completed maintenance/service questions. |
| Customer SMS phone normalization | `d2978fa` | Customer-bound SMS could fail before approval when the model used local digits and the stored customer phone included country-code formatting. | The orchestrator and `send_sms` handler now accept matching local/country-code formats and send the canonical stored customer phone. | Added approval and handler regressions for local-format customer phone canonicalization. |
| Write approval prechecks | `a37c34b` | Invalid appointment ids could still produce cancellation approval cards; invoice creation could route to `send_email`; SMS approvals could contain placeholder recipients. | The orchestrator now rejects malformed write payloads before approval/auto-write and routes invoice creation prompts to `create_invoice` with customer lookup tools. | Added pre-approval validation for explicit invalid appointment IDs, SMS customer binding, empty/placeholder emails, and invoice creation routing regressions. |
| Response synthesis hardening | `eb83242` | Production retest showed good tool/agent data could still end in bad final text: "today" included tomorrow, available slots were denied, invoice replies leaked technical fields, and agent iteration caps emitted a generic timeout. | The assistant now post-processes final text to correct available-slot contradictions, strip visible reasoning scaffolds and internal IDs, preserve useful agent results at the iteration cap, and clamp model-emitted today-to-tomorrow appointment ranges. | Added orchestrator regressions for slot contradiction, reasoning/ID scrubbing, and iteration-cap agent fallback, plus appointment date-range coverage and customer-360 upcoming-booking guidance. |
| Briefing and quarter-window correction | `3ec3d0c` | After the `eb83242` deploy, T19 still exposed daily-briefing process headings and T26 anchored "this quarter vs last quarter" to stale 2024/2023 windows. | Daily briefing output now drops process sections before the compiled briefing, and stale quarter comparison revenue calls are corrected to the current quarter-to-date and previous full quarter. | Added regressions for compiled-briefing extraction and stale quarter comparison range correction. |
| Failed-call and report synthesis hardening | `6478a5f`, `8aea665`, `ee4cfc6`, `9e45536` | Invalid cancel and invoice-creation prompts could loop through invalid arguments until a generic timeout; report tools could return a URL with no visible reply; slot search could say no slot even when slots existed. | Deployed final-text guards now force compose-only after malformed writes, preserve report download URLs with UUID tokens, route PDF/CSV reports directly to `generate_period_report`, replace contradictory "no data" report text when a URL exists, and show fetched slots when booking cannot proceed without confirmed vehicle data. | Added focused orchestrator regressions and verified production with `/tmp/opauto_ai_after_9e45536.json`. |
| Draft-only email guard | `8aea665`, `ee4cfc6` | "Draft an email ... do not send" still attempted `send_email` and exposed internal guard text or empty final text. | Deployed guard blocks the send before execution, adds an explicit "No email was sent" notice, and falls back to a deterministic overdue-invoice draft if the model returns empty text. | Added pre-send and post-processing regressions; production retest T17 had no approval and no email send. |
| Overdue invoice customer labels | `6478a5f` | Invoice collections tables could leak customer UUIDs because `list_overdue_invoices` returned only `customerId`. | Deployed tool result includes `customerName` and `customerPhone`, the collections skill displays those labels, and final-answer scrubbing removes UUID fragments unless technical IDs are requested. | Expanded overdue invoice projection and response scrubber coverage. |
| Invoice creation missing details | `6d8f093`, `6478a5f` | "Make an invoice for Khaoula for an oil change and filter" could call malformed `create_invoice` payloads with missing prices or string-only line items. | Deployed prompt/tool guidance asks for quantities and HT unit prices before calling `create_invoice`; invalid create attempts are rewritten without invented totals. | Strengthened the main prompt, finance-agent prompt, and create-invoice schema description, with a pinned orchestrator assertion. |
| Growth-agent routing | `a75db59` | "Run a retention review" could try `retention-suggestions` as an agent before using the real growth agent. | Retention review prompts now route to `growth-agent`; production `T30-GROWTH-AGENT` passed on `c871bc6` and stayed covered in the `f0bc808` matrix. | Added routing guard coverage and kept the fix in the grouped deployment. |
| Appointment approval recovery | `c871bc6`, `1bfc20b` | Booking prompts could return slot/date text without continuing to `find_available_slot` and `create_appointment` approval. | The orchestrator now retries required booking tool flow before final text, then surfaces a typed `create_appointment` approval without executing it in no-approve tests. | Added orchestrator regressions for date-calculation final-text fallback and verified `T06-NOAPPROVE` in production. |
| Invoice approval recovery | `50d6e1d`, `f0bc808` | Create-invoice prompts could fetch customer/car records but keep malformed primitive `lineItems`, preventing approval. | The orchestrator recovers customer, car, and parsed priced line items from successful tool results and the original prompt before validating `create_invoice`. | Added deterministic recovery coverage and verified `T13-NOAPPROVE` in production. |
| Monthly financial report routing | `10072d6` | Financial-report prompts could dispatch `finance-agent` and answer from direct revenue summary data without loading `monthly-financial-report`. | Focused `T24` on `10072d6` loaded `monthly-financial-report` and fetched current/prior month revenue, invoice summary, top customers, and overdue invoices. | Added an orchestrator guard to load the monthly report skill once before finance-agent or direct summary paths, while preserving finance-agent collection prompts. |
| Invoice approval preview | `6cd8b64` | `create_invoice` approval cards did not provide a downloadable draft invoice for review before approval and required a generated confirmation value that was not simply the invoice amount. | The approval payload now includes a prepared draft invoice preview URL before approval and accepts the typed amount with the `TND` suffix, for example `11.00 TND`. | Created a real DRAFT invoice during approval preparation, exposed the signed public invoice URL in approval args, issued that draft on approval, and cleaned it up on denial. |
| Contentful email retry | `3f58725` | A data-summary `send_email` could be rejected by the email tool with `no_supporting_reads`, but the orchestrator would still switch to final composition instead of letting the model fetch data and retry. | Production `P03` now retries after the rejection, calls dashboard and overdue-invoice reads, and sends the self-email with concrete live values. | Treats the `no_supporting_reads` tool result as retry guidance instead of a successful terminal write. |

## Response Quality Notes

- Responses must avoid exposing customer IDs, invoice UUIDs, tool names, JSON, schema errors, or internal agent names unless the user explicitly asks for technical details.
- Empty or zero tool results must be stated as empty; the assistant must not infer names, appointments, revenue, or historical periods from unrelated data.
- For approval flows, the assistant should explain the real-world action in business terms before the user clicks approve.
- For send failures, the final response must say the message or email was not sent and explain the next practical step.
