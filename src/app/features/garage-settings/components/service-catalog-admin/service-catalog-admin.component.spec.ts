import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ServiceCatalogAdminComponent } from './service-catalog-admin.component';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';

/**
 * S-CAT-009 (Sweep C-21) — Service Catalog admin component.
 *
 * Verifies the list / create / edit / delete flows against a stubbed
 * ServiceCatalogService. The HTTP layer is exercised separately in
 * service-catalog.service.spec.ts; here we focus on the component
 * behaviour (form validation, toast wiring, refresh after mutations).
 */
describe('ServiceCatalogAdminComponent', () => {
  let component: ServiceCatalogAdminComponent;
  let fixture: ComponentFixture<ServiceCatalogAdminComponent>;
  let catalogService: any;
  let toast: { success: jasmine.Spy; error: jasmine.Spy };

  const seedEntry = {
    id: 's1',
    garageId: 'g1',
    code: 'OIL',
    name: 'Oil change',
    description: 'Standard oil + filter',
    category: 'Maintenance',
    defaultPrice: 120,
    defaultLaborHours: 1,
    defaultTvaRate: 19,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const seedEnvelope = {
    items: [seedEntry],
    total: 1,
    page: 1,
    limit: 25,
  };

  beforeEach(async () => {
    catalogService = {
      getCatalogPaginated: jasmine
        .createSpy('getCatalogPaginated')
        .and.returnValue(of(seedEnvelope)),
      create: jasmine
        .createSpy('create')
        .and.returnValue(of({ ...seedEntry, id: 's-new' })),
      update: jasmine
        .createSpy('update')
        .and.returnValue(of({ ...seedEntry, name: 'Renamed' })),
      remove: jasmine
        .createSpy('remove')
        .and.returnValue(of({ id: 's1', isActive: false })),
    };

    toast = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };

    await TestBed.configureTestingModule({
      imports: [ServiceCatalogAdminComponent],
      providers: [
        provideRouter([]),
        { provide: ServiceCatalogService, useValue: catalogService },
        { provide: ToastService, useValue: toast },
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: new BehaviorSubject<Record<string, string>>({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceCatalogAdminComponent);
    component = fixture.componentInstance;
  });

  // ── List render ─────────────────────────────────────────────
  it('loads the first page on init and stores total / items', () => {
    fixture.detectChanges();
    expect(catalogService.getCatalogPaginated).toHaveBeenCalledWith({
      search: '',
      page: 1,
      limit: 25,
      includeInactive: false,
    });
    expect(component.entries().length).toBe(1);
    expect(component.totalCount()).toBe(1);
    expect(component.isLoading()).toBe(false);
  });

  it('shows the empty state when the BE returns zero rows', () => {
    catalogService.getCatalogPaginated.and.returnValue(
      of({ items: [], total: 0, page: 1, limit: 25 }),
    );
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('serviceCatalog.admin.empty.title');
  });

  it('toggleShowInactive flips the flag and re-fetches with includeInactive=true', () => {
    fixture.detectChanges();
    catalogService.getCatalogPaginated.calls.reset();
    component.toggleShowInactive();
    expect(component.showInactive()).toBe(true);
    expect(catalogService.getCatalogPaginated).toHaveBeenCalledWith(
      jasmine.objectContaining({ includeInactive: true, page: 1 }),
    );
  });

  // ── Pagination ──────────────────────────────────────────────
  it('goToNextPage emits a fresh fetch for the next page', () => {
    catalogService.getCatalogPaginated.and.returnValue(
      of({ items: [seedEntry], total: 60, page: 1, limit: 25 }),
    );
    fixture.detectChanges();
    catalogService.getCatalogPaginated.calls.reset();
    component.goToNextPage();
    expect(component.currentPage()).toBe(2);
    expect(catalogService.getCatalogPaginated).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 2 }),
    );
  });

  it('goToPreviousPage clamps below 1', () => {
    fixture.detectChanges();
    component.currentPage.set(1);
    catalogService.getCatalogPaginated.calls.reset();
    component.goToPreviousPage();
    expect(catalogService.getCatalogPaginated).not.toHaveBeenCalled();
  });

  // ── Search ──────────────────────────────────────────────────
  it('debounces search input by ~300ms before re-fetching', fakeAsync(() => {
    fixture.detectChanges();
    catalogService.getCatalogPaginated.calls.reset();
    component.onSearchChange({ target: { value: 'oi' } } as any);
    component.onSearchChange({ target: { value: 'oil' } } as any);
    component.onSearchChange({ target: { value: 'oil ' } } as any);
    expect(catalogService.getCatalogPaginated).not.toHaveBeenCalled();
    tick(300);
    expect(catalogService.getCatalogPaginated).toHaveBeenCalledTimes(1);
    expect(catalogService.getCatalogPaginated).toHaveBeenCalledWith(
      jasmine.objectContaining({ search: 'oil' }),
    );
  }));

  // ── Create modal ────────────────────────────────────────────
  it('openCreate resets the form and opens the modal', () => {
    fixture.detectChanges();
    component.openCreate();
    expect(component.isModalOpen()).toBe(true);
    expect(component.editingId()).toBeNull();
    expect(component.form.value).toEqual(
      jasmine.objectContaining({
        name: '',
        defaultPrice: 0,
        defaultTvaRate: 19,
        isActive: true,
      }),
    );
  });

  it('submitForm with invalid form does not call create', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ name: '' });
    component.submitForm();
    expect(catalogService.create).not.toHaveBeenCalled();
  });

  it('submitForm in create mode calls service.create with sanitised payload', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({
      name: '  Premium oil change  ',
      code: 'PREMIUM-OIL',
      category: 'Maintenance',
      defaultPrice: 150,
      defaultTvaRate: 19,
      isActive: true,
    });
    component.submitForm();
    expect(catalogService.create).toHaveBeenCalledTimes(1);
    const arg = catalogService.create.calls.mostRecent().args[0];
    expect(arg.name).toBe('Premium oil change');
    expect(arg.code).toBe('PREMIUM-OIL');
    expect(arg.defaultPrice).toBe(150);
    expect(toast.success).toHaveBeenCalledWith('serviceCatalog.messages.created');
    expect(component.isModalOpen()).toBe(false);
  });

  it('submitForm without code generates a slug from the name', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({
      name: 'Brake pad replacement',
      code: '',
      defaultPrice: 80,
      defaultTvaRate: 19,
    });
    component.submitForm();
    const arg = catalogService.create.calls.mostRecent().args[0];
    expect(arg.code).toMatch(/^BRAKE-PAD-REPLACEMENT-\d{4}$/);
  });

  it('409 conflict on create surfaces duplicateCode toast', () => {
    catalogService.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({
      name: 'Dup',
      code: 'DUP',
      defaultPrice: 1,
      defaultTvaRate: 19,
    });
    component.submitForm();
    expect(toast.error).toHaveBeenCalledWith(
      'serviceCatalog.messages.duplicateCode',
    );
    expect(component.isModalOpen()).toBe(true);
    expect(component.isSubmitting()).toBe(false);
  });

  // ── Edit modal ──────────────────────────────────────────────
  it('openEdit pre-populates the form with the entry payload', () => {
    fixture.detectChanges();
    component.openEdit(seedEntry as any);
    expect(component.isModalOpen()).toBe(true);
    expect(component.editingId()).toBe('s1');
    expect(component.form.value).toEqual(
      jasmine.objectContaining({
        code: 'OIL',
        name: 'Oil change',
        category: 'Maintenance',
        defaultPrice: 120,
        defaultTvaRate: 19,
        isActive: true,
      }),
    );
  });

  it('submitForm in edit mode calls service.update with the entry id', () => {
    fixture.detectChanges();
    component.openEdit(seedEntry as any);
    component.form.patchValue({ name: 'Renamed' });
    component.submitForm();
    expect(catalogService.update).toHaveBeenCalledTimes(1);
    expect(catalogService.update.calls.mostRecent().args[0]).toBe('s1');
    expect(toast.success).toHaveBeenCalledWith('serviceCatalog.messages.updated');
  });

  // ── Delete confirm ──────────────────────────────────────────
  it('askDelete sets pendingDelete; cancelDelete clears it', () => {
    fixture.detectChanges();
    component.askDelete(seedEntry as any);
    expect(component.pendingDelete()).toEqual(seedEntry as any);
    component.cancelDelete();
    expect(component.pendingDelete()).toBeNull();
    expect(catalogService.remove).not.toHaveBeenCalled();
  });

  it('confirmDelete calls service.remove (soft) and refreshes', () => {
    fixture.detectChanges();
    catalogService.getCatalogPaginated.calls.reset();
    component.askDelete(seedEntry as any);
    component.confirmDelete();
    expect(catalogService.remove).toHaveBeenCalledWith('s1', false);
    expect(toast.success).toHaveBeenCalledWith('serviceCatalog.messages.deleted');
    expect(component.pendingDelete()).toBeNull();
    expect(catalogService.getCatalogPaginated).toHaveBeenCalled();
  });

  it('confirmDelete with no pending entry is a no-op', () => {
    fixture.detectChanges();
    component.confirmDelete();
    expect(catalogService.remove).not.toHaveBeenCalled();
  });

  it('delete failure surfaces an error toast and clears the loading flag', () => {
    catalogService.remove.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    fixture.detectChanges();
    component.askDelete(seedEntry as any);
    component.confirmDelete();
    expect(toast.error).toHaveBeenCalledWith(
      'serviceCatalog.admin.errors.deleteFailed',
    );
    expect(component.isDeleting()).toBe(false);
  });

  // ── Restore (visible only when showInactive=true) ──────────
  it('restore re-activates the entry and refreshes the list', () => {
    fixture.detectChanges();
    catalogService.getCatalogPaginated.calls.reset();
    const inactive = { ...seedEntry, isActive: false };
    component.restore(inactive as any);
    expect(catalogService.update).toHaveBeenCalledWith('s1', { isActive: true });
    expect(toast.success).toHaveBeenCalledWith(
      'serviceCatalog.admin.messages.restored',
    );
    expect(catalogService.getCatalogPaginated).toHaveBeenCalled();
  });
});
