import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * ServicePickerComponent — autocomplete dropdown over the service
 * catalog. Emits `serviceSelected` when the user picks a row so a
 * parent quote/invoice form can pre-fill description, unitPrice,
 * tvaRate, and laborHours.
 *
 * BUG-096 (Sweep C-18): switched from "fetch full catalog + client
 * filter" to **debounced server-side search**. Each input change feeds
 * a Subject that debounces 300ms then `switchMap`s to
 * `catalog.searchCatalog(term, 25)` — `switchMap` cancels any in-flight
 * request when the user keeps typing. Initial focus issues an empty
 * search so the dropdown has rows on first open.
 *
 * Standalone, signals-based. No external UI library — a focused input
 * with a result <ul> dropdown.
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
  private readonly destroyRef = inject(DestroyRef);

  /** Emits the chosen catalog row; parent forms pre-fill from this. */
  @Output() serviceSelected = new EventEmitter<ServiceCatalogEntry>();

  // Local UI state — signals-based per project convention.
  readonly query = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly results = signal<ServiceCatalogEntry[]>([]);
  readonly loading = signal<boolean>(false);

  /**
   * Debounce gate for keystrokes. Each `next()` cancels any in-flight
   * HTTP via `switchMap`. 300ms matches the BUG-096 suggestion and is
   * snappy enough to feel live.
   */
  private readonly searchTerm$ = new Subject<string>();

  ngOnInit(): void {
    this.searchTerm$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.loading.set(true);
          return this.catalog.searchCatalog(term, 25);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => {
          // Filter inactive on the client too — defence in depth, since
          // the BE default already excludes inactive but a future
          // include-inactive call shouldn't bleed into the picker UI.
          this.results.set(rows.filter((r) => r.isActive));
          this.loading.set(false);
        },
        error: () => {
          this.results.set([]);
          this.loading.set(false);
        },
      });

    // Prime the dropdown with the first 25 active entries so cold focus
    // shows something immediately.
    this.searchTerm$.next('');
  }

  onInput(value: string): void {
    this.query.set(value);
    this.isOpen.set(true);
    this.searchTerm$.next(value);
  }

  onFocus(): void {
    this.isOpen.set(true);
    // Re-issue the current query so the dropdown reflects the latest
    // catalog (handy if the user just edited a service in another tab).
    this.searchTerm$.next(this.query());
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
