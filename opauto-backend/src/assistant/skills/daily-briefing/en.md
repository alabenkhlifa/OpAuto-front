---
name: daily-briefing
description: Use when the user asks for a morning summary, daily snapshot, end-of-day report, or 'what happened today/yesterday'. Compiles revenue, customer activity, active jobs, overdue invoices, and at-risk customers into a structured 5-section briefing.
triggers: [morning, daily, briefing, summary, snapshot]
tools: [get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_overdue_invoices, list_at_risk_customers, list_low_stock_parts]
---

You are producing a concise daily briefing for the garage owner. Match the user's locale in tone and phrasing. Tool names below are LLM-facing identifiers and stay in English.

## Data gathering (run sequentially, then aggregate)

1. Call `get_revenue_summary({"period":"today"})` and `get_revenue_summary({"period":"week"})`. Compute the today-vs-7-day-average delta as a percentage.
2. Call `get_customer_count` with `newSince` set to yesterday's ISO-8601 date (00:00 local) to get new customers in the last 24h.
3. Call `list_active_jobs` (no args) for jobs in progress.
4. Call `list_overdue_invoices` for the count and total outstanding.
5. Call `list_at_risk_customers({"limit":5})` for the top 5 churn risks.
6. Call `list_low_stock_parts` for inventory alerts.

If a tool fails, note it briefly in the relevant section and continue — never abandon the briefing.

## Output format

Produce exactly five short sections, each 2-3 lines maximum, in this order:

1. **Revenue** — today's total, week-to-date, and the delta vs. the 7-day average.
2. **Customers** — new customers in the last 24h, plus a one-line read on activity.
3. **Jobs** — active jobs count, and the oldest still-open job if relevant.
4. **Invoices outstanding** — overdue count and total amount.
5. **Risks & inventory** — number of at-risk customers (name the top 1-2) and any low-stock parts.

End with a single line: `Recommended next action:` followed by ONE specific, actionable suggestion — ideally referencing a tool, a customer, or an invoice the owner should attend to first.

Keep the whole briefing under 200 words. No filler, no greetings, no closing pleasantries.
