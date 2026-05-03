# Assistant UI Redesign — Friendly, JSON-free

**Date:** 2026-05-03
**Author:** Ala
**Status:** Approved direction; remaining sub-decisions made by implementer per user instruction

## Goal

Redesign the AI assistant chat panel for non-technical garage owners. The current UI exposes raw `JSON.stringify(args/result)` for every tool call and approval, which is unreadable to the target user. Tool *names* must remain visible (used in demos to show the assistant's capability), but everything else technical must go.

## Decisions

| # | Decision | Pick |
|---|----------|------|
| 1 | Scope | Full chat panel redesign (panel, header, empty state, message bubbles, tool rendering, approval card, conversation list) |
| 2 | Personality | Friendly assistant: warm conversational copy, soft rounded bubbles, sparkle accent, generous spacing |
| 3 | Tool args/result rendering | **Per-tool friendly templates** (28 tools, hand-written copy via i18n keys). No generic fallback in the user-facing flow — defensively log + show "Working on it…" for unknown tools |
| 4 | Approval card body | **Action preview** — renders what the user is approving (SMS bubble, appointment card, payment summary, etc.) instead of JSON |
| 5 | Conversation list | **Hidden drawer** — slide-in overlay opened from history icon; default view is full-width chat |
| 6 | Empty state | **Page-aware** — chips adapt to current route + selected entity; falls back to curated chips |
| 7 | Tool name visibility | Small muted pill **under** the assistant bubble (`· via {{toolName}}`). No expand-to-JSON in production. `?debug=assistant` query flag re-enables raw JSON |
| 8 | TOOL-role messages | Silent-dropped on frontend (backend keeps storing them, change is non-destructive) |
| 9 | Approval header | "Quick check before I do this" |
| 10 | Approve button label | Action-verb per tool ("Yes, send SMS" / "Yes, book it" / "Yes, cancel it" / "Yes, record payment") |
| 11 | Backend changes | **None.** SSE schema, tool registry, blast tiers, approval flow unchanged |

## Architecture

### One new service: `AssistantToolPresenterService`

Frontend-only registry. Every tool name maps to a `ToolPresenter`:

```
interface ToolPresenter<TArgs = unknown, TResult = unknown> {
  toolName: string;                 // e.g. 'appointments.list'
  // i18n keys
  runningKey: string;               // 'assistant.tools.appointments-list.running'
  successKey: string;               // 'assistant.tools.appointments-list.success'
  failureKey: string;               // 'assistant.tools.appointments-list.failure'
  // Param extractors return params for the i18n template (e.g. {{count}}, {{date}})
  runningParams?: (args: TArgs) => Record<string, string | number>;
  successParams?: (args: TArgs, result: TResult) => Record<string, string | number>;
  failureParams?: (args: TArgs, error: string) => Record<string, string | number>;
  // Approval-tier tools only
  previewComponent?: Type<unknown>;
  previewInputs?: (args: TArgs) => Record<string, unknown>;
  // Approval-tier action verb (drives Approve button label)
  approveVerbKey?: string;          // 'assistant.tools.appointments-create.approveVerb'
}
```

Public API:

```
class AssistantToolPresenterService {
  format(msg: AssistantUiMessage): { friendlyLine: string; toolPill: string; pillTitle: string };
  approvalSummary(p: AssistantPendingApproval): {
    headerKey: string;
    headerParams: Record<string, string|number>;
    previewComponent?: Type<unknown>;
    previewInputs?: Record<string, unknown>;
    approveVerbKey: string;
  };
}
```

### Tool tier breakdown (from backend grep)

- **CONFIRM_WRITE** (need preview): `appointments.cancel`, `appointments.create`, `communications.send-sms` — 3 previews
- **TYPED_CONFIRM_WRITE** (preview + typed input): `invoicing.record-payment` — 1 preview
- **AUTO_WRITE** (no approval today, but build preview anyway for future use): `communications.send-email` — 1 preview
- **READ** (24 tools): no preview, just running + success copy

→ **5 preview components total + 24 read-only presenters.**

### New components

```
features/assistant/
├── services/
│   └── assistant-tool-presenter.service.ts
├── components/
│   ├── assistant-action-preview/
│   │   ├── sms-preview.component.{ts,html,css}
│   │   ├── email-preview.component.{ts,html,css}
│   │   ├── create-appointment-preview.component.{ts,html,css}
│   │   ├── cancel-appointment-preview.component.{ts,html,css}
│   │   └── record-payment-preview.component.{ts,html,css}
│   ├── assistant-empty-state/
│   │   └── assistant-empty-state.component.{ts,html,css}
│   └── assistant-conversation-drawer/
│       └── assistant-conversation-drawer.component.{ts,html,css}
```

### Modified components

- `assistant-panel.component.{ts,html,css}` — full-width chat default; history icon opens drawer; sparkle title; inline thinking indicator.
- `assistant-message.component.{ts,html,css}` — drop JSON `<pre>` + expand toggle. Render presenter output. Add small "via {{toolName}}" pill under the bubble. Drop standalone TOOL-role rendering.
- `assistant-approval-card.component.{ts,html,css}` — drop JSON args + expand toggle. Host preview component dynamically (`@Component {NgComponentOutlet}`). New header copy. Action-verb approve button. Friendlier timer text.
- `assets/i18n/{en,fr,ar}.json` — net-new keys for all tool presenters + new panel/header/empty/approval copy.

## Page-aware empty state

`AssistantEmptyStateComponent` reads current `AssistantPageContext` and selects chips:

```
type EmptyChip = { icon: string; labelKey: string; prompt: string };
type ChipSelector = (ctx: AssistantPageContext) => EmptyChip[];

const PAGE_CHIPS: { match: RegExp; chips: ChipSelector }[] = [
  { match: /^\/customers\/[^/]+$/, chips: (ctx) => [
    { icon: '📅', labelKey: '...bookForCustomer', prompt: `Book an appointment for ${ctx.selectedEntity?.displayName}` },
    { icon: '🧾', labelKey: '...lastInvoices', prompt: `Show ${ctx.selectedEntity?.displayName}'s last 5 invoices` },
    { icon: '🔧', labelKey: '...maintenanceDue', prompt: `Cars due for service` },
  ]},
  { match: /^\/appointments/, chips: () => [...] },
  { match: /^\/invoices/, chips: () => [...] },
  // ...
];

const ALWAYS_ON: EmptyChip[] = [
  { icon: '💰', labelKey: '...lastWeekRevenue', prompt: 'How was last week?' },
  { icon: '🔧', labelKey: '...carsDueService', prompt: 'Which cars are due for service?' },
  { icon: '👤', labelKey: '...addCustomer', prompt: 'Add a new customer' },
];
```

Chip click → pipes the prompt directly into `AssistantChatService.send()`. No LLM round trip to *generate* suggestions; everything is deterministic and instant.

## Approval card preview hosting

`assistant-approval-card.component.html` swaps the JSON `<pre>` for:

```
<section class="approval-card__body">
  <ng-container
    *ngComponentOutlet="presenterSummary().previewComponent;
                         inputs: presenterSummary().previewInputs"
  ></ng-container>
</section>
```

The `previewComponent` is resolved at render time from the presenter registry. If a tool is missing a preview (defensive), fall back to a single-line "I'd like to {{action}}" sentence — never crash, never show JSON.

The typed-confirm flow (record-payment) keeps its typed input but moves it **below** the preview, with friendlier label copy.

## i18n keys (new)

Top-level shape:

```
"assistant": {
  "header": {
    "title": "Assistant",
    "thinking": "Thinking…",
    "history": "Conversation history",
    "newConversation": "New conversation",
    "close": "Close"
  },
  "empty": {
    "greeting": "Hey 👋 What can I help with?",
    "greetingWithEntity": "You're on {{name}}'s page. Want to:",
    "tryThese": "Try one of these:",
    "orJustAsk": "Or just ask anything…",
    "chips": {
      "todayAppointments": "What's on today?",
      "lastWeekRevenue": "How was last week?",
      "carsDueService": "Cars due for service",
      "addCustomer": "Add a new customer",
      "bookForCustomer": "Book an appointment for {{name}}",
      "lastInvoicesForCustomer": "See {{name}}'s last 5 invoices",
      "..." : "..."
    }
  },
  "tools": {
    "appointments-list": {
      "running": "Looking up your appointments…",
      "success": "Found {{count}} appointment(s)",
      "failure": "Couldn't load appointments — {{error}}"
    },
    "appointments-create": {
      "running": "Booking the appointment…",
      "success": "Booked for {{when}}",
      "failure": "Couldn't book — {{error}}",
      "approveVerb": "Yes, book it"
    },
    "communications-send-sms": {
      "running": "Sending the SMS…",
      "success": "Sent to {{recipient}}",
      "failure": "Couldn't send — {{error}}",
      "approveVerb": "Yes, send SMS"
    },
    "...all 28 tools..."
  },
  "approval": {
    "title": "Quick check before I do this",
    "expiresIn": "You have {{minutes}}:{{seconds}} to confirm",
    "expired": "This expired — let me know if you'd like to try again",
    "deny": "Cancel",
    "typeToConfirm": "Type {{expectedConfirmation}} to confirm",
    "viaTool": "via {{toolName}}"
  },
  "message": {
    "viaTool": "via {{toolName}}",
    "thinking": "Thinking…",
    "errorTitle": "Something went wrong"
  }
}
```

## Edge cases

- **Unknown tool** (a tool added on backend without a frontend presenter): log a `console.warn`, render `Working on it…` running line and `Done.` success line, hide the pill. Never crash. Never show JSON.
- **Streaming partial result**: presenter is invoked only after a full `tool_result` SSE event; while still in flight, the running copy is shown with a soft `◐` rotating glyph.
- **Approval expires**: keep the existing "expired" path but with friendlier copy ("This expired — let me know if you'd like to try again").
- **Approve button disabled while streaming**: same logic as today (settled / expired / typed-confirm mismatch); just rewords the copy.
- **RTL (Arabic)**: keep all chrome / chips RTL-correct. The preview components use plain text + numbers — they're naturally direction-agnostic.

## Non-goals

- Backend changes (SSE schema, tool definitions, blast tiers, registry — all unchanged)
- Suggesting prompts via LLM (chips are deterministic only)
- New conversation features (rename, pin, multi-select) — out of scope
- Markdown rendering changes — keep current `marked` integration
- Voice controls redesign — keep as-is, just relocate within the new footer

## Risks

| Risk | Mitigation |
|------|-----------|
| New tool added on backend without a frontend presenter → blank or generic UI | Defensive fallback already specified; e2e test that asserts "no JSON.stringify in DOM" guards regressions |
| i18n key drift across en/fr/ar (per CLAUDE.md "ar uses singular keys") | Use a presenter-registry-driven key generator + lint script in tests that walks all 3 files for parity |
| Drawer overlay covers part of chat unintentionally | Drawer is a separate slide-in element, not part of the chat width — chat stays full-width underneath |
| Removing TOOL-role rendering hides results → blank turns | Tool result is already attached to its parent assistant message (`AssistantUiMessage.toolCall`); rendering moves there, not deleted |

## Testing

- **Unit**: `assistant-tool-presenter.service.spec.ts` — every backend tool has a presenter (registry-vs-backend parity test); param extraction; failure path; approval summary
- **Component**: each new preview component has a spec with sample args
- **i18n**: parity test that asserts every presenter's `runningKey` / `successKey` / `failureKey` resolves in en, fr, ar
- **E2E (Chrome DevTools MCP)**: open panel → see page-aware empty state → click chip → assistant renders friendly running line → result renders friendly success line → no `{`, `}`, `JSON` strings in the chat content
- **E2E approval flow**: trigger an SMS-send → see action preview (not JSON) → approve → success message; trigger a payment → see preview + typed-confirm → approve → success
