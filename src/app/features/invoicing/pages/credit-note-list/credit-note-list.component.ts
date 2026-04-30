import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { CreditNoteWithDetails } from '../../../../core/models/credit-note.model';

@Component({
  selector: 'app-credit-note-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './credit-note-list.component.html',
  styleUrl: './credit-note-list.component.css',
})
export class CreditNoteListPageComponent implements OnInit {
  private creditNoteService = inject(CreditNoteService);
  private invoiceService = inject(InvoiceService);
  private router = inject(Router);

  creditNotes = signal<CreditNoteWithDetails[]>([]);
  isLoading = signal(false);

  ngOnInit(): void {
    this.isLoading.set(true);
    this.creditNoteService.list().subscribe({
      next: (rows) => {
        this.creditNotes.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  navigateNew(): void {
    this.router.navigate(['/invoices/credit-notes/new']);
  }

  navigateInvoice(invoiceId: string): void {
    this.router.navigate(['/invoices', invoiceId]);
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }
}
