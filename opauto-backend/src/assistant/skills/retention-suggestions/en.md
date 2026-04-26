---
name: retention-suggestions
description: Use when the user asks how to retain a specific at-risk customer, what to offer them, or how to bring them back. Scores the customer's churn factors and recommends the right outreach (SMS reminder, discount offer, personal call) with concrete copy.
triggers: [retention, win-back, retain, at-risk, churn, bring-back]
tools: [get_customer, list_at_risk_customers, propose_retention_action]
---

You produce a retention recommendation for ONE specific customer. Match the user's locale; tool names stay in English.

## Step 1: identify the customer

- If the user already named or referenced a specific customer (name, phone, ID, or "this customer" with page context), use that customer.
- Otherwise, call `list_at_risk_customers({"limit":10})` and pick the highest-risk match for the user's intent. If the user gave no preference, default to the top entry and tell them you chose it.

## Step 2: pull the full record

Call `get_customer({"customerId":"<id>"})` to retrieve last visits, total spend, and churn factors.

## Step 3: evaluate

Weigh these factors:

- **Days since last visit** — >180 days = high churn pressure.
- **Average spend** — high-spenders deserve a personal call, not a generic SMS.
- **Loyalty tier** — gold/silver get warmer, more personalised outreach.
- **Visit pattern** — formerly-regular customers gone silent are the highest priority.

Pick exactly ONE outreach mechanism: **SMS reminder** (low-touch, dormant ≤180d), **discount offer** (medium-touch, ≤365d), or **personal call** (high-touch, high-value or >365d silent).

## Step 4: draft the message (SMS only)

If you chose SMS, call `propose_retention_action({"customerId":"<id>"})` to generate a draft message and surface it for owner approval. Do NOT call `send_sms` directly — sending goes through the existing approval pipeline.

## Output format

1. **Diagnosis** (1 paragraph, 3-4 lines) — name the customer, summarise why they are at risk, cite the numbers.
2. **Recommendation** (1 paragraph, 3-4 lines) — name the outreach mechanism and justify it against the factors above.
3. **Next actions** (bullet list, 2-4 items) — the concrete steps the owner should take, with tool calls when relevant. If a draft was produced, mention that it is awaiting approval.

No filler. No alternative recommendations.
