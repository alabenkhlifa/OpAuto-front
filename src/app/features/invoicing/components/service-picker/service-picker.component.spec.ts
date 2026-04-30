import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
            currentLanguage: () => 'en',
            currentLanguage$: of('en'),
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
});
