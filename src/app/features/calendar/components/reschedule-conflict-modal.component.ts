import { Component, Input, Output, EventEmitter, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiScheduleSuggestion } from '../../../core/models/ai.model';
import { TranslationService } from '../../../core/services/translation.service';

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
          @if (sameMechanicSlots().length > 0) {
            <div class="slot-section">
              <h3 class="section-label">Available times for {{ mechanicName }}</h3>
              <div class="slot-list">
                @for (slot of sameMechanicSlots(); track slot.start) {
                  <button class="slot-card" [class.has-warning]="slot.warning" (click)="onSlotClick(slot)">
                    @if (slot.warning) {
                      <div class="slot-warning">⚠ {{ t('calendar.toast.duringLunchBreak') }}</div>
                    }
                    <div class="slot-time">{{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}</div>
                    <div class="slot-meta">{{ slot.reason }}</div>
                  </button>
                }
              </div>
            </div>
          }

          @if (otherMechanicSlots().length > 0) {
            <div class="slot-section">
              <h3 class="section-label">Available with other mechanics</h3>
              <div class="slot-list">
                @for (slot of otherMechanicSlots(); track slot.start) {
                  <button class="slot-card" [class.has-warning]="slot.warning" (click)="onSlotClick(slot)">
                    @if (slot.warning) {
                      <div class="slot-warning">⚠ {{ t('calendar.toast.duringLunchBreak') }}</div>
                    }
                    <div class="slot-time">{{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}</div>
                    <div class="slot-mechanic">{{ slot.mechanicName }}</div>
                    <div class="slot-meta">{{ slot.reason }}</div>
                  </button>
                }
              </div>
            </div>
          }

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
    .slot-card.has-warning { background: #fffbeb; border-color: #fde68a; }
    .slot-card.has-warning:hover { background: #fef3c7; border-color: #fbbf24; }
    .slot-warning {
      font-size: 0.7rem; font-weight: 600; color: #b45309; background: #fef3c7;
      padding: 0.15rem 0.5rem; border-radius: 6px; display: inline-block; margin-bottom: 0.25rem;
    }
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

  private translationService = inject(TranslationService);

  onSlotClick(slot: AiScheduleSuggestion) {
    if (slot.warning) {
      const msg = this.t('calendar.toast.lunchBreakConfirm').replace('{{name}}', slot.mechanicName);
      if (!confirm(msg)) return;
    }
    this.slotSelected.emit(slot);
  }

  t(key: string): string {
    return this.translationService.instant(key);
  }

  formatTime(iso: string): string {
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
}
