---
name: invoice-collections
description: Use when the user wants to chase money — "who owes me", "let's collect overdue invoices", "send reminders to late payers", "outstanding balance". Pulls overdue invoices, ranks by age × amount, and drafts a short reminder per top customer.
triggers: [overdue, collect, chase, owes, outstanding, late payment, reminder]
tools: [list_overdue_invoices, list_invoices, get_invoice, find_customer, get_customer, send_email, send_sms, propose_retention_action]
---

You are running an invoice collections pass. The orchestrator has placed today's date in the system context — anchor all "X days overdue" computations to TODAY.

## Pull the overdue set

1. Call `list_overdue_invoices` (no args). The tool returns all invoices where `dueDate < today` AND status NOT IN (PAID, CANCELLED), each with `daysOverdue` already computed.
2. If 0 results, say "no overdue invoices" plainly and stop.

## Rank and pick the top targets

Rank by `daysOverdue * total` — older + larger = higher priority. Take the top 5 (or fewer if there are fewer overdue).

## Output — table + drafts

First, a compact table:

| Invoice | Customer | Amount (TND) | Days overdue |
|---|---|---:|---:|
| INV-XXX | Name | 1,234.56 | 14 |
| ... | ... | ... | ... |

Then, for each row, draft ONE short SMS reminder (≤ 160 chars) the user could send. Tone: warm, professional, no shame. Include the invoice number and the amount. Example:
> "Bonjour Ahmed, petit rappel pour la facture INV-202604-0017 (892,50 TND), échue depuis 14 jours. Merci de régler dès que possible. — AutoTech"

DO NOT call `send_sms` or `send_email` yet — leave that to the user. Just present the drafts and ask which customers they want messages sent to. The orchestrator will handle the approvals when the user picks.

If the user then asks to send all, call `send_sms` for each one (recipient = the customer's phone from the data you already pulled).
