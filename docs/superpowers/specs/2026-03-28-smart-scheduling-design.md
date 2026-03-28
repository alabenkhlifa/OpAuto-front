# Smart Scheduling AI Feature — Design Spec

## Context

OpAuto's appointment form lets users manually pick a date, time, and mechanic. Smart Scheduling adds an "AI Suggest" button that analyzes real availability data and recommends the top 3 optimal time slots with mechanic assignments. The frontend `AiService.suggestSchedule()` method and `AiScheduleRequest`/`AiScheduleResponse` interfaces already exist (stubbed). This feature needs a backend endpoint and frontend UI integration.

## Decision: Real Data + AI Ranking

The backend computes actual free slots from the database (appointments + employee schedules), then uses Claude/OpenAI to rank the top 3 by workload balance, specialty match, and efficiency. Falls back to heuristic sorting (lowest workload, earliest time) when no AI key is configured.

## Scope

### In scope
- Backend `POST /ai/suggest-schedule` endpoint with availability computation
- "AI Suggest" button in the appointment modal
- Suggestion cards UI (3 slots) with click-to-fill
- Translations (en/fr/ar)

### Out of scope
- Bay/lift tracking (no DB model for it — mechanic availability is the proxy)
- Calendar integration (suggestions only appear in the modal, not on the calendar view)
- Auto-suggest without button click

## Backend

### New DTO: `AiSuggestScheduleDto`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| serviceType | string | yes | e.g., "oil-change", "brake-service" |
| estimatedDuration | number | yes | Duration in minutes |
| preferredDate | string | no | ISO date string — if provided, suggestions center around this date |
| mechanicId | string | no | If user has a mechanic preference, prioritize them |

### Endpoint: `POST /ai/suggest-schedule`

Added to the existing `AiController`. JWT-protected. Returns `AiScheduleResponse` (already defined in frontend models).

### Availability Engine (in `AiService`)

**Step 1 — Gather data:**
- Query active employees where `skills` array contains the `serviceType` (Prisma `has` filter on String[] field)
- If no skill match, fall back to all active mechanics (MECHANIC role)
- Query non-cancelled appointments for the search window (next 7 days from today, or 3 days before/after `preferredDate`)
- Get garage working hours from GarageSettings (default 08:00–18:00 if not set)

**Step 2 — Compute free slots:**
- For each qualifying mechanic, for each working day in the window:
  - Start with the full working day as one free block
  - Subtract each existing appointment (startTime/endTime) to get remaining free windows
  - Filter windows where `duration >= estimatedDuration`
  - Emit candidate: `{ date, startTime, endTime, mechanicId, mechanicFirstName + lastName }`
- Cap at 20 candidates maximum before AI ranking

**Step 3 — Rank via AI:**
- Build a prompt with: candidate slots list, mechanic workloads (count of appointments this week), mechanic specialties, service type
- Ask Claude/OpenAI: "Pick the top 3 slots and explain why each is optimal. Consider workload balance, specialty match, and time efficiency."
- Parse AI response to extract top 3 with scores (0-1) and reasons
- **Mock fallback:** Sort candidates by mechanic appointment count (ascending), then by earliest time. Take top 3. Generate generic reasons like "Lowest workload this week" and "Specialty match: {skill}".

**Step 4 — Return response:**
Matches the existing `AiScheduleResponse` interface — array of `suggestedSlots` with `start`, `end`, `mechanicId`, `mechanicName`, `score`, `reason`.

### Dependencies
- `PrismaService` — to query appointments and employees
- `ConfigService` — for AI API keys
- Existing `chat` method — reused internally for AI ranking step

## Frontend

### Appointment Modal Changes

**File:** `src/app/features/appointments/components/appointment-modal.component.ts`

**New elements in the schedule section (after date/time pickers, before priority):**

1. **"AI Suggest" button**
   - Disabled until `serviceType` and `estimatedDuration` form fields are filled
   - Shows loading spinner while `aiService.loading()` is true
   - Glassmorphism-styled button with a sparkle/wand icon (using existing icon system)
   - Clicking calls `aiService.suggestSchedule()` with current form values

2. **Suggestion cards container**
   - Appears below the button after successful response
   - Shows up to 3 cards, each displaying:
     - Day name + date (e.g., "Monday, Mar 30")
     - Time range (e.g., "10:00 AM – 11:00 AM")
     - Mechanic name
     - AI reason text (1 line)
     - Score as a visual indicator (e.g., colored dot or small bar)
   - Cards use existing glassmorphism card styling
   - Each card is clickable

3. **On card click:**
   - Set `scheduledDate` form control to the suggestion's date
   - Set `scheduledTime` form control to the suggestion's start time (formatted as HH:mm)
   - Set `mechanicId` form control to the suggestion's mechanicId
   - Hide the suggestion cards after selection

4. **Error handling:**
   - If `aiService.error()` is set, show a subtle error message below the button
   - "AI suggestions unavailable" for PROVIDER_UNAVAILABLE
   - "Feature coming soon" for NOT_IMPLEMENTED
   - Generic message for other errors
   - Error clears when the user clicks the button again

### AiService Integration

The existing `suggestSchedule()` method already calls `POST /ai/suggest-schedule` via the `callAi` helper. No changes needed to `ai.service.ts`. The method will go live once the backend endpoint exists (currently returns NOT_IMPLEMENTED on 404).

### New Component: None

All UI lives within the existing `appointment-modal.component.ts` — no separate component needed. The suggestion cards are simple template elements, not a reusable component.

## Translations

New keys under `appointments.aiSuggest` namespace:

| Key | EN | FR | AR |
|-----|----|----|-----|
| button | AI Suggest | Suggestion IA | اقتراح ذكي |
| loading | Finding best slots... | Recherche des créneaux... | جاري البحث عن أفضل المواعيد... |
| cardTitle | Suggested Slot | Créneau suggéré | موعد مقترح |
| mechanic | Mechanic | Mécanicien | الميكانيكي |
| reason | Why | Pourquoi | لماذا |
| errorUnavailable | AI suggestions unavailable | Suggestions IA indisponibles | اقتراحات الذكاء الاصطناعي غير متاحة |
| errorGeneric | Could not load suggestions | Impossible de charger les suggestions | تعذر تحميل الاقتراحات |
| noSlots | No available slots found | Aucun créneau disponible | لم يتم العثور على مواعيد متاحة |

## Verification

1. **Backend**: Start backend, call `POST /ai/suggest-schedule` with `{ serviceType: "oil-change", estimatedDuration: 60 }` — should return 3 suggestions with real mechanic names and valid time slots
2. **Frontend**: Open appointment modal, select a service type and duration, click "AI Suggest" — should show 3 suggestion cards
3. **Selection**: Click a suggestion card — date, time, and mechanic fields should auto-fill
4. **Error**: Stop backend, click "AI Suggest" — should show error message, form still usable
5. **Build**: `ng build` passes, `tsc --noEmit` passes in backend
6. **Translations**: Switch language to FR and AR — all new strings appear correctly, AR is RTL
