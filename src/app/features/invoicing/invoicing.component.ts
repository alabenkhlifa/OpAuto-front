import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InvoiceService } from '../../core/services/invoice.service';
import { InvoiceWithDetails, InvoiceStats, InvoiceStatus, PaymentMethod } from '../../core/models/invoice.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-invoicing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './invoicing.component.html',
  styleUrl: './invoicing.component.css'
})
export class InvoicingComponent implements OnInit {
  public invoiceService = inject(InvoiceService);
  private router = inject(Router);
  private translationService = inject(TranslationService);

  invoices = signal<InvoiceWithDetails[]>([]);
  stats = signal<InvoiceStats | null>(null);
  isLoading = signal(false);
  
  searchQuery = signal('');
  selectedStatus = signal('all');
  selectedPaymentMethod = signal('all');
  showMobileFilters = signal(false);
  currentView = signal<'dashboard' | 'list' | 'pending'>('dashboard');

  filteredInvoices = computed(() => {
    let filtered = [...this.invoices()];
    
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.customerName.toLowerCase().includes(query) ||
        invoice.licensePlate.toLowerCase().includes(query) ||
        invoice.serviceName?.toLowerCase().includes(query)
      );
    }
    
    if (this.selectedStatus() !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === this.selectedStatus());
    }
    
    if (this.selectedPaymentMethod() !== 'all') {
      filtered = filtered.filter(invoice => invoice.paymentMethod === this.selectedPaymentMethod());
    }
    
    return filtered.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
  });

  recentInvoices = computed(() => this.filteredInvoices().slice(0, 10));
  pendingInvoices = computed(() => this.invoices().filter(inv => ['sent', 'viewed'].includes(inv.status)));
  overdueInvoices = computed(() => this.invoices().filter(inv => inv.status === 'overdue'));

  ngOnInit(): void {
    this.loadData();
    
    // Check route to set initial view
    const url = this.router.url;
    if (url.includes('/pending')) {
      this.setView('pending');
    }
  }

  private loadData(): void {
    this.isLoading.set(true);
    
    this.invoiceService.getInvoices().subscribe({
      next: (invoices) => {
        this.invoices.set(invoices);
      },
      error: (error) => console.error('Failed to load invoices:', error)
    });

    this.invoiceService.getInvoiceStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load stats:', error);
        this.isLoading.set(false);
      }
    });
  }

  setView(view: 'dashboard' | 'list' | 'pending'): void {
    this.currentView.set(view);
  }

  navigateToCreate(): void {
    this.router.navigate(['/invoices/create']);
  }

  navigateToInvoiceDetails(invoiceId: string): void {
    this.router.navigate(['/invoices', invoiceId]);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  onStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus.set(target.value);
  }

  onPaymentMethodChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedPaymentMethod.set(target.value);
  }

  setStatusFilter(status: string): void {
    this.selectedStatus.set(status);
    this.setView('list');
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.set(!this.showMobileFilters());
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStatus.set('all');
    this.selectedPaymentMethod.set('all');
  }

  getStatusColor(status: InvoiceStatus): string {
    return this.invoiceService.getStatusColor(status);
  }

  getStatusBadgeClass(status: InvoiceStatus): string {
    return this.invoiceService.getStatusBadgeClass(status);
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    return this.invoiceService.formatCurrency(amount, currency);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }

  onInvoiceSelect(invoice: InvoiceWithDetails): void {
    this.navigateToInvoiceDetails(invoice.id);
  }

  onMarkAsPaid(invoice: InvoiceWithDetails): void {
    this.invoiceService.addPayment({
      invoiceId: invoice.id,
      amount: invoice.remainingAmount,
      method: 'cash', // Default to cash, should open payment modal
      paymentDate: new Date(),
      processedBy: 'current-user' // TODO: Get from auth service
    }).subscribe({
      next: () => {
        this.loadData(); // Refresh data
      },
      error: (error) => console.error('Failed to mark as paid:', error)
    });
  }

  onSendInvoice(invoice: InvoiceWithDetails): void {
    this.invoiceService.updateInvoice(invoice.id, { status: 'sent' }).subscribe({
      next: () => {
        this.loadData(); // Refresh data
      },
      error: (error) => console.error('Failed to send invoice:', error)
    });
  }

  getAvailableStatuses(): InvoiceStatus[] {
    return ['draft', 'sent', 'viewed', 'paid', 'partially-paid', 'overdue', 'cancelled', 'refunded'];
  }

  getAvailablePaymentMethods(): PaymentMethod[] {
    return ['cash', 'card', 'bank-transfer', 'check', 'credit'];
  }

  getStatusIcon(status: InvoiceStatus): string {
    const icons = {
      'draft': '📝',
      'sent': '📤',
      'viewed': '👀',
      'paid': '✅',
      'partially-paid': '💰',
      'overdue': '⚠️',
      'cancelled': '❌',
      'refunded': '🔄'
    };
    return icons[status] || '📄';
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    const icons = {
      'cash': '💵',
      'card': '💳',
      'bank-transfer': '🏦',
      'check': '📝',
      'credit': '📋'
    };
    return icons[method] || '💰';
  }

  getDaysOverdue(dueDate: Date): number {
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isOverdue(invoice: InvoiceWithDetails): boolean {
    return invoice.status !== 'paid' && new Date() > invoice.dueDate;
  }

  getPaymentProgress(invoice: InvoiceWithDetails): number {
    return invoice.totalAmount > 0 ? (invoice.paidAmount / invoice.totalAmount) * 100 : 0;
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  getStatusLabel(status: InvoiceStatus): string {
    const statusMap: {[key in InvoiceStatus]: string} = {
      'draft': 'draft',
      'sent': 'sent',
      'viewed': 'viewed',
      'paid': 'paid',
      'partially-paid': 'partiallyPaid',
      'overdue': 'overdue',
      'cancelled': 'cancelled',
      'refunded': 'refunded'
    };
    const key = statusMap[status] || 'draft';
    return this.translationService.instant(`invoicing.status.${key}`);
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const methodMap: {[key in PaymentMethod]: string} = {
      'cash': 'cash',
      'card': 'card',
      'bank-transfer': 'bankTransfer',
      'check': 'check',
      'credit': 'credit'
    };
    const key = methodMap[method] || 'cash';
    return this.translationService.instant(`invoicing.paymentMethods.${key}`);
  }
}