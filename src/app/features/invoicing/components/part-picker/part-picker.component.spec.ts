import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PartPickerComponent } from './part-picker.component';
import { PartService } from '../../../../core/services/part.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { PartWithStock } from '../../../../core/models/part.model';

function makePart(over: Partial<PartWithStock> = {}): PartWithStock {
  return {
    id: 'p1',
    name: 'Brake pad',
    partNumber: 'BP-001',
    description: '',
    category: 'brakes',
    supplierId: 's',
    brand: 'Bosch',
    price: 80,
    currency: 'TND',
    stockLevel: 10,
    minStockLevel: 3,
    unit: 'piece',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    stockStatus: 'in-stock',
    totalUsageThisMonth: 0,
    averageMonthlyUsage: 0,
    ...over,
  };
}

describe('PartPickerComponent', () => {
  let component: PartPickerComponent;
  let fixture: ComponentFixture<PartPickerComponent>;

  const sample: PartWithStock[] = [
    makePart({ id: '1', name: 'Brake pad', partNumber: 'BP-001', stockLevel: 10, minStockLevel: 3 }),
    makePart({
      id: '2',
      name: 'Oil filter',
      partNumber: 'OF-200',
      stockLevel: 0,
      minStockLevel: 2,
    }),
    makePart({
      id: '3',
      name: 'Spark plug',
      partNumber: 'SP-300',
      stockLevel: 2,
      minStockLevel: 5,
    }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartPickerComponent],
      providers: [
        {
          provide: PartService,
          useValue: { getParts: () => of(sample) },
        },
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads parts from the service on init', () => {
    expect(component.entries().length).toBe(3);
  });

  it('filters by name (case-insensitive)', () => {
    component.onInput('brake');
    expect(component.results().length).toBe(1);
    expect(component.results()[0].id).toBe('1');
  });

  it('filters by part number', () => {
    component.onInput('SP-3');
    expect(component.results()[0].id).toBe('3');
  });

  it('isOutOfStock and isLowStock identify the right rows', () => {
    expect(component.isOutOfStock(sample[1])).toBeTrue();
    expect(component.isLowStock(sample[2])).toBeTrue();
    expect(component.isOutOfStock(sample[0])).toBeFalse();
    expect(component.isLowStock(sample[0])).toBeFalse();
  });

  it('emits the selected part on pick', (done) => {
    component.partSelected.subscribe((p) => {
      expect(p.id).toBe('1');
      done();
    });
    component.pick(sample[0]);
  });
});
