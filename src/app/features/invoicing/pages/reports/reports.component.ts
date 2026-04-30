import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { ArAgingComponent } from '../../components/ar-aging.component';
import { ZReportComponent } from '../../components/z-report.component';

interface StatementEvent {
  type: 'invoice' | 'payment' | 'creditNote';
  date: string;
  ref: string;
  amount: number;
  runningBalance: number;
  description?: string;
}

interface CustomerStatement {
  customer: { id: string; firstName: string; lastName: string; email?: string | null };
  from: string;
  to: string;
  openingBalance: number;
  items: StatementEvent[];
  closingBalance: number;
}

interface CustomerOption {
  id: string;
  name: string;
}

/**
 * Invoicing reports landing page — embeds the AR aging and Z-report
 * components, exposes the accountant CSV export, and provides an
 * inline customer-statement viewer that hits `/reports/customer-statement`.
 */
@Component({
  selector: 'app-invoicing-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslatePipe,
    ArAgingComponent,
    ZReportComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class InvoicingReportsPageComponent implements OnInit {
  private http = inject(HttpClient);
  private customerService = inject(CustomerService);
  private translation = inject(TranslationService);
  private toast = inject(ToastService);

  /** YYYY-MM in ISO order — used for the accountant export download. */
  readonly currentMonth = new Date().toISOString().slice(0, 7);

  customers = signal<CustomerOption[]>([]);
  selectedCustomerId = signal<string>('');
  fromDate = signal<string>(this.firstOfMonth());
  toDate = signal<string>(new Date().toISOString().split('T')[0]);
  statement = signal<CustomerStatement | null>(null);
  isLoadingStatement = signal(false);

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: (rows: any[]) =>
        this.customers.set(
          rows.map((c) => ({
            id: c.id,
            name: c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
          })),
        ),
    });
  }

  exportUrl(): string {
    return `/reports/accountant-export?month=${this.currentMonth}`;
  }

  generateStatement(): void {
    const cid = this.selectedCustomerId();
    if (!cid) {
      this.toast.warning(
        this.translation.instant('invoicing.reports.customerStatement.errors.selectCustomer'),
      );
      return;
    }
    this.isLoadingStatement.set(true);
    const params = new HttpParams()
      .set('customerId', cid)
      .set('from', this.fromDate())
      .set('to', this.toDate());
    this.http
      .get<CustomerStatement>('/reports/customer-statement', { params })
      .subscribe({
        next: (res) => {
          this.statement.set(res);
          this.isLoadingStatement.set(false);
        },
        error: () => {
          this.isLoadingStatement.set(false);
          this.toast.error(
            this.translation.instant('invoicing.reports.customerStatement.errors.loadFailed'),
          );
        },
      });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : new Intl.DateTimeFormat('fr-TN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(d);
  }

  trackEvent(_: number, e: StatementEvent): string {
    return `${e.type}_${e.ref}_${e.date}`;
  }

  eventLabelKey(type: StatementEvent['type']): string {
    switch (type) {
      case 'invoice':
        return 'invoicing.reports.customerStatement.eventTypes.invoice';
      case 'payment':
        return 'invoicing.reports.customerStatement.eventTypes.payment';
      case 'creditNote':
        return 'invoicing.reports.customerStatement.eventTypes.creditNote';
    }
  }

  private firstOfMonth(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }
}
