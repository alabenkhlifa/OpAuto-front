# Smart Scheduling AI Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "AI Suggest" button to the appointment modal that calls the backend to compute real availability from the database and return the top 3 optimal time slots with mechanic assignments.

**Architecture:** New backend endpoint `POST /ai/suggest-schedule` queries employees + appointments from Prisma, computes free slots, ranks via AI (or heuristic fallback), returns top 3. Frontend adds an "AI Suggest" button to the appointment modal that calls `AiService.suggestSchedule()` (already wired) and displays suggestion cards that auto-fill form fields on click.

**Tech Stack:** NestJS, Prisma, Angular 15+, RxJS, Angular Signals, i18n (en/fr/ar)

**Spec:** `docs/superpowers/specs/2026-03-28-smart-scheduling-design.md`

---

### Task 1: Add backend DTO for suggest-schedule

**Files:**
- Modify: `opauto-backend/src/ai/dto/chat.dto.ts`

- [ ] **Step 1: Add the AiSuggestScheduleDto class**

Add to the bottom of `opauto-backend/src/ai/dto/chat.dto.ts`:

```typescript
export class AiSuggestScheduleDto {
  @ApiProperty() @IsString() appointmentType: string;

  @ApiProperty() @IsNumber() estimatedDuration: number;

  @ApiProperty({ required: false }) @IsString() @IsOptional() preferredDate?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() mechanicId?: string;
}
```

Add `IsNumber` to the existing `class-validator` import.

Field names match the frontend `AiScheduleRequest` interface exactly: `appointmentType` (not `serviceType`), `estimatedDuration`, `preferredDate`, `mechanicId`.

- [ ] **Step 2: Verify backend compiles**

Run: `cd opauto-backend && npx tsc --noEmit 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add opauto-backend/src/ai/dto/chat.dto.ts
git commit -m "feat(ai): add AiSuggestScheduleDto for smart scheduling endpoint"
```

---

### Task 2: Add suggest-schedule endpoint and availability engine to backend

**Files:**
- Modify: `opauto-backend/src/ai/ai.service.ts`
- Modify: `opauto-backend/src/ai/ai.controller.ts`
- Modify: `opauto-backend/src/ai/ai.module.ts`

**Context:**
- The AI service currently has no `PrismaService` dependency — it needs to be added.
- The `AiModule` currently doesn't import `PrismaModule` — `PrismaService` is global (`@Global()` in this project), so no module import is needed, but the constructor injection must be added to `AiService`.
- The `AiController` currently doesn't use `@CurrentUser` — the new endpoint needs `garageId` to scope queries.
- The response must match the frontend `AiScheduleResponse` interface: `{ suggestedSlots: Array<{ start, end, mechanicId, mechanicName, score, reason }>, provider }`.

- [ ] **Step 1: Add PrismaService to AiService constructor**

In `opauto-backend/src/ai/ai.service.ts`, add import:
```typescript
import { PrismaService } from '../prisma/prisma.service';
```

Add to existing constructor (keep `ConfigService`):
```typescript
constructor(
  private configService: ConfigService,
  private prisma: PrismaService,
) {
```

- [ ] **Step 2: Add the suggestSchedule method to AiService**

Add the `suggestSchedule` method to `opauto-backend/src/ai/ai.service.ts`. This is the availability engine. The method signature:

```typescript
async suggestSchedule(
  garageId: string,
  dto: AiSuggestScheduleDto,
): Promise<{
  suggestedSlots: Array<{
    start: string;
    end: string;
    mechanicId: string;
    mechanicName: string;
    score: number;
    reason: string;
  }>;
  provider: string;
}>
```

Add `AiSuggestScheduleDto` to the import from `./dto/chat.dto`.

**Implementation logic:**

**Step 2a — Query employees:**
```typescript
const employees = await this.prisma.employee.findMany({
  where: {
    garageId,
    status: 'ACTIVE',
    skills: { has: dto.appointmentType },
  },
});
// Fallback: if no skill match, get all active mechanics
if (employees.length === 0) {
  const allMechanics = await this.prisma.employee.findMany({
    where: {
      garageId,
      status: 'ACTIVE',
      role: 'MECHANIC',
    },
  });
  employees.push(...allMechanics);
}
```

If still empty after fallback, return `{ suggestedSlots: [], provider: 'none' }`.

**Step 2b — Compute search window:**
```typescript
const now = new Date();
let windowStart: Date;
let windowEnd: Date;
if (dto.preferredDate) {
  const preferred = new Date(dto.preferredDate);
  windowStart = new Date(preferred);
  windowStart.setDate(windowStart.getDate() - 3);
  windowEnd = new Date(preferred);
  windowEnd.setDate(windowEnd.getDate() + 3);
} else {
  windowStart = new Date(now);
  windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 7);
}
// Don't look into the past
if (windowStart < now) windowStart = now;
```

**Step 2c — Query existing appointments in window:**
```typescript
const existingAppointments = await this.prisma.appointment.findMany({
  where: {
    garageId,
    status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    startTime: { gte: windowStart, lte: windowEnd },
  },
  select: {
    employeeId: true,
    startTime: true,
    endTime: true,
  },
});
```

**Step 2d — Compute free slots per employee:**

Default working hours: 08:00–18:00. Iterate each day in window, for each employee:
- Create a free block for the full working day (8:00 to 18:00 on that date)
- Sort existing appointments for that employee on that day by startTime
- Subtract each appointment's [startTime, endTime] from the free blocks to get remaining windows
- Filter windows where `(endTime - startTime) >= dto.estimatedDuration` minutes
- Snap slot start times to 30-minute boundaries for clean UX
- Emit candidates: `{ start: ISO string, end: ISO string, mechanicId, mechanicName: firstName + ' ' + lastName }`

Cap at 20 candidates total (break once reached).

**Step 2e — Rank candidates:**

Count each employee's appointments in the window (from `existingAppointments`). Build a workload map: `Map<employeeId, count>`.

**If AI key is available**, call `this.chat()` with a structured prompt:
```
You are a scheduling optimizer for a garage. Given these candidate time slots and mechanic workloads, pick the top 3 optimal slots. Consider:
1. Balance mechanic workloads (prefer mechanics with fewer appointments)
2. Match specialties (service type: ${dto.appointmentType})
3. Time efficiency (prefer morning slots, avoid end-of-day)

Candidates: ${JSON.stringify(candidates)}
Workloads: ${JSON.stringify(Object.fromEntries(workloadMap))}

Respond in JSON only: [{ "index": 0, "score": 0.95, "reason": "..." }, ...]
```

Parse the AI response, map indices back to candidates. If parsing fails, fall through to mock.

**Mock fallback:** Sort candidates by workload count ascending, then by start time ascending. Take top 3. Assign scores (0.9, 0.7, 0.5). Generate reasons:
- For the top pick: `"Lowest workload (${count} appointments this week)"`
- For skill matches: `"Specialty match: ${dto.appointmentType}"`
- For others: `"Available slot with balanced workload"`

**Step 2f — Return response:**
```typescript
return {
  suggestedSlots: top3.map(c => ({
    start: c.start,
    end: c.end,
    mechanicId: c.mechanicId,
    mechanicName: c.mechanicName,
    score: c.score,
    reason: c.reason,
  })),
  provider: this.anthropicKey ? 'claude' : this.openaiKey ? 'openai' : 'mock',
};
```

- [ ] **Step 3: Add endpoint to AiController**

In `opauto-backend/src/ai/ai.controller.ts`:

Add imports:
```typescript
import { AiSuggestScheduleDto } from './dto/chat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
```

Add the endpoint method after `estimate`:
```typescript
@Post('suggest-schedule')
suggestSchedule(
  @CurrentUser('garageId') garageId: string,
  @Body() dto: AiSuggestScheduleDto,
) {
  return this.aiService.suggestSchedule(garageId, dto);
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd opauto-backend && npx tsc --noEmit 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add opauto-backend/src/ai/
git commit -m "feat(ai): add suggest-schedule endpoint with availability engine"
```

---

### Task 3: Add "AI Suggest" button and suggestion cards to appointment modal

**Files:**
- Modify: `src/app/features/appointments/components/appointment-modal.component.ts`

**Context:**
- The modal is an inline template component (template + styles in the `.ts` file).
- It uses `inject()` pattern for services, `signal()` for state, and `TranslatePipe` for i18n.
- The `AiService` at `src/app/core/services/ai.service.ts` already has `suggestSchedule()` wired to `POST /ai/suggest-schedule`.
- The `AiScheduleRequest` uses `appointmentType` (not `serviceType`). The form has `serviceType` — map when calling.
- The `AiScheduleResponse` returns `suggestedSlots` array with `start`, `end`, `mechanicId`, `mechanicName`, `score`, `reason`.
- Existing form controls: `serviceType`, `estimatedDuration`, `scheduledDate`, `scheduledTime`, `mechanicId`.

- [ ] **Step 1: Add AiService injection and suggestion state**

In the component class, add:
```typescript
import { AiService } from '../../../core/services/ai.service';
import { AiScheduleSuggestion } from '../../../core/models/ai.model';
```

Add to the class:
```typescript
private aiService = inject(AiService);
suggestions = signal<AiScheduleSuggestion[]>([]);
```

- [ ] **Step 2: Add the requestAiSuggestions method**

```typescript
requestAiSuggestions(): void {
  const form = this.appointmentForm.value;
  this.suggestions.set([]);
  this.aiService.suggestSchedule({
    appointmentType: form.serviceType,
    estimatedDuration: form.estimatedDuration,
    preferredDate: form.scheduledDate || undefined,
    mechanicId: form.mechanicId || undefined,
  }).subscribe({
    next: (response) => {
      this.suggestions.set(response.suggestedSlots);
    },
    error: () => {
      // Error is already captured in aiService.error signal
    }
  });
}
```

- [ ] **Step 3: Add the applySuggestion method**

```typescript
applySuggestion(slot: AiScheduleSuggestion): void {
  const startDate = new Date(slot.start);
  const dateStr = startDate.toISOString().split('T')[0];
  const hours = startDate.getHours().toString().padStart(2, '0');
  const minutes = startDate.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  this.appointmentForm.patchValue({
    scheduledDate: dateStr,
    scheduledTime: timeStr,
    mechanicId: slot.mechanicId,
  });
  this.suggestions.set([]);
}
```

- [ ] **Step 4: Add the "AI Suggest" button to the template**

In the template, inside the Schedule Details `form-section`, after the mechanic/priority `form-row` (the `</div>` at what is currently around line 133), add:

```html
<!-- AI Suggest -->
<div class="ai-suggest-section">
  <button type="button" class="ai-suggest-btn"
          [disabled]="!appointmentForm.get('serviceType')?.value || !appointmentForm.get('estimatedDuration')?.value || aiService.loading()"
          (click)="requestAiSuggestions()">
    @if (aiService.loading()) {
      <div class="ai-spinner"></div>
      {{ 'appointments.aiSuggest.loading' | translate }}
    } @else {
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
      {{ 'appointments.aiSuggest.button' | translate }}
    }
  </button>

  @if (aiService.error(); as error) {
    <p class="ai-error">
      @if (error.code === 'PROVIDER_UNAVAILABLE') {
        {{ 'appointments.aiSuggest.errorUnavailable' | translate }}
      } @else {
        {{ 'appointments.aiSuggest.errorGeneric' | translate }}
      }
    </p>
  }

  @if (suggestions().length > 0) {
    <div class="ai-suggestions">
      @for (slot of suggestions(); track slot.start) {
        <button type="button" class="suggestion-card" (click)="applySuggestion(slot)">
          <div class="suggestion-header">
            <span class="suggestion-date">{{ slot.start | date:'EEE, MMM d' }}</span>
            <span class="suggestion-score" [style.opacity]="slot.score">●</span>
          </div>
          <span class="suggestion-time">{{ slot.start | date:'h:mm a' }} – {{ slot.end | date:'h:mm a' }}</span>
          <span class="suggestion-mechanic">{{ slot.mechanicName }}</span>
          <span class="suggestion-reason">{{ slot.reason }}</span>
        </button>
      }
    </div>
  }

  @if (suggestions().length === 0 && !aiService.loading() && !aiService.error() && suggestionsRequested()) {
    <p class="ai-no-slots">{{ 'appointments.aiSuggest.noSlots' | translate }}</p>
  }
</div>
```

Note: Add a `suggestionsRequested = signal(false)` to the class, set it to `true` in `requestAiSuggestions()` before the API call, and reset in `closeModal()`. This distinguishes "haven't asked yet" from "asked and got empty results".

Also add `DatePipe` to the component imports array:
```typescript
import { DatePipe } from '@angular/common';
// In @Component imports:
imports: [CommonModule, ReactiveFormsModule, TranslatePipe, DatePipe],
```

- [ ] **Step 5: Add CSS styles for the AI suggest section**

Add to the component's `styles` array:

```css
/* AI Suggest Section */
.ai-suggest-section {
  margin-top: 1rem;
}

.ai-suggest-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  color: #c4b5fd;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  justify-content: center;
}

.ai-suggest-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3));
  border-color: rgba(139, 92, 246, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
}

.ai-suggest-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.ai-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(196, 181, 253, 0.3);
  border-top: 2px solid #c4b5fd;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.ai-error {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.8rem;
}

.ai-no-slots {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #9ca3af;
  font-size: 0.8rem;
  text-align: center;
}

.ai-suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.suggestion-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  color: #ffffff;
}

.suggestion-card:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.suggestion-date {
  font-weight: 600;
  font-size: 0.875rem;
}

.suggestion-score {
  color: #8b5cf6;
  font-size: 1.25rem;
}

.suggestion-time {
  color: #d1d5db;
  font-size: 0.8rem;
}

.suggestion-mechanic {
  color: #c4b5fd;
  font-size: 0.8rem;
  font-weight: 500;
}

.suggestion-reason {
  color: #9ca3af;
  font-size: 0.75rem;
  font-style: italic;
}
```

- [ ] **Step 6: Verify frontend compiles**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/app/features/appointments/components/appointment-modal.component.ts
git commit -m "feat: add AI Suggest button and suggestion cards to appointment modal"
```

---

### Task 4: Add translations

**Files:**
- Modify: `src/assets/i18n/en.json`
- Modify: `src/assets/i18n/fr.json`
- Modify: `src/assets/i18n/ar.json`

- [ ] **Step 1: Add English translations**

In `src/assets/i18n/en.json`, inside the `"appointments"` object (after the last existing key but before the closing `}`), add:

```json
"aiSuggest": {
  "button": "AI Suggest",
  "loading": "Finding best slots...",
  "cardTitle": "Suggested Slot",
  "mechanic": "Mechanic",
  "reason": "Why",
  "errorUnavailable": "AI suggestions unavailable",
  "errorGeneric": "Could not load suggestions",
  "noSlots": "No available slots found"
}
```

- [ ] **Step 2: Add French translations**

In `src/assets/i18n/fr.json`, inside the `"appointments"` object, add:

```json
"aiSuggest": {
  "button": "Suggestion IA",
  "loading": "Recherche des créneaux...",
  "cardTitle": "Créneau suggéré",
  "mechanic": "Mécanicien",
  "reason": "Pourquoi",
  "errorUnavailable": "Suggestions IA indisponibles",
  "errorGeneric": "Impossible de charger les suggestions",
  "noSlots": "Aucun créneau disponible"
}
```

- [ ] **Step 3: Add Arabic translations**

In `src/assets/i18n/ar.json`, inside the `"appointments"` object, add:

```json
"aiSuggest": {
  "button": "اقتراح ذكي",
  "loading": "جاري البحث عن أفضل المواعيد...",
  "cardTitle": "موعد مقترح",
  "mechanic": "الميكانيكي",
  "reason": "لماذا",
  "errorUnavailable": "اقتراحات الذكاء الاصطناعي غير متاحة",
  "errorGeneric": "تعذر تحميل الاقتراحات",
  "noSlots": "لم يتم العثور على مواعيد متاحة"
}
```

- [ ] **Step 4: Verify frontend build (translation JSON validity)**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds (invalid JSON would break the build)

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n/en.json src/assets/i18n/fr.json src/assets/i18n/ar.json
git commit -m "feat: add Smart Scheduling translations (en/fr/ar)"
```

---

### Task 5: Update MVP progress

**Files:**
- Modify: `docs/MVP_PROGRESS.md`

- [ ] **Step 1: Check off the Smart Scheduling item**

In `docs/MVP_PROGRESS.md`, change:
```
- [ ] Smart Scheduling — "AI Suggest" on appointment form, backend endpoint, top 3 slots
```
to:
```
- [x] Smart Scheduling — "AI Suggest" on appointment form, backend endpoint, top 3 slots
```

- [ ] **Step 2: Commit**

```bash
git add docs/MVP_PROGRESS.md
git commit -m "docs: mark Smart Scheduling as complete"
```

---

## Verification Checklist

After all tasks are complete:

1. **Backend builds:** `cd opauto-backend && npx tsc --noEmit` — no errors
2. **Frontend builds:** `npx ng build --configuration development` — no errors
3. **Backend endpoint works:** Start backend, POST to `/ai/suggest-schedule` with `{ "appointmentType": "oil-change", "estimatedDuration": 60 }` — returns `suggestedSlots` array with real employee data
4. **Frontend button visible:** Open appointment modal, verify "AI Suggest" button appears in schedule section
5. **Button disabled state:** Button is disabled when service type or duration is empty
6. **Suggestions display:** Fill service type + duration, click "AI Suggest" — 3 suggestion cards appear
7. **Auto-fill works:** Click a suggestion card — date, time, and mechanic fields populate
8. **Error handling:** Stop backend, click "AI Suggest" — error message appears below button
9. **Translations:** Switch to FR/AR — all AI suggest strings render correctly
10. **MVP progress:** `docs/MVP_PROGRESS.md` shows Smart Scheduling checked off
