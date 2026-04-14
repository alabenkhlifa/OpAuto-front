# Calendar Drag-and-Drop Rescheduling

## Problem
`handleEventDrop` in the calendar component is a stub. Dragging appointments does nothing. Users expect drag-and-drop to actually reschedule, with smart conflict handling.

## Solution
When a user drags an appointment to a new time:
1. Optimistically snap the event to the new position
2. Call the existing AI suggestion endpoint to validate availability
3. If available: persist the change silently
4. If conflict: revert the event and show a modal with alternative slots

## Flow

### Happy Path (no conflict)
1. User drags event to new time slot
2. Event snaps to new position (optimistic)
3. `AiService.suggestSchedule()` is called with: dropped time as `preferredDate`, current `mechanicId`, appointment's `serviceType` and `estimatedDuration`
4. Backend returns a slot matching the exact drop time with the same mechanic (score >= 0.9)
5. `AppointmentService.updateAppointment()` persists the new `scheduledDate`
6. Calendar refreshes from updated data

### Conflict Path
1. User drags event to new time slot
2. Event snaps optimistically
3. `AiService.suggestSchedule()` is called (same params)
4. Backend returns no exact match or low-score match for the dropped time
5. Event reverts to original position (`dropInfo.revert()`)
6. **Reschedule Conflict Modal** opens showing:
   - Header: "This time slot isn't available"
   - Section 1: "Available times for [Mechanic Name]" -- slots with same mechanic
   - Section 2: "Available with other mechanics" -- remaining slots
   - Each slot: time range, mechanic name, reason/score
   - Cancel button (dismisses, no change)
7. User picks a slot -> `updateAppointment()` persists, calendar refreshes
8. User cancels -> nothing happens, event stays at original position

## Components

### RescheduleConflictModalComponent (new)
- Location: `src/app/features/calendar/components/reschedule-conflict-modal.component.ts`
- Standalone component
- Inputs: `suggestions: AiScheduleSuggestion[]`, `originalMechanicId: string`, `mechanicName: string`
- Outputs: `slotSelected: AiScheduleSuggestion`, `cancelled: void`
- Splits suggestions into "same mechanic" and "other mechanics" sections
- Light theme modal (white bg, orange accents, matches existing modal pattern)

### CalendarComponent changes
- Inject `AiService` and `LanguageService`
- Import `RescheduleConflictModalComponent`
- Add signals: `showConflictModal`, `conflictSuggestions`, `pendingDropAppointmentId`, `pendingDropMechanicId`, `pendingDropMechanicName`
- Implement `handleEventDrop()`:
  - Extract appointment data from `dropInfo.event.extendedProps`
  - Call `aiService.suggestSchedule()` with drop target time
  - On success: check if exact slot available, update or show modal
  - On error: revert, show error toast
- Add `onConflictSlotSelected(slot)`: calls `updateAppointment` + reloads
- Add `onConflictCancelled()`: clears modal state

## Data Reuse
- `AiService.suggestSchedule()` -- existing, no changes needed
- `AiScheduleRequest`, `AiScheduleResponse`, `AiScheduleSuggestion` models -- existing
- `AppointmentService.updateAppointment()` -- existing
- `CalendarService.mapAppointmentsToEvents()` -- existing, used for refresh

## Conflict Detection Logic
```
const droppedTime = dropInfo.event.start
const mechanicId = dropInfo.event.extendedProps.mechanicId
const serviceType = dropInfo.event.extendedProps.type
const duration = (dropInfo.event.end - dropInfo.event.start) / 60000

Call suggestSchedule({ appointmentType: serviceType, estimatedDuration: duration, preferredDate: droppedTime, mechanicId })

Response slots -> find one where:
  - mechanicId matches
  - start time matches dropped time (within 5 min tolerance)
  - score >= 0.9

If found -> updateAppointment with new scheduledDate
If not found -> revert + show conflict modal with all returned slots
```

## Error Handling
- AI service unavailable: revert event, show error toast "Unable to validate. Try again."
- Update fails: revert event, show error toast
- No suggestions returned at all: revert event, show modal with "No available slots found" message

## Testing
- Unit test: `handleEventDrop` calls AI service with correct params
- Unit test: exact match detection logic
- Unit test: conflict modal splits suggestions by mechanic correctly
- Unit test: slot selection triggers updateAppointment
- Integration: full drag -> validate -> update flow
