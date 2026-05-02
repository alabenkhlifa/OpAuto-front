import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { InvoiceWithDetails } from '../../../../core/models/invoice.model';

@Component({
  selector: 'app-pending-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './pending-list.component.html',
  styleUrl: './pending-list.component.css',
})
export class PendingListPageComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private router = inject(Router);

  invoices = signal<InvoiceWithDetails[]>([]);
  isLoading = signal(false);

  // S-SB-003 — Pending Payment is "all unpaid issued invoices": SENT (incl.
  // VIEWED, which is just SENT after the customer opened the email),
  // PARTIALLY_PAID, OVERDUE. The sidebar Pending-Payment badge counts the
  // same set so the value the user sees in the rail matches this page's
  // row count exactly.
  pendingInvoices = computed(() =>
    this.invoices().filter((i) =>
      ['sent', 'viewed', 'partially-paid', 'overdue'].includes(i.status),
    ),
  );

  ngOnInit(): void {
    this.isLoading.set(true);
    this.invoiceService.getInvoices().subscribe({
      next: (rows) => {
        this.invoices.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }

  isOverdue(invoice: InvoiceWithDetails): boolean {
    return invoice.status !== 'paid' && new Date() > invoice.dueDate;
  }

  getDaysOverdue(dueDate: Date): number {
    return Math.ceil((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  navigateToDetail(invoice: InvoiceWithDetails): void {
    this.router.navigate(['/invoices', invoice.id]);
  }
}
