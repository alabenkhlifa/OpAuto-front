import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
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

/**
 * Unit tests for PartPickerComponent.
 *
 * BUG-096 (Sweep C-18): the component now hits
 * `PartService.searchPartsServer(term, 25)` with a 300ms debounce +
 * switchMap (cancels stale requests).
 */
describe('PartPickerComponent', () => {
  let component: PartPickerComponent;
  let fixture: ComponentFixture<PartPickerComponent>;
  let searchSpy: jasmine.Spy;

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
    searchSpy = jasmine
      .createSpy('searchPartsServer')
      .and.returnValue(of(sample));

    await TestBed.configureTestingModule({
      imports: [PartPickerComponent],
      providers: [
        {
          provide: PartService,
          useValue: { searchPartsServer: searchSpy },
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
    // NOTE: detectChanges() is invoked inside each test that needs
    // fakeAsync, so the debounce timer fires inside the fake-time zone.
  });

  describe('BUG-096 (Sweep C-18) — debounced server-side search', () => {
    it('primes the dropdown with an empty search on init', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith('', 25);
      expect(component.results().length).toBe(3);
    }));

    it('typing fires a search call only after the 300ms debounce window', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      searchSpy.calls.reset();

      component.onInput('br');
      tick(200);
      expect(searchSpy).not.toHaveBeenCalled();
      tick(100);
      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith('br', 25);
    }));

    it('debounce swallows the first input when the user keeps typing', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      searchSpy.calls.reset();

      const r2$ = new Subject<PartWithStock[]>();
      searchSpy.and.returnValue(r2$.asObservable());

      component.onInput('b');
      tick(100); // mid-debounce — first input cancelled
      component.onInput('br');
      tick(300);

      // Only the trailing keystroke fires the spy.
      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith('br', 25);
      expect(component.loading()).toBeTrue();

      r2$.next(sample);
      r2$.complete();
      expect(component.loading()).toBeFalse();
      expect(component.results().length).toBe(3);
    }));

    it('mid-flight HTTP responses are dropped via switchMap when typing continues', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      searchSpy.calls.reset();

      const r1$ = new Subject<PartWithStock[]>();
      const r2$ = new Subject<PartWithStock[]>();
      searchSpy.and.returnValues(r1$.asObservable(), r2$.asObservable());

      component.onInput('b');
      tick(300); // r1 in-flight
      expect(searchSpy).toHaveBeenCalledTimes(1);

      component.onInput('br');
      tick(300); // r2 fires, r1 should be unsubscribed
      expect(searchSpy).toHaveBeenCalledTimes(2);

      const previousResults = component.results();
      r1$.next([sample[0]]);
      r1$.complete();
      // Results unchanged — stale r1 emission was dropped.
      expect(component.results()).toBe(previousResults);
      expect(component.loading()).toBeTrue();

      r2$.next(sample);
      r2$.complete();
      expect(component.loading()).toBeFalse();
      expect(component.results().length).toBe(3);
    }));
  });

  it('isOutOfStock and isLowStock identify the right rows', () => {
    fixture.detectChanges();
    expect(component.isOutOfStock(sample[1])).toBeTrue();
    expect(component.isLowStock(sample[2])).toBeTrue();
    expect(component.isOutOfStock(sample[0])).toBeFalse();
    expect(component.isLowStock(sample[0])).toBeFalse();
  });

  it('emits the selected part on pick', (done) => {
    fixture.detectChanges();
    component.partSelected.subscribe((p) => {
      expect(p.id).toBe('1');
      done();
    });
    component.pick(sample[0]);
  });
});
