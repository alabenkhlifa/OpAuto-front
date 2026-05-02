import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
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
  private translation = inject(TranslationService);
  private toast = inject(ToastService);
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

  /**
   * S-PDF-005 — open the credit-note PDF in a new tab. Mirrors the
   * invoice-detail / quote-detail `previewPdf` pattern: the blob path
   * carries the JWT via the HTTP interceptor (an SPA-relative `<a href>`
   * would 401 in a fresh tab).
   */
  previewPdf(cn: CreditNoteWithDetails): void {
    this.fetchPdfBlob(cn, (blob) => {
      window.open(URL.createObjectURL(blob), '_blank');
    });
  }

  /** S-PDF-005 — download the credit-note PDF with the fiscal number as filename. */
  downloadPdf(cn: CreditNoteWithDetails): void {
    this.fetchPdfBlob(cn, (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credit-note-${cn.creditNoteNumber || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  private fetchPdfBlob(
    cn: CreditNoteWithDetails,
    handler: (blob: Blob) => void,
  ): void {
    this.creditNoteService.getCreditNotePdfBlob(cn.id).subscribe({
      next: handler,
      error: () =>
        this.toast.error(
          this.translation.instant('invoicing.creditNotes.list.pdfFailed'),
        ),
    });
  }

  trackCn(_: number, cn: CreditNoteWithDetails): string {
    return cn.id;
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }
}
