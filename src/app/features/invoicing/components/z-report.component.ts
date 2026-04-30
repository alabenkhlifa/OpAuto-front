import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface ZReport {
  date: string;
  invoicesIssued: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paymentsByMethod: Record<string, number>;
  creditNotesIssued: number;
  creditNotesTotal: number;
  netCash: number;
}

/**
 * Phase 3.5 — Daily Z-report.
 *
 * Print-friendly card that summarises one day's cash close. The user
 * picks a date (defaults to today), the component fetches the JSON
 * payload, and a "Print" button delegates to `window.print()` — the
 * card uses generous spacing + black-on-white type so it survives a
 * monochrome printer.
 */
@Component({
  selector: 'app-z-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './z-report.component.html',
  styleUrl: './z-report.component.css',
})
export class ZReportComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(false);
  error = signal<string | null>(null);
  report = signal<ZReport | null>(null);

  date = signal<string>(new Date().toISOString().slice(0, 10));

  // Stable list of payment methods so the table doesn't reshuffle on
  // every refresh. Mirrors the backend Z-report initial state.
  readonly methodKeys = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'MOBILE_PAYMENT'] as const;

  // Derived helper — total of all payments (sanity check vs net cash).
  totalPayments = computed(() => {
    const r = this.report();
    if (!r) return 0;
    return Object.values(r.paymentsByMethod).reduce((a, b) => a + b, 0);
  });

  ngOnInit(): void {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.error.set(null);
    const params = new HttpParams().set('date', this.date());
    this.http.get<ZReport>('/reports/z-report', { params }).subscribe({
      next: (rep) => {
        this.report.set(rep);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load Z-report');
        this.loading.set(false);
      },
    });
  }

  print(): void {
    window.print();
  }

  onDateChange(value: string): void {
    this.date.set(value);
    this.fetch();
  }
}
