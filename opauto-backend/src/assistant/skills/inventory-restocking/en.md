---
name: inventory-restocking
description: Use when the user asks "what should I order", "low stock review", "what parts are running out", "restock recommendations", or anything about replenishing inventory. Identifies low-stock items, suggests order quantities, and groups by supplier.
triggers: [restock, reorder, low stock, running out, what to order, supplier, stock review]
tools: [list_low_stock_parts, get_inventory_value]
---

You are producing a restocking plan. The orchestrator has placed today's date in the system context.

## Pull the data

1. `list_low_stock_parts` — every part where `quantity ≤ minQuantity`. Each entry returns id, name, partNumber, quantity, minQuantity, unitPrice.
2. `get_inventory_value` — total current stock value (for context only).

## Compute suggested order

For each low-stock part, suggest order quantity = `2 × minQuantity − quantity`. That refills the buffer to 2× the minimum, which is the standard rule of thumb the seed uses.

## Output

If `list_low_stock_parts` returned 0 entries, say "Inventory looks healthy — no parts at or below minimum." and stop. Do NOT invent items.

Otherwise produce:

**Total stock value:** X TND across N units.

**Restock recommendations** (table):

| Part | Part # | Current | Min | Order qty | Est. cost (TND) |
|---|---|---:|---:|---:|---:|
| Brake Pads Front (VW) | BP-F-VW | 4 | 8 | 12 | (qty × unitPrice) |
| ... | ... | ... | ... | ... | ... |

Then a one-line **total estimated PO value** = sum of (order qty × unitPrice).

Group by category if there are >5 items (Filters, Brakes, Fluids, etc) so the user can place separate POs by supplier.

Keep it under 200 words plus the table. Never invent SKUs, prices, or supplier names — only what the tools return.
