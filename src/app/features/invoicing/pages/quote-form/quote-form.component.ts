import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { AppointmentService } from '../../../appointments/services/appointment.service';
import { Customer, Car } from '../../../../core/models/appointment.model';
import { ServicePickerComponent } from '../../components/service-picker/service-picker.component';
import { PartPickerComponent } from '../../components/part-picker/part-picker.component';
import { LineItemType } from '../../../../core/models/invoice.model';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { PartWithStock } from '../../../../core/models/part.model';

// Order matters for the per-line TVA <select>: the default new-line rate
// (19) should be the first non-exempt option so that, if a browser
// briefly falls back to option[0] before Angular syncs [value], the user
// still sees a sensible rate. Sweep A Group 2 spec: 7, 13, 19, 0 (exempt).
const TVA_RATES = [7, 13, 19, 0] as const;
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
}

/**
 * QuoteFormPage — new-quote form with dynamic line items mirroring the
 * invoice-form pattern (signals-based store + service/part picker reuse).
 */
@Component({
  selector: 'app-quote-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslatePipe,
    ServicePickerComponent,
    PartPickerComponent,
  ],
  templateUrl: './quote-form.component.html',
  styleUrl: './quote-form.component.css',
})
export class QuoteFormPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private quoteService = inject(QuoteService);
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translation = inject(TranslationService);

  customers = signal<Customer[]>([]);
  allCars = signal<Car[]>([]);
  cars = signal<Car[]>([]);
  isSubmitting = signal(false);

  quoteId = signal<string | null>(null);
  isEditMode = computed(() => this.quoteId() !== null);

  lines = signal<LineState[]>([]);

  readonly tvaRates = TVA_RATES;
  readonly lineTypes: LineItemType[] = ['service', 'part', 'labor', 'misc'];

  readonly subtotalHT = computed(() =>
    this.lines().reduce((sum, l) => sum + this.lineNetHT(l), 0),
  );

  readonly totalTVA = computed(() =>
    this.lines().reduce(
      (sum, l) => sum + (this.lineNetHT(l) * l.tvaRate) / 100,
      0,
    ),
  );

  readonly totalTTC = computed(() => this.subtotalHT() + this.totalTVA());

  form = this.fb.group({
    customerId: ['', Validators.required],
    carId: ['', Validators.required],
    validUntil: [
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Validators.required,
    ],
    notes: [''],
  });

  ngOnInit(): void {
    // Load customers + cars in parallel; once both arrive, optionally hydrate
    // edit mode (route param `:id`). The hydration order matters — `cars()`
    // must be populated before we patch `carId`, otherwise the vehicle
    // <select> options are empty and the value silently drops to "".
    forkJoin({
      customers: this.customerService.getCustomers(),
      cars: this.appointmentService.getCars(),
    }).subscribe({
      next: ({ customers, cars }) => {
        this.customers.set(
          (customers as any[]).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
          })) as Customer[],
        );
        this.allCars.set(cars);

        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.loadQuote(id);
      },
    });
  }

  private loadQuote(id: string): void {
    this.quoteService.get(id).subscribe({
      next: (q) => {
        // DRAFT is the only editable state. Backend returns 423 on PUT for
        // any other status; redirect to detail rather than rendering a
        // half-broken form. (Mirrors invoice-form's locked-banner UX.)
        if (q.status !== 'DRAFT') {
          this.router.navigate(['/invoices/quotes', id]);
          return;
        }
        this.quoteId.set(q.id);
        this.cars.set(this.allCars().filter((c) => c.customerId === q.customerId));
        this.form.patchValue({
          customerId: q.customerId,
          carId: q.carId,
          validUntil: q.validUntil.toISOString().split('T')[0],
          notes: q.notes ?? '',
        });
        this.lines.set(
          q.lineItems.map((li) => ({
            type: (li.type ?? 'misc') as LineItemType,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            tvaRate: this.normalizeTvaRate((li as any).tvaRate ?? 19),
            discountPct: li.discountPercentage ?? 0,
            laborHours: li.laborHours,
            partId: li.partId,
            serviceCode: li.serviceCode,
          })),
        );
      },
      error: () => {
        this.toast.error(
          this.translation.instant('invoicing.quotes.form.loadFailed'),
        );
        this.router.navigate(['/invoices/quotes']);
      },
    });
  }

  onCustomerChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.form.patchValue({ customerId: id, carId: '' });
    if (!id) {
      this.cars.set([]);
      return;
    }
    this.cars.set(this.allCars().filter((c) => c.customerId === id));
  }

  // ── Line items ─────────────────────────────────────────────────────────────

  addLine(type: LineItemType): void {
    const next: LineState = {
      type,
      description: '',
      quantity: 1,
      unitPrice: 0,
      tvaRate: 19,
      discountPct: 0,
      laborHours: type === 'labor' ? 1 : undefined,
    };
    if (type === 'labor') {
      next.description = this.translation.instant(
        'invoicing.form.lines.defaultLaborDescription',
      );
    }
    this.lines.update((arr) => [...arr, next]);
  }

  removeLine(index: number): void {
    this.lines.update((arr) => arr.filter((_, i) => i !== index));
  }

  updateLine<K extends keyof LineState>(
    index: number,
    key: K,
    value: LineState[K],
  ): void {
    this.lines.update((arr) => {
      const next = [...arr];
      next[index] = { ...next[index], [key]: value };
      if (
        next[index].type === 'labor' &&
        (key === 'laborHours' || key === 'unitPrice')
      ) {
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
        laborHours: type === 'labor' ? prev.laborHours ?? 1 : undefined,
      };
      if (type === 'labor') {
        next[index].quantity = next[index].laborHours ?? 1;
        next[index].description ||= this.translation.instant(
          'invoicing.form.lines.defaultLaborDescription',
        );
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
      };
      return next;
    });
  }

  private lineNetHT(l: LineState): number {
    const gross = (l.quantity || 0) * (l.unitPrice || 0);
    const pct = Math.max(0, Math.min(100, l.discountPct || 0));
    return gross - (gross * pct) / 100;
  }

  lineTotal(index: number): number {
    return this.lineNetHT(this.lines()[index]);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private normalizeTvaRate(rate: number): TvaRate {
    return (TVA_RATES as readonly number[]).includes(rate)
      ? (rate as TvaRate)
      : 19;
  }

  trackLine(index: number, _: LineState): number {
    return index;
  }

  // ── Submit / cancel ────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.lines().length === 0) {
      this.toast.warning(
        this.translation.instant('invoicing.quotes.form.linesRequired'),
      );
      return;
    }
    const v = this.form.value;
    const lineItems = this.lines().map((l) => ({
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
      tvaRate: l.tvaRate,
    }));
    this.isSubmitting.set(true);

    const editingId = this.quoteId();
    if (editingId) {
      this.quoteService
        .update(editingId, {
          customerId: v.customerId ?? '',
          carId: v.carId ?? '',
          validUntil: new Date(v.validUntil ?? new Date()),
          notes: v.notes ?? '',
          lineItems: lineItems as any,
        })
        .subscribe({
          next: (quote) => {
            this.isSubmitting.set(false);
            this.toast.success(
              this.translation.instant('invoicing.quotes.form.updated'),
            );
            this.router.navigate(['/invoices/quotes', quote.id]);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.toast.error(
              this.translation.instant('invoicing.quotes.form.updateFailed'),
            );
          },
        });
      return;
    }

    this.quoteService
      .create({
        customerId: v.customerId ?? '',
        carId: v.carId ?? '',
        status: 'DRAFT',
        issueDate: new Date(),
        validUntil: new Date(v.validUntil ?? new Date()),
        currency: 'TND',
        discountPercentage: 0,
        notes: v.notes ?? '',
        lineItems: lineItems as any,
        createdBy: 'current-user',
      })
      .subscribe({
        next: (quote) => {
          this.isSubmitting.set(false);
          this.toast.success(
            this.translation.instant('invoicing.quotes.form.created'),
          );
          this.router.navigate(['/invoices/quotes', quote.id]);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.toast.error(
            this.translation.instant('invoicing.quotes.form.createFailed'),
          );
        },
      });
  }

  cancel(): void {
    const editingId = this.quoteId();
    if (editingId) {
      this.router.navigate(['/invoices/quotes', editingId]);
    } else {
      this.router.navigate(['/invoices/quotes']);
    }
  }
}
