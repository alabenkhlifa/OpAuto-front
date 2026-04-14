# Calendar Drag-and-Drop Rescheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make calendar drag-and-drop actually reschedule appointments, with AI-powered conflict resolution when the mechanic is busy.

**Architecture:** `handleEventDrop` in `CalendarComponent` calls `AiService.suggestSchedule()` to validate the new time. If a matching slot exists, `AppointmentService.updateAppointment()` persists silently. If not, a new `RescheduleConflictModalComponent` shows alternative slots grouped by mechanic. All existing AI and appointment services are reused as-is.

**Tech Stack:** Angular 15+ standalone components, signals, RxJS, FullCalendar `EventDropArg`, existing `AiService` + `AppointmentService`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/features/calendar/components/reschedule-conflict-modal.component.ts` | Create | Modal showing AI-suggested alternative slots, split by mechanic |
| `src/app/features/calendar/calendar.component.ts` | Modify | Wire up `handleEventDrop`, inject services, add conflict modal signals |
| `src/app/features/calendar/calendar.component.html` | Modify | Add conflict modal template |

---

### Task 1: Create RescheduleConflictModalComponent

**Files:**
- Create: `src/app/features/calendar/components/reschedule-conflict-modal.component.ts`

- [ ] **Step 1: Create the component file**

Create `src/app/features/calendar/components/reschedule-conflict-modal.component.ts` with this content:

```typescript
import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiScheduleSuggestion } from '../../../core/models/ai.model';

@Component({
  selector: 'app-reschedule-conflict-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="cancelled.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">

        <header class="modal-header">
          <div>
            <h2 class="modal-title">This time slot isn't available</h2>
            <p class="modal-subtitle">Choose an alternative time below</p>
          </div>
          <button class="modal-close-btn" (click)="cancelled.emit()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <!-- Same mechanic slots -->
          @if (sameMechanicSlots().length > 0) {
            <div class="slot-section">
              <h3 class="section-label">Available times for {{ mechanicName }}</h3>
              <div class="slot-list">
                @for (slot of sameMechanicSlots(); track slot.start) {
                  <button class="slot-card" (click)="slotSelected.emit(slot)">
                    <div class="slot-time">{{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}</div>
                    <div class="slot-meta">{{ slot.reason }}</div>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Other mechanic slots -->
          @if (otherMechanicSlots().length > 0) {
            <div class="slot-section">
              <h3 class="section-label">Available with other mechanics</h3>
              <div class="slot-list">
                @for (slot of otherMechanicSlots(); track slot.start) {
                  <button class="slot-card" (click)="slotSelected.emit(slot)">
                    <div class="slot-time">{{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}</div>
                    <div class="slot-mechanic">{{ slot.mechanicName }}</div>
                    <div class="slot-meta">{{ slot.reason }}</div>
                  </button>
                }
              </div>
            </div>
          }

          <!-- No slots at all -->
          @if (sameMechanicSlots().length === 0 && otherMechanicSlots().length === 0) {
            <div class="empty-state">
              <p>No available slots found for this day. Try a different date.</p>
            </div>
          }
        </div>

        <footer class="modal-footer">
          <button class="modal-btn secondary" (click)="cancelled.emit()">Cancel</button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
      z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal-content {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px;
      width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.15);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid #e2e8f0;
    }
    .modal-title { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0 0 0.25rem; }
    .modal-subtitle { color: #6b7280; font-size: 0.875rem; margin: 0; }
    .modal-close-btn {
      width: 2rem; height: 2rem; border: none; background: #f3f4f6; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #6b7280; transition: all 0.2s;
    }
    .modal-close-btn:hover { background: #e5e7eb; color: #111827; }
    .modal-body { padding: 1.5rem; }
    .slot-section { margin-bottom: 1.5rem; }
    .slot-section:last-child { margin-bottom: 0; }
    .section-label {
      font-size: 0.8rem; font-weight: 600; color: #6b7280; text-transform: uppercase;
      letter-spacing: 0.05em; margin: 0 0 0.75rem; padding-left: 0.25rem;
    }
    .slot-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .slot-card {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: left;
    }
    .slot-card:hover { background: #fff7ed; border-color: rgba(255, 132, 0, 0.3); }
    .slot-time { font-weight: 600; font-size: 0.9rem; color: #111827; }
    .slot-mechanic { font-size: 0.8rem; color: #FF8400; font-weight: 500; }
    .slot-meta { font-size: 0.75rem; color: #6b7280; font-style: italic; }
    .empty-state { text-align: center; padding: 2rem 1rem; color: #6b7280; font-size: 0.9rem; }
    .modal-footer { padding: 1rem 1.5rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; }
    .modal-btn {
      flex: 1; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
    }
    .modal-btn.secondary { background: #f3f4f6; border: 1px solid #d1d5db; color: #374151; }
    .modal-btn.secondary:hover { background: #e5e7eb; }
  `]
})
export class RescheduleConflictModalComponent {
  @Input() suggestions: AiScheduleSuggestion[] = [];
  @Input() originalMechanicId = '';
  @Input() mechanicName = '';

  @Output() slotSelected = new EventEmitter<AiScheduleSuggestion>();
  @Output() cancelled = new EventEmitter<void>();

  sameMechanicSlots = computed(() =>
    this.suggestions.filter(s => s.mechanicId === this.originalMechanicId)
  );

  otherMechanicSlots = computed(() =>
    this.suggestions.filter(s => s.mechanicId !== this.originalMechanicId)
  );

  formatTime(iso: string): string {
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds (component is created but not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/app/features/calendar/components/reschedule-conflict-modal.component.ts
git commit -m "feat: add RescheduleConflictModalComponent for drag-drop conflicts"
```

---

### Task 2: Wire up handleEventDrop in CalendarComponent

**Files:**
- Modify: `src/app/features/calendar/calendar.component.ts` (imports, signals, handleEventDrop)

- [ ] **Step 1: Add imports**

Add these imports at the top of `calendar.component.ts`:

```typescript
import { AiService } from '../../core/services/ai.service';
import { AiScheduleSuggestion } from '../../core/models/ai.model';
import { LanguageService } from '../../core/services/language.service';
import { RescheduleConflictModalComponent } from './components/reschedule-conflict-modal.component';
```

Add `RescheduleConflictModalComponent` to the `imports` array in `@Component`.

- [ ] **Step 2: Inject services and add signals**

In the class body, add these injections after the existing ones:

```typescript
private aiService = inject(AiService);
private languageService = inject(LanguageService);
```

Add these signals after the existing `showAddModal` signal:

```typescript
showConflictModal = signal(false);
conflictSuggestions = signal<AiScheduleSuggestion[]>([]);
pendingDropAppointmentId = signal('');
pendingDropMechanicId = signal('');
pendingDropMechanicName = signal('');
isRescheduling = signal(false);
```

- [ ] **Step 3: Implement handleEventDrop**

Replace the existing stub `handleEventDrop` method with:

```typescript
handleEventDrop(dropInfo: EventDropArg) {
  if (this.isRescheduling()) return;
  this.isRescheduling.set(true);

  const event = dropInfo.event;
  const appointmentId = event.id;
  const mechanicId = event.extendedProps['mechanicId'] || '';
  const mechanicName = event.extendedProps['mechanicName'] || 'Unassigned';
  const serviceType = event.extendedProps['type'] || '';
  const startTime = event.start!;
  const endTime = event.end!;
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  this.aiService.suggestSchedule({
    appointmentType: serviceType,
    estimatedDuration: durationMin,
    preferredDate: startTime.toISOString(),
    mechanicId: mechanicId || undefined,
    language: this.languageService.getCurrentLanguage(),
  }).subscribe({
    next: (response) => {
      const exactMatch = response.suggestedSlots.find(slot => {
        const slotStart = new Date(slot.start).getTime();
        const dropStart = startTime.getTime();
        return slot.mechanicId === mechanicId
          && Math.abs(slotStart - dropStart) < 5 * 60000
          && slot.score >= 0.9;
      });

      if (exactMatch) {
        this.appointmentService.updateAppointment(appointmentId, {
          scheduledDate: startTime,
          mechanicId: exactMatch.mechanicId,
        }).subscribe({
          next: () => {
            this.appointmentService.getAppointments().subscribe(appts => {
              this.appointments = appts;
              this.loadEvents();
              this.isRescheduling.set(false);
            });
          },
          error: () => {
            dropInfo.revert();
            this.isRescheduling.set(false);
          }
        });
      } else {
        dropInfo.revert();
        this.pendingDropAppointmentId.set(appointmentId);
        this.pendingDropMechanicId.set(mechanicId);
        this.pendingDropMechanicName.set(mechanicName);
        this.conflictSuggestions.set(response.suggestedSlots);
        this.showConflictModal.set(true);
        this.isRescheduling.set(false);
      }
    },
    error: () => {
      dropInfo.revert();
      this.isRescheduling.set(false);
    }
  });
}
```

- [ ] **Step 4: Add conflict modal handler methods**

Add these two methods after `handleEventDrop`:

```typescript
onConflictSlotSelected(slot: AiScheduleSuggestion) {
  this.showConflictModal.set(false);
  const appointmentId = this.pendingDropAppointmentId();
  this.appointmentService.updateAppointment(appointmentId, {
    scheduledDate: new Date(slot.start),
    mechanicId: slot.mechanicId,
  }).subscribe({
    next: () => {
      this.appointmentService.getAppointments().subscribe(appts => {
        this.appointments = appts;
        this.loadEvents();
      });
    },
    error: (err) => console.error('Failed to reschedule:', err)
  });
}

onConflictCancelled() {
  this.showConflictModal.set(false);
  this.conflictSuggestions.set([]);
}
```

- [ ] **Step 5: Verify build passes**

Run: `npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/features/calendar/calendar.component.ts
git commit -m "feat: implement handleEventDrop with AI conflict detection"
```

---

### Task 3: Add conflict modal to calendar template

**Files:**
- Modify: `src/app/features/calendar/calendar.component.html`

- [ ] **Step 1: Add the conflict modal template**

At the end of `calendar.component.html`, after the existing `</app-appointment-modal>` block, add:

```html
<!-- Reschedule Conflict Modal -->
<app-reschedule-conflict-modal
  *ngIf="showConflictModal()"
  [suggestions]="conflictSuggestions()"
  [originalMechanicId]="pendingDropMechanicId()"
  [mechanicName]="pendingDropMechanicName()"
  (slotSelected)="onConflictSlotSelected($event)"
  (cancelled)="onConflictCancelled()">
</app-reschedule-conflict-modal>
```

- [ ] **Step 2: Verify build passes**

Run: `npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/features/calendar/calendar.component.html
git commit -m "feat: wire reschedule conflict modal into calendar template"
```

---

### Task 4: Manual browser test

- [ ] **Step 1: Start dev server**

Run: `npx ng serve --port 4200`

- [ ] **Step 2: Test happy path**

1. Navigate to `http://localhost:4200/calendar`
2. Switch to Week or Day view
3. Drag an appointment to a different time on the same day
4. Verify the event stays at the new position (or shows conflict modal)
5. Check the browser console — no errors, no stale `console.log('Event moved:...')`

- [ ] **Step 3: Test conflict path**

1. Drag an appointment to a time that overlaps with another appointment for the same mechanic
2. Verify the conflict modal appears with "This time slot isn't available"
3. Verify slots are grouped into "same mechanic" and "other mechanics" sections
4. Click a suggested slot — verify the appointment moves to that time
5. Test cancelling — verify the event stays at the original position

- [ ] **Step 4: Test error handling**

1. Stop the backend server
2. Drag an appointment
3. Verify the event reverts to its original position (no crash)

- [ ] **Step 5: Update progress doc**

Add to `docs/MVP_PROGRESS.md` under the UI Polish section:
```
- [x] Calendar drag-and-drop rescheduling — AI-validated with conflict modal showing alternatives
```

- [ ] **Step 6: Final commit**

```bash
git add docs/MVP_PROGRESS.md
git commit -m "feat: calendar drag-drop rescheduling with AI conflict resolution"
```
