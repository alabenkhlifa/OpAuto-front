import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ServicePickerComponent } from './service-picker.component';
import { ServiceCatalogService } from '../../../../core/services/service-catalog.service';
import { ServiceCatalogEntry } from '../../../../core/models/service-catalog.model';
import { TranslationService } from '../../../../core/services/translation.service';

/**
 * Unit tests for ServicePickerComponent — autocomplete filtering and
 * the `serviceSelected` event emission.
 *
 * BUG-096 (Sweep C-18): the component now hits
 * `ServiceCatalogService.searchCatalog(term, 25)` with a 300ms debounce
 * + switchMap (cancels stale requests). All tests use `fakeAsync` so we
 * can step the debounce manually.
 */
describe('ServicePickerComponent', () => {
  let component: ServicePickerComponent;
  let fixture: ComponentFixture<ServicePickerComponent>;
  let catalogStub: {
    searchCatalog: jasmine.Spy;
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
      searchCatalog: jasmine
        .createSpy('searchCatalog')
        .and.returnValue(of(sampleCatalog)),
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
    // NOTE: don't call detectChanges() here — each fakeAsync test below
    // needs the ngOnInit + debounce to fire inside its own fake-time
    // zone. Tests that don't need fake time call detectChanges()
    // explicitly.
  });

  // ── BUG-096: debounced server-side search ─────────────────────
  describe('BUG-096 (Sweep C-18) — debounced server-side search', () => {
    it('primes the dropdown with an empty search on init (1 call after debounce)', fakeAsync(() => {
      fixture.detectChanges(); // run ngOnInit inside fake time
      tick(300);
      expect(catalogStub.searchCatalog).toHaveBeenCalledTimes(1);
      expect(catalogStub.searchCatalog).toHaveBeenCalledWith('', 25);
      // Active-only filter on the result set.
      expect(component.results().map((r) => r.id).sort()).toEqual(['1', '2']);
    }));

    it('typing fires a search call only after the 300ms debounce window', fakeAsync(() => {
      fixture.detectChanges();
      tick(300); // flush the prime call
      catalogStub.searchCatalog.calls.reset();

      component.onInput('oi');
      // Before debounce, no new call.
      tick(200);
      expect(catalogStub.searchCatalog).not.toHaveBeenCalled();
      // After the rest of the window, exactly one call lands.
      tick(100);
      expect(catalogStub.searchCatalog).toHaveBeenCalledTimes(1);
      expect(catalogStub.searchCatalog).toHaveBeenCalledWith('oi', 25);
    }));

    it('rapid keystrokes collapse to a single trailing search via switchMap', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      catalogStub.searchCatalog.calls.reset();

      // Hand each `searchPartsServer` call its own Subject so we can
      // emit / not-emit independently. Pre-seed the next-call queue to
      // return r2$ since debounce should swallow the first input.
      const r2$ = new Subject<ServiceCatalogEntry[]>();
      catalogStub.searchCatalog.and.returnValue(r2$.asObservable());

      component.onInput('o');
      tick(100); // mid-debounce — first keystroke is cancelled before HTTP fires
      component.onInput('oi');
      tick(300); // flush debounce -> only the second emission lands

      // Only the most recent term is sent; the first was debounce-cancelled
      // before the spy could be invoked.
      expect(catalogStub.searchCatalog).toHaveBeenCalledTimes(1);
      expect(catalogStub.searchCatalog).toHaveBeenCalledWith('oi', 25);

      // No emission yet → loading is still true and results untouched.
      expect(component.loading()).toBeTrue();

      r2$.next(sampleCatalog);
      r2$.complete();
      expect(component.loading()).toBeFalse();
      expect(component.results().map((r) => r.id).sort()).toEqual(['1', '2']);
    }));

    it('mid-flight HTTP responses are cancelled via switchMap when typing continues', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      catalogStub.searchCatalog.calls.reset();

      // First input lands and the spy returns a long-pending Subject.
      const r1$ = new Subject<ServiceCatalogEntry[]>();
      const r2$ = new Subject<ServiceCatalogEntry[]>();
      catalogStub.searchCatalog.and.returnValues(r1$.asObservable(), r2$.asObservable());

      component.onInput('o');
      tick(300); // r1 in-flight
      expect(catalogStub.searchCatalog).toHaveBeenCalledTimes(1);

      // Now user types more before r1 resolves.
      component.onInput('oil');
      tick(300); // r2 fires, switchMap unsubscribes r1
      expect(catalogStub.searchCatalog).toHaveBeenCalledTimes(2);

      // r1 emits a stale "single-row" payload — switchMap MUST drop it.
      const previousResults = component.results();
      r1$.next([sampleCatalog[0]]);
      r1$.complete();
      // Results unchanged by the stale emission.
      expect(component.results()).toBe(previousResults);
      expect(component.loading()).toBeTrue();

      // r2 lands and updates the dropdown.
      r2$.next(sampleCatalog);
      r2$.complete();
      expect(component.loading()).toBeFalse();
      expect(component.results().map((r) => r.id).sort()).toEqual(['1', '2']);
    }));

    it('errors from the BE leave the dropdown empty without crashing', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      catalogStub.searchCatalog.calls.reset();
      // Subject -> we'll error it out
      const subject = new Subject<ServiceCatalogEntry[]>();
      catalogStub.searchCatalog.and.returnValue(subject.asObservable());

      component.onInput('x');
      tick(300);
      subject.error(new Error('boom'));

      expect(component.results()).toEqual([]);
      expect(component.loading()).toBeFalse();
    }));
  });

  // ── selection ─────────────────────────────────────────────────
  it('emits serviceSelected on pick', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    const spy = jasmine.createSpy('serviceSelected');
    component.serviceSelected.subscribe(spy);
    component.pick(sampleCatalog[0]);
    expect(spy).toHaveBeenCalledWith(sampleCatalog[0]);
    expect(component.query()).toBe('Oil change');
    expect(component.isOpen()).toBeFalse();
  }));

  describe('S-CAT-002: selection emits the full catalog entry for parent prefill', () => {
    it('emits the entry verbatim (parent forms read name / defaultPrice / defaultTvaRate)', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      const captured: ServiceCatalogEntry[] = [];
      component.serviceSelected.subscribe((e) => captured.push(e));

      component.pick(sampleCatalog[0]);

      expect(captured.length).toBe(1);
      expect(captured[0]).toBe(sampleCatalog[0]);
      expect(captured[0].name).toBe('Oil change');
      expect(captured[0].defaultPrice).toBe(80);
      expect(captured[0].defaultTvaRate).toBe(19);
      expect(captured[0].code).toBe('OIL_CHG');
    }));

    it('mirrors the picked name into the input and closes the dropdown', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      component.onInput('br');
      expect(component.isOpen()).toBeTrue();
      tick(300);
      component.pick(sampleCatalog[1]);
      expect(component.query()).toBe('Brake inspection');
      expect(component.isOpen()).toBeFalse();
    }));
  });
});
