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
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PartService } from '../../../../core/services/part.service';
import { PartWithStock } from '../../../../core/models/part.model';

/**
 * PartPickerComponent — autocomplete dropdown over the parts inventory.
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

  /** Emits the chosen part row; parent forms pre-fill from this. */
  @Output() partSelected = new EventEmitter<PartWithStock>();

  readonly query = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly entries = signal<PartWithStock[]>([]);
  readonly loading = signal<boolean>(false);

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.entries().filter((e) => e.isActive);
    if (!q) return all.slice(0, 25);
    return all
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.partNumber.toLowerCase().includes(q) ||
          (e.brand ?? '').toLowerCase().includes(q),
      )
      .slice(0, 25);
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.partService.getParts().subscribe({
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => {
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
