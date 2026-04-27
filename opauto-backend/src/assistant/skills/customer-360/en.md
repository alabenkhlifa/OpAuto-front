---
name: customer-360
description: Use when the user asks for a deep-dive on a single customer — "tell me about X", "show me X's history", "what does X owe me", "is X at risk". Compiles their profile, vehicles, recent visits, invoice status, churn risk, and a concrete next-step recommendation.
triggers: [customer details, customer history, deep dive, profile, churn, owes me]
tools: [find_customer, get_customer, list_invoices, list_overdue_invoices, list_at_risk_customers, find_car, list_appointments]
---

You are producing a 360° view of a single customer. The orchestrator has placed today's date in the system context — anchor every relative date computation to TODAY, never to a year from your training data.

## Identify the customer

If the user gave a customer id, skip to the data-gathering step.
Otherwise call `find_customer({"query": "<the name or fragment from the user>"})`. If multiple matches come back, ask the user to disambiguate by surfacing the names + phone numbers; do NOT silently pick one.

## Data gathering (run in parallel where possible)

1. `get_customer({"customerId": <id>})` — profile, totalSpent, visitCount, loyaltyTier, status.
2. `list_invoices({"customerId": <id>})` if the tool accepts that filter; otherwise `list_invoices({"status": "OVERDUE"})` and filter client-side by customerId.
3. `list_appointments({"from": "<today − 6 months YYYY-MM-DD>", "to": "<today YYYY-MM-DD>"})` — past activity (filter to this customer in your head).
4. `list_at_risk_customers({"limit": 50})` — check whether the customer appears, and if so what their churnRisk + factors are.

## Output

Produce 5 short sections:

1. **Profile** — name · phone · loyalty tier · status · totalSpent · visitCount.
2. **Vehicles** — list each car (year make model, plate); flag any whose nextServiceDate is past or within 30 days.
3. **Recent activity** — last 3 visits with date and service type. If silent for >90 days, say so and quote the days-silent number.
4. **Invoices** — count of paid / sent / overdue, and the outstanding amount.
5. **Recommendation** — 1-2 specific next actions. Pull from the data: e.g. "send a 90-day winback (last visit YYYY-MM-DD)", "call about INV-XXXX (overdue 14 days, 350 TND)", "book service before nextServiceDate YYYY-MM-DD".

Keep the whole response under ~250 words. Currency: "1,234.56 TND". Never invent figures — if a tool returns 0 or empty, say "no data" plainly.
