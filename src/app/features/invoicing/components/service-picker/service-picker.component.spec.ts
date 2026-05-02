import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { ServicePickerComponent } from './service-picker.component';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { TranslationService } from '../../../../core/services/translation.service';

/**
 * Unit tests for ServicePickerComponent — autocomplete filtering and
 * the `serviceSelected` event emission. ServiceCatalogService is
 * stubbed so we don't hit the network.
 */
describe('ServicePickerComponent', () => {
  let component: ServicePickerComponent;
  let fixture: ComponentFixture<ServicePickerComponent>;
  let catalogStub: {
    catalog: ServiceCatalogEntry[];
    loadCatalog: jasmine.Spy;
  };

  const sampleCatalog: ServiceCatalogEntry[] = [
    {
      id: '1',
      garageId: 'g1',
      code: 'OIL_CHG',
      name: 'Oil change',
      category: 'Maintenance',
      defaultPrice: 80,
      defaultTvaRate: 19,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      garageId: 'g1',
      code: 'BRK_INSP',
      name: 'Brake inspection',
      category: 'Safety',
      defaultPrice: 30,
      defaultTvaRate: 19,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '3',
      garageId: 'g1',
      code: 'OLD_SVC',
      name: 'Decommissioned service',
      defaultPrice: 0,
      defaultTvaRate: 19,
      isActive: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(async () => {
    catalogStub = {
      catalog: [],
      loadCatalog: jasmine.createSpy('loadCatalog').and.returnValue(of(sampleCatalog)),
    };

    await TestBed.configureTestingModule({
      imports: [ServicePickerComponent],
      providers: [
        { provide: ServiceCatalogService, useValue: catalogStub },
        {
          provide: TranslationService,
          useValue: {
            translate: (k: string) => k,
            instant: (k: string) => k,
            currentLanguage: () => 'en',
            currentLanguage$: of('en'),
            translations$: new BehaviorSubject<Record<string, string>>({}).asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  it('loads catalog on init when cache is empty', () => {
    expect(catalogStub.loadCatalog).toHaveBeenCalled();
    expect(component.entries().length).toBe(3);
  });

  it('hydrates from cache without an HTTP call when cache is populated', async () => {
    // Recreate with a populated cache.
    catalogStub.loadCatalog.calls.reset();
    catalogStub.catalog = sampleCatalog;
    fixture = TestBed.createComponent(ServicePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(catalogStub.loadCatalog).not.toHaveBeenCalled();
    expect(component.entries().length).toBe(3);
  });

  it('filters by name match (case-insensitive)', () => {
    component.onInput('oil');
    expect(component.results().map((r) => r.code)).toEqual(['OIL_CHG']);
  });

  it('filters by code match', () => {
    component.onInput('BRK');
    expect(component.results().map((r) => r.id)).toEqual(['2']);
  });

  it('filters by category match', () => {
    component.onInput('safety');
    expect(component.results().map((r) => r.id)).toEqual(['2']);
  });

  it('hides inactive entries', () => {
    component.onInput('decommissioned');
    expect(component.results().length).toBe(0);
  });

  it('emits serviceSelected on pick', () => {
    const spy = jasmine.createSpy('serviceSelected');
    component.serviceSelected.subscribe(spy);
    component.pick(sampleCatalog[0]);
    expect(spy).toHaveBeenCalledWith(sampleCatalog[0]);
    expect(component.query()).toBe('Oil change');
    expect(component.isOpen()).toBeFalse();
  });

  // ---- S-CAT-001 — autocomplete narrows as the user types --------------
  describe('S-CAT-001: autocomplete narrows as the user types', () => {
    it('shows all active entries when query is empty', () => {
      component.onInput('');
      // Active-only — inactive id "3" is hidden.
      expect(component.results().map((r) => r.id).sort()).toEqual(['1', '2']);
      expect(component.isOpen()).toBeTrue();
    });

    it('typing "oi" narrows to a single match by name', () => {
      component.onInput('oi');
      expect(component.results().length).toBe(1);
      expect(component.results()[0].code).toBe('OIL_CHG');
    });

    it('typing "oil" keeps the same single match (2-char minimum is not enforced)', () => {
      component.onInput('oil');
      expect(component.results().map((r) => r.code)).toEqual(['OIL_CHG']);
    });

    it('clearing the query restores the full active list', () => {
      component.onInput('oil');
      expect(component.results().length).toBe(1);
      component.onInput('');
      expect(component.results().length).toBe(2);
    });

    it('typing a non-matching query yields zero results', () => {
      component.onInput('zzznomatch');
      expect(component.results().length).toBe(0);
    });
  });

  // ---- S-CAT-002 — picking an entry hands the catalog row to parents ---
  describe('S-CAT-002: selection emits the full catalog entry for parent prefill', () => {
    it('emits the entry verbatim (parent forms read name / defaultPrice / defaultTvaRate)', () => {
      const captured: ServiceCatalogEntry[] = [];
      component.serviceSelected.subscribe((e) => captured.push(e));

      component.pick(sampleCatalog[0]);

      expect(captured.length).toBe(1);
      expect(captured[0]).toBe(sampleCatalog[0]);
      // The fields the parent forms patch onto the line:
      expect(captured[0].name).toBe('Oil change');
      expect(captured[0].defaultPrice).toBe(80);
      expect(captured[0].defaultTvaRate).toBe(19);
      expect(captured[0].code).toBe('OIL_CHG');
    });

    it('mirrors the picked name into the input and closes the dropdown', () => {
      component.onInput('br');
      expect(component.isOpen()).toBeTrue();
      component.pick(sampleCatalog[1]);
      expect(component.query()).toBe('Brake inspection');
      expect(component.isOpen()).toBeFalse();
    });
  });
});
