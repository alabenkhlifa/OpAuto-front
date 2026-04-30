import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

Chart.register(...registerables);

interface ArAgingRow {
  customerId: string;
  customerName: string;
  current: number;
  b1_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
}

interface ArAgingReport {
  asOf: string;
  totals: Omit<ArAgingRow, 'customerId' | 'customerName'>;
  rows: ArAgingRow[];
}

/**
 * Phase 3.3 — AR Aging dashboard.
 *
 * Renders the receivables-aging report as a horizontal stacked bar
 * chart (one bar per customer, segments coloured by bucket) with a
 * table fallback for accessibility / screen readers / RTL printout.
 *
 * Bucket palette intentionally walks from cool→warm: current is the
 * neutral grey, then yellow→orange→red as overdue intensifies.
 *
 * Routes are not wired here — Phase 5 owns the `/invoices/reports/...`
 * shell. This component is registered standalone so it can be embedded
 * in a future page or invoked via lazy loading.
 */
@Component({
  selector: 'app-ar-aging',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, TranslatePipe],
  templateUrl: './ar-aging.component.html',
  styleUrl: './ar-aging.component.css',
})
export class ArAgingComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  error = signal<string | null>(null);
  report = signal<ArAgingReport | null>(null);

  // Stacked bar palette — keep in sync with the bucket order in
  // `chartData`. We expose them as a public field so the table can
  // colour the bucket header dot using the same hue.
  readonly bucketColors = {
    current: '#7B8CC4', // Vista Bleu — neutral, not overdue
    b1_30: '#FACC15', // amber-300
    b31_60: '#FB923C', // orange-400
    b61_90: '#F97316', // orange-500 — OpAuto-ish
    b90_plus: '#DC2626', // red-600
  } as const;

  /**
   * Chart.js stacked horizontal bar config — one dataset per bucket,
   * one label per customer. Computed from `report()` so the chart
   * re-renders whenever the report signal updates.
   */
  chartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const rep = this.report();
    if (!rep) return { labels: [], datasets: [] };
    return {
      labels: rep.rows.map((r) => r.customerName),
      datasets: [
        {
          label: 'current',
          data: rep.rows.map((r) => r.current),
          backgroundColor: this.bucketColors.current,
        },
        {
          label: '1-30',
          data: rep.rows.map((r) => r.b1_30),
          backgroundColor: this.bucketColors.b1_30,
        },
        {
          label: '31-60',
          data: rep.rows.map((r) => r.b31_60),
          backgroundColor: this.bucketColors.b31_60,
        },
        {
          label: '61-90',
          data: rep.rows.map((r) => r.b61_90),
          backgroundColor: this.bucketColors.b61_90,
        },
        {
          label: '90+',
          data: rep.rows.map((r) => r.b90_plus),
          backgroundColor: this.bucketColors.b90_plus,
        },
      ],
    };
  });

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, beginAtZero: true },
      y: { stacked: true },
    },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { mode: 'index' },
    },
  };

  ngOnInit(): void {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<ArAgingReport>('/reports/ar-aging').subscribe({
      next: (rep) => {
        this.report.set(rep);
        this.loading.set(false);
      },
      // We intentionally surface the raw error string — the page-level
      // shell that wraps this component is responsible for showing a
      // toast/banner; we just expose enough state for an empty card.
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load AR aging');
        this.loading.set(false);
      },
    });
  }

  /**
   * CSV download — opens the same endpoint with `?format=csv`. We use
   * a plain anchor click rather than HttpClient because the browser
   * needs to honour the Content-Disposition header.
   */
  exportCsv(): void {
    const a = document.createElement('a');
    a.href = '/api/reports/ar-aging?format=csv';
    a.download = `ar-aging-${this.report()?.asOf ?? 'today'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
