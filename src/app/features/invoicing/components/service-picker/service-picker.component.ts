import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * ServicePickerComponent — autocomplete dropdown over the service
 * catalog. Emits `serviceSelected` when the user picks a row so a
 * parent quote/invoice form can pre-fill description, unitPrice,
 * tvaRate, and laborHours.
 *
 * Standalone, signals-based. No external UI library — a focused input
 * with a filtered <ul> dropdown. Caller is expected to provide its own
 * label/wrapper styling via a `<app-service-picker>` host inside an
 * existing form row.
 *
 * Phase 5 wires this into the live forms; for Phase 2 it ships as a
 * reusable building block plus its own unit spec.
 */
@Component({
  selector: 'app-service-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './service-picker.component.html',
  styleUrls: ['./service-picker.component.css'],
})
export class ServicePickerComponent implements OnInit {
  private readonly catalog = inject(ServiceCatalogService);

  /** Emits the chosen catalog row; parent forms pre-fill from this. */
  @Output() serviceSelected = new EventEmitter<ServiceCatalogEntry>();

  // Local UI state — signals-based per project convention.
  readonly query = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly entries = signal<ServiceCatalogEntry[]>([]);
  readonly loading = signal<boolean>(false);

  /** Filtered, active-only result list. */
  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.entries().filter((e) => e.isActive);
    if (!q) return all.slice(0, 25); // arbitrary cap to keep the dropdown short
    return all
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          (e.category ?? '').toLowerCase().includes(q),
      )
      .slice(0, 25);
  });

  ngOnInit(): void {
    // If the cache is already populated, mirror it; otherwise fetch.
    const cached = this.catalog.catalog;
    if (cached.length > 0) {
      this.entries.set(cached);
      return;
    }
    this.loading.set(true);
    this.catalog.loadCatalog().subscribe({
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => {
        // Surface emptiness without crashing the parent form.
        this.entries.set([]);
        this.loading.set(false);
      },
    });
  }

  onInput(value: string): void {
    this.query.set(value);
    this.isOpen.set(true);
  }

  onFocus(): void {
    this.isOpen.set(true);
  }

  onBlur(): void {
    // Slight delay so a click on a result registers before closing.
    setTimeout(() => this.isOpen.set(false), 150);
  }

  pick(entry: ServiceCatalogEntry): void {
    this.query.set(entry.name);
    this.isOpen.set(false);
    this.serviceSelected.emit(entry);
  }
}
