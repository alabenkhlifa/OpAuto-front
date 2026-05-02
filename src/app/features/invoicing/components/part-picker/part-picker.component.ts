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
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PartService } from '../../../../core/services/part.service';
import { PartWithStock } from '../../../../core/models/part.model';

/**
 * PartPickerComponent — autocomplete dropdown over the parts inventory.
 *
 * BUG-096 (Sweep C-18): switched from "fetch full inventory + client
 * filter" to **debounced server-side search**. Each input change feeds
 * a Subject that debounces 300ms then `switchMap`s to
 * `partService.searchPartsServer(term, 25)` — `switchMap` cancels any
 * in-flight request when the user keeps typing.
 *
 * Mirrors the shape of the existing ServicePickerComponent but adds a
 * per-row stock badge ("12 in stock") so the user can see availability
 * before adding the line. Out-of-stock rows are still selectable; the
 * parent form is expected to flag the line in red when requested
 * quantity > available stock.
 */
@Component({
  selector: 'app-part-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './part-picker.component.html',
  styleUrl: './part-picker.component.css',
})
export class PartPickerComponent implements OnInit {
  private readonly partService = inject(PartService);
  private readonly destroyRef = inject(DestroyRef);

  /** Emits the chosen part row; parent forms pre-fill from this. */
  @Output() partSelected = new EventEmitter<PartWithStock>();

  readonly query = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly results = signal<PartWithStock[]>([]);
  readonly loading = signal<boolean>(false);

  private readonly searchTerm$ = new Subject<string>();

  ngOnInit(): void {
    this.searchTerm$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.loading.set(true);
          return this.partService.searchPartsServer(term, 25);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => {
          // Defence in depth — backend already returns active rows only,
          // but a future ?includeInactive=true caller shouldn't leak into
          // the picker.
          this.results.set(rows.filter((r) => r.isActive));
          this.loading.set(false);
        },
        error: () => {
          this.results.set([]);
          this.loading.set(false);
        },
      });

    // Prime the dropdown with the first 25 rows so cold focus shows
    // something immediately.
    this.searchTerm$.next('');
  }

  onInput(value: string): void {
    this.query.set(value);
    this.isOpen.set(true);
    this.searchTerm$.next(value);
  }

  onFocus(): void {
    this.isOpen.set(true);
    this.searchTerm$.next(this.query());
  }

  onBlur(): void {
    setTimeout(() => this.isOpen.set(false), 150);
  }

  pick(entry: PartWithStock): void {
    this.query.set(entry.name);
    this.isOpen.set(false);
    this.partSelected.emit(entry);
  }

  isOutOfStock(p: PartWithStock): boolean {
    return p.stockLevel <= 0;
  }

  isLowStock(p: PartWithStock): boolean {
    return p.stockLevel > 0 && p.stockLevel <= p.minStockLevel;
  }
}
