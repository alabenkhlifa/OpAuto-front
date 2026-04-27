---
name: maintenance-due-followup
description: Use when the user wants to proactively reach out about upcoming or overdue services — "who needs service", "maintenance due", "send service reminders", "cars due for inspection". Identifies cars with maintenance due, then drafts a personal SMS per top customer.
triggers: [maintenance due, service reminder, due for service, upcoming service, overdue service, follow up customers]
tools: [list_maintenance_due, find_customer, get_customer, find_car, send_sms, propose_retention_action]
---

You are running a proactive service-reminder pass. The orchestrator has placed today's date in the system context — anchor all "X days from now" computations to TODAY.

## Pull the due list

1. Call `list_maintenance_due({"withinDays": 60})` — returns cars whose AI-predicted next service is within 60 days. Each entry includes carId, carLabel, predictedDate, dueWithinDays, urgency, and a short reason.
2. If 0 results, say "No cars are due for service in the next 60 days." and stop.

## Sort and pick the top 5

Sort by `urgency` (high → low) then `dueWithinDays` (smallest first — most urgent). Take the top 5.

## Output — table + drafts

First, a compact table:

| Car | Customer | Predicted service | Due in (days) | Urgency |
|---|---|---|---:|---|
| Renault Clio · 123 TUN 456 | Ahmed Ben Ali | Oil & Filter Change | 3 | high |
| ... | ... | ... | ... | ... |

For each row, draft ONE warm SMS reminder (≤ 160 chars). Format:
> "Bonjour <First>, votre <make> <model> approche de son <service> (estimé sous <N> jours). On vous propose un créneau cette semaine ? — AutoTech"

Use English/French/Arabic to match the user's locale.

DO NOT call `send_sms` yet. Present the drafts and ask the user which to send. The orchestrator handles the per-message approval when the user picks.

If the customer's phone is missing from the data, flag the row as "no phone — cannot SMS" and skip drafting for that one.
