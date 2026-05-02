import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../shared/services/toast.service';

import { InvoiceService } from '../../../core/services/invoice.service';
import { CreditNoteService } from '../../../core/services/credit-note.service';
import { GarageSettingsService } from '../../../core/services/garage-settings.service';
import { AuthService } from '../../../core/services/auth.service';

import {
  InvoiceWithDetails,
  Payment,
} from '../../../core/models/invoice.model';
import { GarageSettings } from '../../../core/models/garage-settings.model';
import { CreditNoteWithDetails } from '../../../core/models/credit-note.model';
import { UserRole } from '../../../core/models/auth.model';

import {
  PaymentModalComponent,
  PaymentModalContext,
  PaymentModalResult,
} from './payment-modal/payment-modal.component';
import {
  SendInvoiceModalComponent,
  SendInvoiceContext,
  SendInvoicePayload,
} from './send-invoice-modal/send-invoice-modal.component';

interface TimelineEvent {
  key: string;
  iconKey: 'created' | 'issued' | 'viewed' | 'payment' | 'creditNote';
  titleKey: string;
  titleParams?: Record<string, unknown>;
  subtitle?: string;
  timestamp: Date;
}

/**
 * Invoice details rebuild — Task 5.4.
 *
 * Sticky header with status-aware action set, two-column body
 * (invoice content + activity panel), payment progress ring, timeline
 * of events (created / issued / viewed / payments / credit notes), and
 * print-friendly stylesheet that strips the chrome on `window.print()`.
 */
@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    RouterLink,
    PaymentModalComponent,
    SendInvoiceModalComponent,
  ],
  templateUrl: './invoice-details.component.html',
  styleUrl: './invoice-details.component.css',
})
export class InvoiceDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invoiceService = inject(InvoiceService);
  private readonly creditNoteService = inject(CreditNoteService);
  private readonly garageSettings = inject(GarageSettingsService);
  private readonly authService = inject(AuthService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);

  readonly invoice = signal<InvoiceWithDetails | null>(null);
  readonly settings = signal<GarageSettings | null>(null);
  readonly creditNotes = signal<CreditNoteWithDetails[]>([]);
  readonly isLoading = signal(false);

  // Modals
  readonly paymentModalOpen = signal(false);
  readonly paymentSubmitting = signal(false);
  /**
   * Monotonic key bumped on every `openPaymentModal()` call. Passed to the
   * payment modal so that each open is treated as a fresh intent — fixes
   * the PARTIALLY_PAID reopen case where re-binding `isOpen` alone wasn't
   * enough to retrigger ngOnChanges-driven form reset under OnPush.
   */
  readonly paymentModalOpenKey = signal(0);
  readonly sendModalOpen = signal(false);
  readonly sendSubmitting = signal(false);

  readonly isOwner = computed(() => this.authService.isOwner());

  readonly isLocked = computed(() => {
    const inv = this.invoice();
    return !!inv && inv.status !== 'draft';
  });

  readonly progressPct = computed(() => {
    const inv = this.invoice();
    if (!inv || !inv.totalAmount) return 0;
    return Math.min(100, Math.max(0, (inv.paidAmount / inv.totalAmount) * 100));
  });

  /** SVG circumference: 2π × r where r = 36. */
  readonly ringCircumference = 2 * Math.PI * 36;
  readonly ringDashOffset = computed(
    () => this.ringCircumference * (1 - this.progressPct() / 100),
  );

  readonly tvaBreakdown = computed(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const map = new Map<number, { base: number; tva: number }>();
    for (const li of inv.lineItems) {
      const rate = (li as any).tvaRate ?? inv.taxRate ?? 0;
      const gross = li.quantity * li.unitPrice;
      const lineDiscount = ((li.discountPercentage || 0) * gross) / 100;
      const base = gross - lineDiscount;
      const cur = map.get(rate) ?? { base: 0, tva: 0 };
      cur.base += base;
      cur.tva += (base * rate) / 100;
      map.set(rate, cur);
    }
    return Array.from(map.entries())
      .filter(([, v]) => v.base !== 0)
      .map(([rate, v]) => ({ rate, base: v.base, tva: v.tva }))
      .sort((a, b) => a.rate - b.rate);
  });

  readonly fiscalStamp = computed(() =>
    this.settings()?.fiscalSettings?.fiscalStampEnabled ? 1 : 0,
  );

  readonly timeline = computed<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    const inv = this.invoice();
    if (!inv) return events;

    events.push({
      key: 'created',
      iconKey: 'created',
      titleKey: 'invoicing.detail.timeline.created',
      subtitle: inv.createdBy
        ? this.translation.instant('invoicing.detail.timeline.byUser', { user: inv.createdBy })
        : undefined,
      timestamp: inv.createdAt,
    });

    const lockedAt = (inv as any).lockedAt as string | Date | undefined;
    if (lockedAt) {
      events.push({
        key: 'issued',
        iconKey: 'issued',
        titleKey: 'invoicing.detail.timeline.issued',
        subtitle: (inv as any).lockedBy
          ? this.translation.instant('invoicing.detail.timeline.byUser', {
              user: (inv as any).lockedBy,
            })
          : undefined,
        timestamp: new Date(lockedAt),
      });
    } else if (inv.status !== 'draft') {
      events.push({
        key: 'issued',
        iconKey: 'issued',
        titleKey: 'invoicing.detail.timeline.issued',
        timestamp: inv.updatedAt,
      });
    }

    if (
      inv.status === 'viewed' ||
      inv.status === 'paid' ||
      inv.status === 'partially-paid'
    ) {
      const viewedAt = (inv as any).viewedAt as string | Date | undefined;
      events.push({
        key: 'viewed',
        iconKey: 'viewed',
        titleKey: 'invoicing.detail.timeline.viewedByCustomer',
        timestamp: viewedAt ? new Date(viewedAt) : inv.updatedAt,
      });
    }

    for (const p of inv.paymentHistory ?? []) {
      events.push({
        key: 'payment_' + p.id,
        iconKey: 'payment',
        titleKey: 'invoicing.detail.timeline.paymentRecorded',
        titleParams: {
          amount: this.invoiceService.formatCurrency(p.amount),
          method: this.translation.instant('invoicing.paymentMethods.' + this.methodKey(p.method)),
        },
        subtitle: p.reference || undefined,
        timestamp: p.paymentDate,
      });
    }

    for (const cn of this.creditNotes()) {
      events.push({
        key: 'creditNote_' + cn.id,
        iconKey: 'creditNote',
        titleKey: 'invoicing.detail.timeline.creditNoteIssued',
        titleParams: { number: cn.creditNoteNumber },
        subtitle: cn.reason || undefined,
        timestamp: cn.createdAt,
      });
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.refresh(id);
  }

  /** Refresh invoice + settings + credit notes. Called from focus + after actions. */
  refresh(invoiceId?: string): void {
    const id = invoiceId ?? this.invoice()?.id;
    if (!id) return;
    this.isLoading.set(true);

    forkJoin({
      invoice: this.invoiceService.fetchInvoiceById(id),
      settings: this.garageSettings.getSettings().pipe(catchError(() => of(null as GarageSettings | null))),
      creditNotes: this.creditNoteService.list().pipe(
        catchError(() => of([] as CreditNoteWithDetails[])),
      ),
    }).subscribe({
      next: ({ invoice, settings, creditNotes }) => {
        this.invoice.set(invoice);
        this.settings.set(settings);
        this.creditNotes.set(creditNotes.filter((cn) => cn.invoiceId === id));
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error(this.translation.instant('invoicing.detail.errors.loadFailed'));
        this.isLoading.set(false);
      },
    });
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    // Refresh quietly so payment / credit note updates from another tab show up.
    if (this.invoice()) this.refresh();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onEdit(): void {
    const inv = this.invoice();
    if (inv) this.router.navigate(['/invoices/edit', inv.id]);
  }

  onDelete(): void {
    const inv = this.invoice();
    if (!inv) return;
    // Confirm before deleting. The backend permits DELETE only on DRAFT
    // invoices (returns HTTP 400 once issued); the button is hidden on
    // non-DRAFT, but we still guard with a confirm prompt to avoid
    // accidental loss of in-progress drafts.
    const confirmMsg = this.translation.instant('invoicing.detail.confirmDelete');
    if (!window.confirm(confirmMsg)) return;
    this.invoiceService.deleteInvoice(inv.id).subscribe({
      next: () => {
        this.toast.success(this.translation.instant('invoicing.detail.toast.deleted'));
        this.router.navigate(['/invoices']);
      },
      error: (err: HttpErrorResponse) => {
        // 423 (locked) and 400 (cancel/delete-after-issue) both indicate
        // the fiscal lock guardrail — surface the specific guidance
        // instead of the generic "Could not delete invoice" error.
        const key =
          err?.status === 423 || err?.status === 400
            ? 'invoicing.detail.errors.deleteLocked'
            : 'invoicing.detail.errors.deleteFailed';
        this.toast.error(this.translation.instant(key));
      },
    });
  }

  /**
   * Cancel a DRAFT invoice → CANCELLED (terminal state).
   * Mirrors the delete-confirm pattern: window.confirm() guard + i18n
   * keys + status-specific error mapping. The BE rejects cancel on
   * non-DRAFT with HTTP 400 (must use a credit note instead); the UI
   * additionally hides the button via canShow('cancel') so 400 should
   * only be reachable via concurrent state changes.
   */
  onCancel(): void {
    const inv = this.invoice();
    if (!inv) return;
    const confirmMsg = this.translation.instant('invoicing.detail.confirmCancel');
    if (!window.confirm(confirmMsg)) return;
    this.invoiceService
      .updateInvoice(inv.id, { status: 'cancelled' })
      .subscribe({
        next: (updated) => {
          // PUT returns the full updated invoice via mapFromBackend;
          // setting the signal directly is enough to flip the action
          // bar (Edit / Issue & Send / Cancel disappear, Print /
          // Download remain). We do NOT call refresh() here because the
          // PUT already returned the canonical post-cancel state.
          this.invoice.set(updated);
          this.toast.success(this.translation.instant('invoicing.detail.toast.cancelled'));
        },
        error: (err: HttpErrorResponse) => {
          // 400 — BE state-machine rejection (e.g. raced with payment /
          // issue). 423 — locked guardrail. Both mean "you can't cancel
          // from the current status; issue a credit note instead".
          const key =
            err?.status === 423 || err?.status === 400
              ? 'invoicing.detail.errors.cancelLocked'
              : 'invoicing.detail.errors.cancelFailed';
          this.toast.error(this.translation.instant(key));
        },
      });
  }

  onIssueAndSend(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.invoiceService.issueInvoice(inv.id).subscribe({
      next: (issued) => {
        this.invoice.set(issued);
        this.openSendModal();
      },
      error: () =>
        this.toast.error(this.translation.instant('invoicing.detail.errors.issueFailed')),
    });
  }

  openSendModal(): void {
    this.sendModalOpen.set(true);
  }

  onSendModalClose(): void {
    this.sendModalOpen.set(false);
  }

  onSendModalSubmit(payload: SendInvoicePayload): void {
    const inv = this.invoice();
    if (!inv) return;
    this.sendSubmitting.set(true);
    this.invoiceService.deliverInvoice(inv.id, payload).subscribe({
      next: () => {
        this.sendSubmitting.set(false);
        this.sendModalOpen.set(false);
        this.toast.success(this.translation.instant('invoicing.detail.toast.sent'));
        this.refresh();
      },
      error: () => {
        this.sendSubmitting.set(false);
        this.toast.error(this.translation.instant('invoicing.detail.errors.sendFailed'));
      },
    });
  }

  openPaymentModal(): void {
    // Bump the key BEFORE flipping `isOpen` so the modal sees both changes
    // in the same CD tick when reopening (fixes the partially-paid reopen
    // path where the previous close had already settled state).
    this.paymentModalOpenKey.update((k) => k + 1);
    this.paymentModalOpen.set(true);
  }

  onPaymentModalClose(): void {
    this.paymentModalOpen.set(false);
  }

  onPaymentModalSubmit(payload: PaymentModalResult): void {
    const inv = this.invoice();
    if (!inv) return;
    this.paymentSubmitting.set(true);
    this.invoiceService
      .addPayment({
        invoiceId: inv.id,
        amount: payload.amount,
        method: payload.method,
        paymentDate: new Date(payload.paymentDate),
        reference: payload.reference,
        notes: payload.notes,
        processedBy: this.authService.getCurrentUser()?.id || 'current-user',
      })
      .subscribe({
        next: () => {
          this.paymentSubmitting.set(false);
          this.paymentModalOpen.set(false);
          this.toast.success(this.translation.instant('invoicing.detail.toast.paymentRecorded'));
          this.refresh();
        },
        error: () => {
          this.paymentSubmitting.set(false);
          this.toast.error(this.translation.instant('invoicing.detail.errors.paymentFailed'));
        },
      });
  }

  onPrint(): void {
    window.print();
  }

  onIssueCreditNote(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.router.navigate(['/invoices/credit-notes/new'], {
      queryParams: { invoiceId: inv.id },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  pdfDownloadName(): string {
    const inv = this.invoice();
    return `invoice-${inv?.invoiceNumber || 'document'}.pdf`;
  }

  /**
   * Fetches the PDF as a blob (carries JWT via the interceptor) and either
   * downloads it or opens it in a new tab via `URL.createObjectURL`. This
   * replaces the previous `<a [href]="pdfUrl()" target="_blank">` pattern,
   * which built an SPA-relative URL and 401'd in a fresh tab.
   */
  onPreviewPdf(): void {
    this.fetchPdfBlob((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  }

  onDownloadPdf(): void {
    this.fetchPdfBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.pdfDownloadName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  private fetchPdfBlob(handler: (blob: Blob) => void): void {
    const inv = this.invoice();
    if (!inv) return;
    this.invoiceService.getInvoicePdfBlob(inv.id).subscribe({
      next: handler,
      error: () =>
        this.toast.error(this.translation.instant('invoicing.detail.errors.pdfFailed')),
    });
  }

  paymentContext(): PaymentModalContext | null {
    const inv = this.invoice();
    if (!inv) return null;
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      remainingAmount: inv.remainingAmount,
      currency: inv.currency,
    };
  }

  sendContext(): SendInvoiceContext | null {
    const inv = this.invoice();
    if (!inv) return null;
    return {
      documentId: inv.id,
      documentNumber: inv.invoiceNumber,
      documentKindLabelKey: 'invoicing.send.kindInvoice',
      customerEmail: inv.customerEmail ?? null,
      customerPhone: inv.customerPhone ?? null,
    };
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(date: Date | undefined): string {
    return date ? this.invoiceService.formatDate(date) : '';
  }

  formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  statusBadgeClass(status: string): string {
    return this.invoiceService.getStatusBadgeClass(status as any);
  }

  /** Map kebab-case invoice status to camelCase translation suffix used in `invoicing.status.*`. */
  statusLabelKey(status: string): string {
    const map: Record<string, string> = {
      'draft': 'invoicing.status.draft',
      'sent': 'invoicing.status.sent',
      'viewed': 'invoicing.status.viewed',
      'paid': 'invoicing.status.paid',
      'partially-paid': 'invoicing.status.partiallyPaid',
      'overdue': 'invoicing.status.overdue',
      'cancelled': 'invoicing.status.cancelled',
      'refunded': 'invoicing.status.refunded',
    };
    return map[status] ?? `invoicing.status.${status}`;
  }

  trackLine(_: number, item: { id: string }): string {
    return item.id;
  }

  trackEvent(_: number, e: TimelineEvent): string {
    return e.key;
  }

  trackTva(_: number, row: { rate: number }): number {
    return row.rate;
  }

  trackCn(_: number, cn: CreditNoteWithDetails): string {
    return cn.id;
  }

  /** Map our internal payment method enum to the i18n key suffix used in `invoicing.paymentMethods.*`. */
  private methodKey(method: string): string {
    if (method === 'bank-transfer') return 'bankTransfer';
    return method;
  }

  /** Visibility map for the header action buttons keyed by status. Pure function for testability. */
  canShow(action: 'edit' | 'issueAndSend' | 'send' | 'recordPayment' | 'print' | 'downloadPdf' | 'creditNote' | 'delete' | 'previewPdf' | 'cancel'): boolean {
    const inv = this.invoice();
    if (!inv) return false;
    switch (action) {
      case 'edit':
        return inv.status === 'draft';
      case 'issueAndSend':
        return inv.status === 'draft';
      case 'previewPdf':
        return inv.status === 'draft';
      case 'send':
        // S-DEL-012: re-send must be available on every issued / non-cancelled
        // status, not just SENT/VIEWED — the BE writes a fresh DeliveryLog on
        // each call. DRAFT is excluded because it has no number yet, and
        // CANCELLED documents can no longer be sent.
        return (
          inv.status === 'sent' ||
          inv.status === 'viewed' ||
          inv.status === 'partially-paid' ||
          inv.status === 'paid' ||
          inv.status === 'overdue'
        );
      case 'recordPayment':
        return (
          (inv.status === 'sent' ||
            inv.status === 'viewed' ||
            inv.status === 'partially-paid' ||
            inv.status === 'overdue') &&
          inv.remainingAmount > 0
        );
      case 'print':
      case 'downloadPdf':
        return inv.status !== 'draft';
      case 'creditNote':
        // S-DET-006: OVERDUE is just a SENT invoice past dueDate — the
        // user must still be able to issue a credit note (e.g. to write
        // off an uncollectable receivable). Same affordance set as
        // PARTIALLY_PAID; the visual cue lives on the badge.
        return inv.status === 'sent' ||
          inv.status === 'viewed' ||
          inv.status === 'paid' ||
          inv.status === 'partially-paid' ||
          inv.status === 'overdue';
      case 'delete':
        return inv.status === 'draft' && this.isOwner();
      case 'cancel':
        // Cancel is only meaningful on DRAFT — issued invoices need a
        // credit note (BE returns 400 on non-DRAFT cancel attempts).
        return inv.status === 'draft';
    }
  }

  // Expose UserRole for template (kept private otherwise).
  readonly UserRole = UserRole;
}
