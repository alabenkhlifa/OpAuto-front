import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../shared/services/toast.service';

import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { AppointmentService } from '../../appointments/services/appointment.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { GarageSettingsService } from '../../../core/services/garage-settings.service';
import { UserService } from '../../../core/services/user.service';
import { PartService } from '../../../core/services/part.service';

import {
  CreateInvoiceRequest,
  InvoiceLineItem,
  InvoiceWithDetails,
  LineItemType,
} from '../../../core/models/invoice.model';
import { Car } from '../../../core/models/appointment.model';
import { Customer as RootCustomer } from '../../../core/models/customer.model';
import { GarageSettings } from '../../../core/models/garage-settings.model';
import { User } from '../../../core/models/user.model';
import { UserRole } from '../../../core/models/auth.model';
import { MaintenanceJob } from '../../../core/models/maintenance.model';
import { PartWithStock } from '../../../core/models/part.model';
import { ServiceCatalogEntry } from '../../../core/models/service-catalog.model';

import { ServicePickerComponent } from './service-picker/service-picker.component';
import { PartPickerComponent } from './part-picker/part-picker.component';
import {
  SendInvoiceModalComponent,
  SendInvoiceContext,
  SendInvoicePayload,
} from './send-invoice-modal/send-invoice-modal.component';

const TVA_RATES = [0, 7, 13, 19] as const;
type TvaRate = (typeof TVA_RATES)[number];

interface LineState {
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  tvaRate: TvaRate;
  discountPct: number;
  laborHours?: number;
  partId?: string;
  serviceCode?: string;
  /** Live stock for parts — used to flag overdraw rows. */
  partStock?: number;
}

/**
 * Sectioned invoice form rebuild — Task 5.3.
 *
 * - Customer / Vehicle / linked job (Section 1)
 * - Pull-from-job CTA (Section 2)
 * - Line items table with type-aware row rendering (Section 3)
 * - Invoice-level discount + approver picker (Section 4)
 * - Sticky right summary with TVA breakdown + fiscal stamp (Section 5)
 * - Sticky bottom action bar + sticky top validation banner
 *
 * Locked invoices (status !== draft) render read-only with an
 * "Issue Credit Note" CTA. Stock overdraws turn the affected row red
 * and invalidate the form.
 */
@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ServicePickerComponent,
    PartPickerComponent,
    SendInvoiceModalComponent,
  ],
  templateUrl: './invoice-form.component.html',
  styleUrl: './invoice-form.component.css',
})
export class InvoiceFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly garageSettings = inject(GarageSettingsService);
  private readonly userService = inject(UserService);
  private readonly partService = inject(PartService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);

  // ── Form & state ──────────────────────────────────────────────────────────

  readonly form: FormGroup;
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly isEditMode = signal(false);
  readonly currentInvoice = signal<InvoiceWithDetails | null>(null);

  // Reference data
  readonly customers = signal<RootCustomer[]>([]);
  readonly cars = signal<Car[]>([]);
  readonly jobs = signal<MaintenanceJob[]>([]);
  readonly owners = signal<User[]>([]);
  readonly settings = signal<GarageSettings | null>(null);

  // Section 2 state
  readonly linkedJob = signal<MaintenanceJob | null>(null);
  readonly jobPulled = signal(false);

  // Send modal
  readonly sendModalOpen = signal(false);
  readonly sendSubmitting = signal(false);
  readonly sendContext = signal<SendInvoiceContext | null>(null);

  // Lines as a local signal store for fast computed totals
  readonly lines = signal<LineState[]>([]);

  // ── Derived state ─────────────────────────────────────────────────────────

  /** `true` if the invoice is locked (issued / sent / paid …). DRAFT remains editable. */
  readonly isLocked = computed(() => {
    const inv = this.currentInvoice();
    return !!inv && inv.status !== 'draft';
  });

  /** Subtotal HT (after per-line discount, before TVA, before invoice-level discount). */
  readonly subtotalHT = computed(() =>
    this.lines().reduce((sum, l) => sum + this.lineNetHT(l), 0),
  );

  readonly invoiceDiscountPct = signal(0);
  readonly invoiceDiscountReason = signal('');
  readonly approverId = signal<string>('');

  /** Subtotal HT after applying invoice-level discount. */
  readonly discountedSubtotal = computed(() => {
    const subtotal = this.subtotalHT();
    const pct = Math.max(0, Math.min(100, this.invoiceDiscountPct() || 0));
    return subtotal - (subtotal * pct) / 100;
  });

  /** Per-rate TVA breakdown — only rows with non-zero base. */
  readonly tvaBreakdown = computed(() => {
    const totalsByRate = new Map<number, { base: number; tva: number }>();
    const overallSubtotal = this.subtotalHT();
    const invoicePct = Math.max(0, Math.min(100, this.invoiceDiscountPct() || 0));
    const invoiceDiscountFactor = overallSubtotal > 0 ? 1 - invoicePct / 100 : 1;

    for (const l of this.lines()) {
      const lineHT = this.lineNetHT(l) * invoiceDiscountFactor;
      const cur = totalsByRate.get(l.tvaRate) ?? { base: 0, tva: 0 };
      cur.base += lineHT;
      cur.tva += (lineHT * l.tvaRate) / 100;
      totalsByRate.set(l.tvaRate, cur);
    }
    return Array.from(totalsByRate.entries())
      .filter(([, v]) => v.base !== 0)
      .map(([rate, v]) => ({ rate, base: v.base, tva: v.tva }))
      .sort((a, b) => a.rate - b.rate);
  });

  readonly totalTVA = computed(() =>
    this.tvaBreakdown().reduce((s, r) => s + r.tva, 0),
  );

  readonly fiscalStamp = computed(() =>
    this.settings()?.fiscalSettings?.fiscalStampEnabled ? 1 : 0,
  );

  readonly totalTTC = computed(
    () => this.discountedSubtotal() + this.totalTVA() + this.fiscalStamp(),
  );

  readonly auditThresholdPct = computed(
    () => (this.settings() as any)?.fiscalSettings?.discountAuditThresholdPct ?? 5,
  );

  readonly approverRequired = computed(
    () => (this.invoiceDiscountPct() || 0) > this.auditThresholdPct(),
  );

  /** Issues the form has — surfaced in the sticky validation banner. */
  readonly validationIssues = computed<string[]>(() => {
    const issues: string[] = [];
    const f = this.form.value;
    if (!f.customerId) issues.push('invoicing.form.errors.customerRequired');
    if (!f.carId) issues.push('invoicing.form.errors.vehicleRequired');
    if (this.lines().length === 0)
      issues.push('invoicing.form.errors.lineItemRequired');

    if ((this.invoiceDiscountPct() || 0) > 0 && !this.invoiceDiscountReason().trim())
      issues.push('invoicing.form.errors.discountReasonRequired');

    if (this.approverRequired() && !this.approverId())
      issues.push('invoicing.form.errors.approverRequired');

    if (this.lines().some((l) => this.lineHasOverdraw(l)))
      issues.push('invoicing.form.errors.partOverdraw');

    if (this.lines().some((l) => !l.description?.trim()))
      issues.push('invoicing.form.errors.lineDescriptionRequired');

    return issues;
  });

  readonly canSubmit = computed(
    () => this.validationIssues().length === 0 && !this.isLocked(),
  );

  // ── Constants exposed to the template ─────────────────────────────────────

  readonly tvaRates = TVA_RATES;
  readonly lineTypes: LineItemType[] = ['service', 'part', 'labor', 'misc'];

  constructor() {
    this.form = this.fb.group({
      customerId: ['', Validators.required],
      carId: ['', Validators.required],
      maintenanceJobId: [''],
      issueDate: [this.todayIso(), Validators.required],
      dueDate: [this.todayPlusDaysIso(30), Validators.required],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.isLoading.set(true);

    forkJoin({
      customers: this.customerService.getCustomers().pipe(catchError(() => of([] as RootCustomer[]))),
      cars: this.appointmentService.getCars().pipe(catchError(() => of([] as Car[]))),
      jobs: this.maintenanceService.getMaintenanceJobs().pipe(catchError(() => of([] as MaintenanceJob[]))),
      settings: this.garageSettings.getSettings().pipe(catchError(() => of(null as GarageSettings | null))),
      users: this.userService.getUsers().pipe(catchError(() => of([] as User[]))),
    }).subscribe(({ customers, cars, jobs, settings, users }) => {
      this.customers.set(customers);
      this.cars.set(cars);
      this.jobs.set(jobs);
      this.settings.set(settings);
      this.owners.set(users.filter((u) => u.role === UserRole.OWNER));

      // Once settings are loaded, refresh the dueDate default if the form has not been touched.
      if (settings && !this.form.controls['dueDate'].dirty) {
        const days = settings.fiscalSettings?.defaultPaymentTermsDays ?? 30;
        this.form.patchValue({ dueDate: this.todayPlusDaysIso(days) }, { emitEvent: false });
      }

      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.loadInvoice(id);
      } else {
        this.isLoading.set(false);
        // Pre-fill from query params if "?jobId=…" present
        const jobId = this.route.snapshot.queryParamMap.get('jobId');
        if (jobId) this.linkJobById(jobId);
      }
    });
  }

  // ── Loading existing invoice (edit mode) ──────────────────────────────────

  private loadInvoice(invoiceId: string): void {
    this.invoiceService.fetchInvoiceById(invoiceId).subscribe({
      next: (inv) => {
        this.currentInvoice.set(inv);
        this.isEditMode.set(true);
        this.form.patchValue({
          customerId: inv.customerId,
          carId: inv.carId,
          maintenanceJobId: (inv as any).maintenanceJobId ?? '',
          issueDate: inv.issueDate.toISOString().split('T')[0],
          dueDate: inv.dueDate.toISOString().split('T')[0],
          notes: inv.notes || '',
        });
        this.invoiceDiscountPct.set(inv.discountPercentage || 0);
        this.lines.set(
          inv.lineItems.map<LineState>((li) => ({
            type: li.type as LineItemType,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            tvaRate: this.normalizeTvaRate(
              (li as any).tvaRate ?? inv.taxRate ?? this.defaultTva(),
            ),
            discountPct: li.discountPercentage || 0,
            laborHours: li.laborHours,
            partId: li.partId,
            serviceCode: li.serviceCode,
          })),
        );

        const jobId = (inv as any).maintenanceJobId as string | undefined;
        if (jobId) {
          const job = this.jobs().find((j) => j.id === jobId);
          this.linkedJob.set(job ?? null);
          this.jobPulled.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error(this.translation.instant('invoicing.form.errors.loadFailed'));
        this.isLoading.set(false);
      },
    });
  }

  // ── Section 1 helpers ─────────────────────────────────────────────────────

  filteredCars = computed(() => {
    const customerId = this.form.value.customerId;
    return customerId ? this.cars().filter((c) => c.customerId === customerId) : [];
  });

  filteredJobs = computed(() => {
    const carId = this.form.value.carId;
    if (!carId) return [];
    return this.jobs().filter((j) => j.carId === carId).slice(0, 10);
  });

  onCustomerChange(): void {
    const customerId = this.form.value.customerId;
    if (customerId) {
      const cars = this.cars().filter((c) => c.customerId === customerId);
      if (cars.length === 1) this.form.patchValue({ carId: cars[0].id });
      else this.form.patchValue({ carId: '' });
    }
    this.form.patchValue({ maintenanceJobId: '' });
    this.linkedJob.set(null);
    this.jobPulled.set(false);
  }

  onCarChange(): void {
    this.form.patchValue({ maintenanceJobId: '' });
    this.linkedJob.set(null);
    this.jobPulled.set(false);
  }

  onJobChange(): void {
    const jobId = this.form.value.maintenanceJobId;
    this.linkJobById(jobId);
  }

  private linkJobById(jobId: string): void {
    if (!jobId) {
      this.linkedJob.set(null);
      this.jobPulled.set(false);
      return;
    }
    const job = this.jobs().find((j) => j.id === jobId) ?? null;
    this.linkedJob.set(job);
    this.jobPulled.set(false);
    if (job) {
      this.form.patchValue({
        customerId: job.customerId,
        carId: job.carId,
        maintenanceJobId: job.id,
      });
    }
  }

  // ── Section 2: Pull from job ──────────────────────────────────────────────

  pullFromJob(): void {
    const jobId = this.linkedJob()?.id;
    if (!jobId) return;
    this.isSubmitting.set(true);
    this.invoiceService.createInvoiceFromJob(jobId).subscribe({
      next: (inv) => {
        // Backend returns a DRAFT invoice; navigate to edit mode so the rebuilt
        // form re-loads with the prefilled lines from the server.
        this.toast.success(this.translation.instant('invoicing.form.toast.pulledFromJob'));
        this.isSubmitting.set(false);
        this.router.navigate(['/invoices/edit', inv.id]);
      },
      error: () => {
        this.toast.error(this.translation.instant('invoicing.form.errors.pullFailed'));
        this.isSubmitting.set(false);
      },
    });
  }

  // ── Section 3: Line items ─────────────────────────────────────────────────

  addLine(type: LineItemType): void {
    const defaultTva = this.normalizeTvaRate(this.defaultTva());
    const next: LineState = {
      type,
      description: '',
      quantity: 1,
      unitPrice: 0,
      tvaRate: defaultTva,
      discountPct: 0,
      laborHours: type === 'labor' ? 1 : undefined,
    };
    if (type === 'labor') {
      next.unitPrice = (this.settings() as any)?.businessSettings?.pricingRules?.laborRatePerHour ?? 0;
      next.description = this.translation.instant('invoicing.form.lines.defaultLaborDescription');
    }
    this.lines.update((arr) => [...arr, next]);
  }

  removeLine(index: number): void {
    this.lines.update((arr) => arr.filter((_, i) => i !== index));
  }

  /** Mutates a single field of a line by index without losing reactivity. */
  updateLine<K extends keyof LineState>(index: number, key: K, value: LineState[K]): void {
    this.lines.update((arr) => {
      const next = [...arr];
      next[index] = { ...next[index], [key]: value };
      // Recompute labor row total = hours × rate.
      if (next[index].type === 'labor' && (key === 'laborHours' || key === 'unitPrice')) {
        next[index].quantity = next[index].laborHours ?? 0;
      }
      return next;
    });
  }

  onLineTypeChange(index: number, type: LineItemType): void {
    this.lines.update((arr) => {
      const next = [...arr];
      const prev = next[index];
      next[index] = {
        ...prev,
        type,
        partId: undefined,
        serviceCode: undefined,
        partStock: undefined,
        laborHours: type === 'labor' ? prev.laborHours ?? 1 : undefined,
      };
      if (type === 'labor') {
        next[index].quantity = next[index].laborHours ?? 1;
        next[index].description ||= this.translation.instant('invoicing.form.lines.defaultLaborDescription');
      }
      return next;
    });
  }

  onServicePicked(index: number, entry: ServiceCatalogEntry): void {
    this.lines.update((arr) => {
      const next = [...arr];
      next[index] = {
        ...next[index],
        type: 'service',
        description: entry.name,
        unitPrice: entry.defaultPrice,
        tvaRate: this.normalizeTvaRate(entry.defaultTvaRate),
        laborHours: entry.defaultLaborHours ?? next[index].laborHours,
        serviceCode: entry.code,
      };
      return next;
    });
  }

  onPartPicked(index: number, entry: PartWithStock): void {
    this.lines.update((arr) => {
      const next = [...arr];
      next[index] = {
        ...next[index],
        type: 'part',
        description: `${entry.name}${entry.brand ? ' — ' + entry.brand : ''}`,
        unitPrice: entry.price,
        partId: entry.id,
        partStock: entry.stockLevel,
      };
      return next;
    });
  }

  /** Net HT for a single line (qty × unitPrice − line discount). */
  private lineNetHT(l: LineState): number {
    const gross = (l.quantity || 0) * (l.unitPrice || 0);
    const pct = Math.max(0, Math.min(100, l.discountPct || 0));
    return gross - (gross * pct) / 100;
  }

  lineTotal(index: number): number {
    return this.lineNetHT(this.lines()[index]);
  }

  lineHasOverdraw(l: LineState): boolean {
    return (
      l.type === 'part' &&
      typeof l.partStock === 'number' &&
      (l.quantity || 0) > l.partStock
    );
  }

  isOverdraw(index: number): boolean {
    return this.lineHasOverdraw(this.lines()[index]);
  }

  // ── Section 4: Discount / approver ────────────────────────────────────────

  onDiscountChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    this.invoiceDiscountPct.set(Number.isFinite(num) ? num : 0);
  }

  onDiscountReasonChange(value: string): void {
    this.invoiceDiscountReason.set(value || '');
  }

  onApproverChange(value: string): void {
    this.approverId.set(value || '');
  }

  // ── Submit / save / issue ─────────────────────────────────────────────────

  saveDraft(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const payload = this.buildPayload('draft');

    const obs$ = this.isEditMode() && this.currentInvoice()
      ? this.invoiceService.updateInvoice(this.currentInvoice()!.id, payload)
      : this.invoiceService.createInvoice(payload);

    obs$.subscribe({
      next: (inv) => {
        this.toast.success(this.translation.instant('invoicing.form.toast.draftSaved'));
        this.isSubmitting.set(false);
        this.router.navigate(['/invoices', inv.id]);
      },
      error: () => {
        this.toast.error(this.translation.instant('invoicing.form.errors.saveFailed'));
        this.isSubmitting.set(false);
      },
    });
  }

  /** Issue & Send: persist (if needed) → POST /issue → open send-invoice modal. */
  issueAndSend(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const payload = this.buildPayload('draft');
    const persist$ = this.isEditMode() && this.currentInvoice()
      ? this.invoiceService.updateInvoice(this.currentInvoice()!.id, payload)
      : this.invoiceService.createInvoice(payload);

    persist$.subscribe({
      next: (inv) => {
        this.invoiceService.issueInvoice(inv.id).subscribe({
          next: (issued) => {
            this.currentInvoice.set(issued);
            this.openSendModal(issued);
            this.isSubmitting.set(false);
          },
          error: () => {
            this.toast.error(this.translation.instant('invoicing.form.errors.issueFailed'));
            this.isSubmitting.set(false);
          },
        });
      },
      error: () => {
        this.toast.error(this.translation.instant('invoicing.form.errors.saveFailed'));
        this.isSubmitting.set(false);
      },
    });
  }

  openSendModal(inv: InvoiceWithDetails): void {
    this.sendContext.set({
      documentId: inv.id,
      documentNumber: inv.invoiceNumber,
      documentKindLabelKey: 'invoicing.send.kindInvoice',
      customerEmail: inv.customerEmail ?? null,
      customerPhone: inv.customerPhone ?? null,
    });
    this.sendModalOpen.set(true);
  }

  onSendModalClose(): void {
    this.sendModalOpen.set(false);
  }

  onSendModalSubmit(payload: SendInvoicePayload): void {
    const inv = this.currentInvoice();
    if (!inv) return;
    this.sendSubmitting.set(true);
    this.invoiceService.deliverInvoice(inv.id, payload).subscribe({
      next: () => {
        this.sendSubmitting.set(false);
        this.sendModalOpen.set(false);
        this.toast.success(this.translation.instant('invoicing.form.toast.sent'));
        this.router.navigate(['/invoices', inv.id]);
      },
      error: () => {
        this.sendSubmitting.set(false);
        this.toast.error(this.translation.instant('invoicing.form.errors.sendFailed'));
      },
    });
  }

  previewPdf(): void {
    const inv = this.currentInvoice();
    if (!inv) return;
    window.open(this.invoiceService.pdfUrl(inv.id), '_blank');
  }

  cancel(): void {
    this.router.navigate(['/invoices']);
  }

  goToCreditNote(): void {
    const inv = this.currentInvoice();
    if (!inv) return;
    this.router.navigate(['/invoices/credit-notes/new'], {
      queryParams: { invoiceId: inv.id },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildPayload(status: 'draft' | 'sent'): CreateInvoiceRequest {
    const f = this.form.value;
    const lines = this.lines().map<InvoiceLineItem>((l, i) => ({
      id: `line_${Date.now()}_${i}`,
      type: l.type,
      description: l.description,
      quantity: l.quantity,
      unit: l.type === 'labor' ? 'hour' : l.type === 'part' ? 'piece' : 'service',
      unitPrice: l.unitPrice,
      totalPrice: this.lineNetHT(l),
      partId: l.partId,
      serviceCode: l.serviceCode,
      laborHours: l.laborHours,
      discountPercentage: l.discountPct || undefined,
      taxable: l.tvaRate > 0,
    }));

    const payload: CreateInvoiceRequest = {
      customerId: f.customerId,
      carId: f.carId,
      issueDate: new Date(f.issueDate),
      dueDate: new Date(f.dueDate),
      status,
      currency: 'TND',
      taxRate: this.defaultTva(),
      discountPercentage: this.invoiceDiscountPct() || 0,
      paidAmount: 0,
      lineItems: lines,
      notes: f.notes,
      paymentTerms:
        this.translation.instant('invoicing.form.summary.defaultPaymentTermsLabel'),
      createdBy: 'current-user',
    };
    if (f.maintenanceJobId) (payload as any).maintenanceJobId = f.maintenanceJobId;
    if (this.invoiceDiscountReason().trim())
      (payload as any).discountReason = this.invoiceDiscountReason().trim();
    if (this.approverRequired() && this.approverId())
      (payload as any).discountApprovedBy = this.approverId();
    return payload;
  }

  private todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }

  private todayPlusDaysIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private defaultTva(): number {
    return this.settings()?.fiscalSettings?.defaultTvaRate ?? 19;
  }

  private normalizeTvaRate(rate: number): TvaRate {
    return (TVA_RATES as readonly number[]).includes(rate) ? (rate as TvaRate) : 19;
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  // Used by trackBy in template.
  trackLine(_: number, _l: LineState): number {
    return _;
  }
  trackIssue(_: number, key: string): string {
    return key;
  }
  trackTvaRow(_: number, row: { rate: number }): number {
    return row.rate;
  }

  // Display helpers ----------------------------------------------------------

  getCustomerLabel(c: RootCustomer): string {
    return `${c.name}${c.phone ? ' — ' + c.phone : ''}`;
  }

  getCarLabel(c: Car): string {
    return `${c.make} ${c.model} (${c.licensePlate})`;
  }

  getJobLabel(j: MaintenanceJob): string {
    return `${j.jobTitle || j.description || j.id.slice(0, 6)} · ${j.licensePlate}`;
  }

  getOwnerLabel(u: User): string {
    const fn = (u as any).firstName ?? '';
    const ln = (u as any).lastName ?? '';
    const composed = `${fn} ${ln}`.trim();
    return composed || u.email || u.id;
  }

  getPaymentTermsLabel(): string {
    const days = this.settings()?.fiscalSettings?.defaultPaymentTermsDays ?? 30;
    return this.translation.instant('invoicing.form.summary.paymentTermsDays', { days });
  }
}
