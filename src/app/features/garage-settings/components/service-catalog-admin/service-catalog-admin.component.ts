import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { ToastService } from '../../../../shared/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';

/**
 * S-CAT-009 (Sweep C-21) — Service Catalog admin CRUD page.
 *
 * Owners reach this page via `/settings/service-catalog`. Lists every
 * catalog entry (active + inactive when toggled) with server-side
 * search + pagination. Create / edit happens in an in-page modal that
 * shares the same `ServiceCatalogEntry` shape as the picker. Delete is
 * a soft-delete by default (`isActive=false`) so historical invoice
 * line references stay intact; a `?hard=true` flag is exposed only
 * through the API (admin UI never offers it — too easy to break
 * fiscal traceability).
 */
@Component({
  selector: 'app-service-catalog-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './service-catalog-admin.component.html',
  styleUrl: './service-catalog-admin.component.css',
})
export class ServiceCatalogAdminComponent implements OnInit {
  private catalogService = inject(ServiceCatalogService);
  private toast = inject(ToastService);
  private translation = inject(TranslationService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  static readonly PAGE_SIZE = 25;
  /** Canonical Tunisian TVA rates surfaced by the FE form. */
  readonly tvaRates: number[] = [0, 7, 13, 19];

  entries = signal<ServiceCatalogEntry[]>([]);
  totalCount = signal(0);
  isLoading = signal(false);
  searchQuery = signal('');
  currentPage = signal(1);
  showInactive = signal(false);

  // Edit dialog state
  isModalOpen = signal(false);
  editingId = signal<string | null>(null);
  isSubmitting = signal(false);

  // Delete confirm state
  pendingDelete = signal<ServiceCatalogEntry | null>(null);
  isDeleting = signal(false);

  form: FormGroup = this.fb.group({
    code: ['', [Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    category: ['', [Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    defaultPrice: [
      0,
      [Validators.required, Validators.min(0)],
    ],
    defaultLaborHours: [null],
    defaultTvaRate: [19, [Validators.required]],
    isActive: [true],
  });

  totalPages = computed(() => {
    const total = this.totalCount();
    return Math.max(
      1,
      Math.ceil(total / ServiceCatalogAdminComponent.PAGE_SIZE),
    );
  });

  effectivePage = computed(() => {
    return Math.min(Math.max(1, this.currentPage()), this.totalPages());
  });

  pageStart = computed(() => {
    if (this.totalCount() === 0) return 0;
    return (
      (this.effectivePage() - 1) * ServiceCatalogAdminComponent.PAGE_SIZE + 1
    );
  });

  pageEnd = computed(() => {
    return Math.min(
      this.totalCount(),
      this.effectivePage() * ServiceCatalogAdminComponent.PAGE_SIZE,
    );
  });

  /**
   * Unified fetch pipeline — search + page changes both feed `fetch$`
   * with the latest snapshot; switchMap cancels stale in-flight calls
   * (mirrors the C-20 invoice-list pattern).
   */
  private readonly fetch$ = new Subject<{
    search: string;
    page: number;
    includeInactive: boolean;
  }>();

  /** Search debounce gate — 300 ms to keep BE hit-rate sane. */
  private readonly searchDebounce$ = new Subject<string>();

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(({ search, page, includeInactive }) => {
          this.isLoading.set(true);
          return this.catalogService.getCatalogPaginated({
            search,
            page,
            limit: ServiceCatalogAdminComponent.PAGE_SIZE,
            includeInactive,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (envelope) => {
          this.entries.set(envelope.items);
          this.totalCount.set(envelope.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error(
            this.translation.instant('serviceCatalog.admin.errors.loadFailed'),
          );
        },
      });

    this.searchDebounce$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchQuery.set(term);
        this.currentPage.set(1);
        this.refresh();
      });

    this.refresh();
  }

  private refresh(): void {
    this.fetch$.next({
      search: this.searchQuery().trim(),
      page: this.currentPage(),
      includeInactive: this.showInactive(),
    });
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchDebounce$.next(value);
  }

  toggleShowInactive(): void {
    this.showInactive.update((v) => !v);
    this.currentPage.set(1);
    this.refresh();
  }

  goToNextPage(): void {
    const next = this.effectivePage() + 1;
    if (next <= this.totalPages()) {
      this.currentPage.set(next);
      this.refresh();
    }
  }

  goToPreviousPage(): void {
    const prev = this.effectivePage() - 1;
    if (prev >= 1) {
      this.currentPage.set(prev);
      this.refresh();
    }
  }

  // ── Modal: create / edit ───────────────────────────────────
  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      code: '',
      name: '',
      category: '',
      description: '',
      defaultPrice: 0,
      defaultLaborHours: null,
      defaultTvaRate: 19,
      isActive: true,
    });
    this.isModalOpen.set(true);
  }

  openEdit(entry: ServiceCatalogEntry): void {
    this.editingId.set(entry.id);
    this.form.reset({
      code: entry.code ?? '',
      name: entry.name,
      category: entry.category ?? '',
      description: entry.description ?? '',
      defaultPrice: entry.defaultPrice,
      defaultLaborHours: entry.defaultLaborHours ?? null,
      defaultTvaRate: entry.defaultTvaRate,
      isActive: entry.isActive,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingId.set(null);
    this.isSubmitting.set(false);
  }

  onModalBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const value = this.form.getRawValue();
    const payload = {
      code: (value.code ?? '').trim() || undefined,
      name: (value.name ?? '').trim(),
      category: (value.category ?? '').trim() || undefined,
      description: (value.description ?? '').trim() || undefined,
      defaultPrice: Number(value.defaultPrice ?? 0),
      defaultLaborHours:
        value.defaultLaborHours === null || value.defaultLaborHours === ''
          ? undefined
          : Number(value.defaultLaborHours),
      defaultTvaRate: Number(value.defaultTvaRate ?? 19),
      isActive: !!value.isActive,
    };

    const editing = this.editingId();
    const obs = editing
      ? this.catalogService.update(editing, payload)
      : // BE requires `code` non-null on create. Generate a stable code from
        // the name when omitted so we don't reject the form for a field most
        // owners won't bother filling in.
        this.catalogService.create({
          ...payload,
          code: payload.code ?? this.deriveCode(payload.name),
        });

    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.success(
          this.translation.instant(
            editing
              ? 'serviceCatalog.messages.updated'
              : 'serviceCatalog.messages.created',
          ),
        );
        this.closeModal();
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.toast.error(
            this.translation.instant('serviceCatalog.messages.duplicateCode'),
          );
          return;
        }
        this.toast.error(
          this.translation.instant('serviceCatalog.admin.errors.saveFailed'),
        );
      },
    });
  }

  /** Derives a slug-ish code from the service name when the owner left
   * the field blank. Keeps the BE happy without exposing yet another
   * required input. */
  private deriveCode(name: string): string {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${base || 'SVC'}-${suffix}`;
  }

  // ── Delete confirm ─────────────────────────────────────────
  askDelete(entry: ServiceCatalogEntry): void {
    this.pendingDelete.set(entry);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.pendingDelete();
    if (!target || this.isDeleting()) return;
    this.isDeleting.set(true);
    // Soft delete only — the admin UI never offers a hard-delete because
    // it would break fiscal line-item traceability on issued invoices.
    this.catalogService.remove(target.id, false).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.pendingDelete.set(null);
        this.toast.success(
          this.translation.instant('serviceCatalog.messages.deleted'),
        );
        this.refresh();
      },
      error: () => {
        this.isDeleting.set(false);
        this.toast.error(
          this.translation.instant('serviceCatalog.admin.errors.deleteFailed'),
        );
      },
    });
  }

  // ── Restore (only visible when showInactive is on) ─────────
  restore(entry: ServiceCatalogEntry): void {
    this.catalogService
      .update(entry.id, { isActive: true })
      .subscribe({
        next: () => {
          this.toast.success(
            this.translation.instant('serviceCatalog.admin.messages.restored'),
          );
          this.refresh();
        },
        error: () => {
          this.toast.error(
            this.translation.instant(
              'serviceCatalog.admin.errors.restoreFailed',
            ),
          );
        },
      });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  formatPrice(value: number): string {
    return value.toFixed(2);
  }
}
