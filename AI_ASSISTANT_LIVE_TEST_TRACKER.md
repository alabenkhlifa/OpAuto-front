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
| Write approval prechecks | `a37c34b` | Invalid appointment ids could still produce cancellation approval cards; invoice creation could route to `send_email`; SMS approvals could contain placeholder recipients. | The orchestrator now rejects malformed write payloads before approval/auto-write and routes invoice creation prompts to `create_invoice` with customer lookup tools. | Added pre-approval validation for explicit invalid appointment IDs, SMS customer binding, empty/placeholder emails, and invoice creation routing regressions. |
| Response synthesis hardening | `eb83242` | Production retest showed good tool/agent data could still end in bad final text: "today" included tomorrow, available slots were denied, invoice replies leaked technical fields, and agent iteration caps emitted a generic timeout. | The assistant now post-processes final text to correct available-slot contradictions, strip visible reasoning scaffolds and internal IDs, preserve useful agent results at the iteration cap, and clamp model-emitted today-to-tomorrow appointment ranges. | Added orchestrator regressions for slot contradiction, reasoning/ID scrubbing, and iteration-cap agent fallback, plus appointment date-range coverage and customer-360 upcoming-booking guidance. |
| Briefing and quarter-window correction | `3ec3d0c` | After the `eb83242` deploy, T19 still exposed daily-briefing process headings and T26 anchored "this quarter vs last quarter" to stale 2024/2023 windows. | Daily briefing output now drops process sections before the compiled briefing, and stale quarter comparison revenue calls are corrected to the current quarter-to-date and previous full quarter. | Added regressions for compiled-briefing extraction and stale quarter comparison range correction. |
| Failed-call and report synthesis hardening | local, not deployed | Invalid cancel and invoice-creation prompts could loop through invalid arguments until a generic timeout; report tools could return a URL with no visible reply; slot search could say no slot even when slots existed. | Local tests now force compose-only after repeated invalid/precheck failures, synthesize report download links from successful tool results, and correct "unable to find" slot contradictions. | Shared failed-attempt accounting across validation/precheck/execution failures and added focused orchestrator coverage. |
| Draft-only email guard | local, not deployed | "Draft an email ... do not send" still attempted `send_email` and exposed internal guard text. | Local tests now block `send_email` before execution when the user asks for a draft only and instruct the model to provide the draft. | Added a pre-send guard for draft-only wording and safer compose-only error instructions. |
| Overdue invoice customer labels | local, not deployed | Invoice collections tables could leak customer UUIDs because `list_overdue_invoices` returned only `customerId`. | Local tests now return `customerName` and `customerPhone`, update the collections skill to display names, and scrub partial UUID fragments. | Expanded the overdue invoice projection and response scrubber coverage. |
| Invoice creation missing details | local, not deployed | "Make an invoice for Khaoula for an oil change and filter" could call malformed `create_invoice` payloads with missing prices or string-only line items. | Local prompt/tool guidance now tells the model to ask for quantities and HT unit prices before calling `create_invoice`. | Strengthened the main prompt, finance-agent prompt, and create-invoice schema description, with a pinned orchestrator assertion. |

## Response Quality Notes

- Responses must avoid exposing customer IDs, invoice UUIDs, tool names, JSON, schema errors, or internal agent names unless the user explicitly asks for technical details.
- Empty or zero tool results must be stated as empty; the assistant must not infer names, appointments, revenue, or historical periods from unrelated data.
- For approval flows, the assistant should explain the real-world action in business terms before the user clicks approve.
- For send failures, the final response must say the message or email was not sent and explain the next practical step.
