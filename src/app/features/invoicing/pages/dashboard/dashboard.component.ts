import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import {
  InvoiceWithDetails,
  InvoiceStatus,
} from '../../../../core/models/invoice.model';
import { QuoteWithDetails } from '../../../../core/models/quote.model';
import { CreditNoteWithDetails } from '../../../../core/models/credit-note.model';

interface AgingBucket {
  key: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  labelKey: string;
  amount: number;
  color: string;
}

interface KpiTile {
  labelKey: string;
  value: string;
  hint?: string;
  sparkline: number[];
  accent: 'orange' | 'indigo' | 'emerald' | 'slate';
}

interface TopCustomer {
  customerId: string;
  customerName: string;
  total: number;
}

/**
 * Invoicing Dashboard — the new home page of `/invoices`.
 *
 * Mirrors the main app dashboard's section structure:
 *   1. Quick action grid
 *   2. Urgent banner (only when overdueCount > 0)
 *   3. KPI row with sparklines
 *   4. Recent invoices + Top customers
 *   5. AR aging mini-chart
 *
 * Data is fanned-out via forkJoin so the page paints once with all
 * its source data ready.
 */
@Component({
  selector: 'app-invoicing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class InvoicingDashboardComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private quoteService = inject(QuoteService);
  private creditNoteService = inject(CreditNoteService);
  private router = inject(Router);

  isLoading = signal(true);
  invoices = signal<InvoiceWithDetails[]>([]);
  quotes = signal<QuoteWithDetails[]>([]);
  creditNotes = signal<CreditNoteWithDetails[]>([]);

  /** Number of overdue invoices used for the urgent banner. */
  overdueCount = computed(
    () => this.invoices().filter((i) => i.status === 'overdue').length,
  );
  /** Total outstanding amount on overdue invoices. */
  overdueAmount = computed(() =>
    this.invoices()
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + (i.remainingAmount || 0), 0),
  );

  /** Recent invoices list — last 5 by issue date. */
  recentInvoices = computed(() =>
    [...this.invoices()]
      .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
      .slice(0, 5),
  );

  /** Top customers by paid revenue in the last 30 days. */
  topCustomers = computed<TopCustomer[]>(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = new Map<string, TopCustomer>();
    for (const inv of this.invoices()) {
      if (inv.issueDate.getTime() < cutoff) continue;
      const existing = totals.get(inv.customerId);
      const paid = inv.paidAmount || 0;
      if (existing) {
        existing.total += paid;
      } else {
        totals.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: inv.customerName || '—',
          total: paid,
        });
      }
    }
    return [...totals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  });

  /** AR aging buckets computed from invoices' remaining amount + dueDate. */
  agingBuckets = computed<AgingBucket[]>(() => {
    const now = Date.now();
    const buckets: AgingBucket[] = [
      { key: 'current', labelKey: 'invoicing.dashboardPage.aging.current', amount: 0, color: '#10b981' },
      { key: '1-30', labelKey: 'invoicing.dashboardPage.aging.b1', amount: 0, color: '#3b82f6' },
      { key: '31-60', labelKey: 'invoicing.dashboardPage.aging.b2', amount: 0, color: '#f59e0b' },
      { key: '61-90', labelKey: 'invoicing.dashboardPage.aging.b3', amount: 0, color: '#fb923c' },
      { key: '90+', labelKey: 'invoicing.dashboardPage.aging.b4', amount: 0, color: '#ef4444' },
    ];
    for (const inv of this.invoices()) {
      if (inv.status === 'paid' || inv.status === 'cancelled') continue;
      const remaining = inv.remainingAmount || 0;
      if (remaining <= 0) continue;
      const dueDate = inv.dueDate.getTime();
      const days = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));
      if (days <= 0) buckets[0].amount += remaining;
      else if (days <= 30) buckets[1].amount += remaining;
      else if (days <= 60) buckets[2].amount += remaining;
      else if (days <= 90) buckets[3].amount += remaining;
      else buckets[4].amount += remaining;
    }
    return buckets;
  });

  totalAging = computed(() =>
    this.agingBuckets().reduce((sum, b) => sum + b.amount, 0),
  );

  /** KPI row tiles. */
  kpiTiles = computed<KpiTile[]>(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = this.invoices()
      .filter((i) => i.issueDate >= monthStart)
      .reduce((sum, i) => sum + (i.paidAmount || 0), 0);

    const outstandingAR = this.invoices()
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + (i.remainingAmount || 0), 0);

    const quotesPending = this.quotes().filter((q) => q.status === 'SENT')
      .length;

    const creditNotesThisMonth = this.creditNotes().filter(
      (c) => c.createdAt >= monthStart,
    ).length;

    // Build a 7-day mini-trend for revenue from invoice issue dates.
    const revenueSpark = this.buildDailySpark(7, (d) =>
      this.invoices()
        .filter((i) => sameDay(i.issueDate, d))
        .reduce((s, i) => s + (i.paidAmount || 0), 0),
    );
    const arSpark = this.buildDailySpark(7, (d) =>
      this.invoices()
        .filter(
          (i) =>
            i.status !== 'paid' &&
            i.status !== 'cancelled' &&
            i.dueDate <= d,
        )
        .reduce((s, i) => s + (i.remainingAmount || 0), 0),
    );
    const quotesSpark = this.buildDailySpark(7, (d) =>
      this.quotes().filter((q) => sameDay(q.issueDate, d)).length,
    );
    const creditSpark = this.buildDailySpark(7, (d) =>
      this.creditNotes().filter((c) => sameDay(c.createdAt, d)).length,
    );

    return [
      {
        labelKey: 'invoicing.dashboardPage.kpi.revenueThisMonth',
        value: this.fmtCurrency(monthRevenue),
        sparkline: revenueSpark,
        accent: 'emerald',
      },
      {
        labelKey: 'invoicing.dashboardPage.kpi.outstandingAr',
        value: this.fmtCurrency(outstandingAR),
        sparkline: arSpark,
        accent: 'orange',
      },
      {
        labelKey: 'invoicing.dashboardPage.kpi.quotesPending',
        value: String(quotesPending),
        sparkline: quotesSpark,
        accent: 'indigo',
      },
      {
        labelKey: 'invoicing.dashboardPage.kpi.creditNotesThisMonth',
        value: String(creditNotesThisMonth),
        sparkline: creditSpark,
        accent: 'slate',
      },
    ];
  });

  ngOnInit(): void {
    forkJoin({
      invoices: this.invoiceService.getInvoices().pipe(catchError(() => of([] as InvoiceWithDetails[]))),
      quotes: this.quoteService.list().pipe(catchError(() => of([] as QuoteWithDetails[]))),
      creditNotes: this.creditNoteService
        .list()
        .pipe(catchError(() => of([] as CreditNoteWithDetails[]))),
    }).subscribe({
      next: ({ invoices, quotes, creditNotes }) => {
        this.invoices.set(invoices);
        this.quotes.set(quotes);
        this.creditNotes.set(creditNotes);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  // --- Navigation handlers (used by quick-action tiles) ---

  navigateNewInvoice(): void {
    this.router.navigate(['/invoices/create']);
  }

  navigateNewQuote(): void {
    this.router.navigate(['/invoices/quotes/new']);
  }

  navigateRecordPayment(): void {
    // No standalone record-payment page yet — open the pending-payments list
    // so the user can pick the invoice they want to record against.
    this.router.navigate(['/invoices/pending']);
  }

  navigateAgingReport(): void {
    this.router.navigate(['/invoices/reports'], {
      fragment: 'ar-aging',
    });
  }

  navigateInvoice(invoiceId: string): void {
    this.router.navigate(['/invoices', invoiceId]);
  }

  navigateOverdueList(): void {
    this.router.navigate(['/invoices/list'], {
      queryParams: { status: 'overdue' },
    });
  }

  // --- View helpers ---

  getStatusBadgeClass(status: InvoiceStatus): string {
    return this.invoiceService.getStatusBadgeClass(status);
  }

  getStatusLabelKey(status: InvoiceStatus): string {
    const map: Record<InvoiceStatus, string> = {
      'draft': 'invoicing.status.draft',
      'sent': 'invoicing.status.sent',
      'viewed': 'invoicing.status.viewed',
      'paid': 'invoicing.status.paid',
      'partially-paid': 'invoicing.status.partiallyPaid',
      'overdue': 'invoicing.status.overdue',
      'cancelled': 'invoicing.status.cancelled',
      'refunded': 'invoicing.status.refunded',
    };
    return map[status];
  }

  fmtCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  /** SVG path builder for the small KPI sparklines (mirrors dashboard.component.ts). */
  buildSparklinePath(
    values: number[],
    width = 100,
    height = 36,
    padding = 2,
  ): { line: string; area: string } {
    const empty = { line: '', area: '' };
    if (!values || values.length < 2) return empty;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerH = height - padding * 2;
    const stepX = width / (values.length - 1);
    const pts: [number, number][] = values.map((v, i) => [
      i * stepX,
      padding + innerH - ((v - min) / range) * innerH,
    ]);
    let line = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      line += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    const area = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;
    return { line, area };
  }

  /** Aging bar segment width in % of the full chart. */
  getAgingPct(bucket: AgingBucket): number {
    const total = this.totalAging();
    return total > 0 ? (bucket.amount / total) * 100 : 0;
  }

  // --- Helpers ---

  private buildDailySpark(
    days: number,
    valueAt: (date: Date) => number,
  ): number[] {
    const out: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(valueAt(d));
    }
    return out;
  }
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
