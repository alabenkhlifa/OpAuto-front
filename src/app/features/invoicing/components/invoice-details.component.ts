import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { InvoiceService } from '../../../core/services/invoice.service';
import { InvoiceWithDetails, Payment, InvoiceSettings } from '../../../core/models/invoice.model';

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-details.component.html',
  styleUrl: './invoice-details.component.css'
})
export class InvoiceDetailsComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private invoiceService = inject(InvoiceService);

  invoice = signal<InvoiceWithDetails | null>(null);
  payments = signal<Payment[]>([]);
  settings = signal<InvoiceSettings | null>(null);
  isLoading = signal(false);
  isPrintMode = signal(false);

  ngOnInit(): void {
    const invoiceId = this.route.snapshot.paramMap.get('id');
    if (invoiceId) {
      this.loadInvoice(invoiceId);
    }
    
    // Check for print mode in query params
    this.route.queryParams.subscribe(params => {
      this.isPrintMode.set(params['print'] === 'true');
    });
  }

  private loadInvoice(invoiceId: string): void {
    this.isLoading.set(true);
    
    const invoice = this.invoiceService.getInvoiceById(invoiceId);
    if (invoice) {
      this.invoice.set(invoice);
      
      // Load payments for this invoice
      this.invoiceService.getPaymentsByInvoice(invoiceId).subscribe({
        next: (payments) => this.payments.set(payments),
        error: (error) => console.error('Failed to load payments:', error)
      });
    }

    // Load settings for garage info
    this.invoiceService.getInvoiceSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load settings:', error);
        this.isLoading.set(false);
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/invoices']);
  }

  onEdit(): void {
    const invoiceId = this.invoice()?.id;
    if (invoiceId) {
      this.router.navigate(['/invoices/edit', invoiceId]);
    }
  }

  onPrint(): void {
    window.print();
  }

  onSendInvoice(): void {
    const invoice = this.invoice();
    if (invoice) {
      this.invoiceService.updateInvoice(invoice.id, { status: 'sent' }).subscribe({
        next: (updatedInvoice) => {
          this.invoice.set(updatedInvoice);
        },
        error: (error) => console.error('Failed to send invoice:', error)
      });
    }
  }

  onMarkAsPaid(): void {
    const invoice = this.invoice();
    if (invoice && invoice.remainingAmount > 0) {
      this.invoiceService.addPayment({
        invoiceId: invoice.id,
        amount: invoice.remainingAmount,
        method: 'cash', // Default, should open payment modal
        paymentDate: new Date(),
        processedBy: 'current-user' // TODO: Get from auth service
      }).subscribe({
        next: () => {
          this.loadInvoice(invoice.id); // Refresh invoice data
        },
        error: (error) => console.error('Failed to record payment:', error)
      });
    }
  }

  getStatusColor(status: string): string {
    return this.invoiceService.getStatusColor(status as any);
  }

  getStatusBadgeClass(status: string): string {
    return this.invoiceService.getStatusBadgeClass(status as any);
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    return this.invoiceService.formatCurrency(amount, currency);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getPaymentMethodIcon(method: string): string {
    const icons = {
      'cash': '💵',
      'card': '💳',
      'bank-transfer': '🏦',
      'check': '📝',
      'credit': '📋'
    };
    return icons[method as keyof typeof icons] || '💰';
  }

  isOverdue(): boolean {
    const invoice = this.invoice();
    return invoice ? invoice.status !== 'paid' && new Date() > invoice.dueDate : false;
  }

  getDaysOverdue(): number {
    const invoice = this.invoice();
    if (!invoice || !this.isOverdue()) return 0;
    
    const today = new Date();
    const diffTime = today.getTime() - invoice.dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getPaymentProgress(): number {
    const invoice = this.invoice();
    return invoice && invoice.totalAmount > 0 ? (invoice.paidAmount / invoice.totalAmount) * 100 : 0;
  }
}