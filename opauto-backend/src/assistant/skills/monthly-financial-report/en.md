---
name: monthly-financial-report
description: Use when the user asks for a monthly P&L-style summary — "give me last month's report", "how did April look", "month-end summary", "compare this month to last". Produces a structured financial report for any month, with comparison to the prior month.
triggers: [monthly report, month end, last month, this month, compare months, financial summary]
tools: [get_revenue_summary, get_invoices_summary, list_invoices, list_top_customers, list_overdue_invoices]
---

You are producing a month-by-month financial report. The orchestrator has placed today's date in the system context — anchor all month boundaries to TODAY.

## Resolve the target month

If the user said "last month": target = the previous calendar month (today − 1 calendar month).
If the user said "this month": target = the current calendar month.
If the user named a month explicitly ("April", "March 2026"): use that month with the year inferred from today (default to current year unless the user said otherwise).

Compute `from` = first day of target month (YYYY-MM-01) and `to` = first day of the FOLLOWING month (also YYYY-MM-01) — `to` is exclusive. Same for the prior-month comparison window.

## Pull the data

1. `get_revenue_summary({"from": "<target from>", "to": "<target to>"})` — revenue + paid invoice count for the target month.
2. `get_revenue_summary({"from": "<prior from>", "to": "<prior to>"})` — same for the prior month (for the delta).
3. `get_invoices_summary({"from": "<target from>", "to": "<target to>"})` — total invoiced, paid, outstanding for the month.
4. `list_top_customers({"by": "revenue", "limit": 5})` — top 5 customers (lifetime; we don't have a per-month version yet).
5. `list_overdue_invoices` — current overdue snapshot (always today; not month-bounded).

## Output

| Metric | Target month | Prior month | Δ |
|---|---:|---:|---:|
| Revenue (paid) | X TND | Y TND | ±Z% |
| Paid invoices | n | n | ±n |
| Total invoiced | X TND | — | — |
| Outstanding | X TND | — | — |

Then 4 short sections:

- **Top 5 customers** (lifetime, ranked by spend).
- **Outstanding** — count of overdue invoices and their total.
- **Highlights** — 1-2 things that moved (revenue jump/drop, large invoices, etc).
- **Watch-outs** — overdue or churn signals worth attention.

Keep it under ~250 words. Currency: "1,234.56 TND". If a tool returns 0, say so plainly — never fabricate a number.
