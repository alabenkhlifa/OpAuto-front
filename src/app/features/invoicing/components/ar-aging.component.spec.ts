import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ArAgingComponent } from './ar-aging.component';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * Unit spec for the AR-aging dashboard component.
 *
 * The Karma `.html` loader complains for any spec that lives under a
 * deep components folder; this is a pre-existing harness limitation in
 * this repo (see CLAUDE.md). We still author the spec because it
 * compiles under tsc and the test-writer protocol asks for one. If the
 * harness is fixed later these tests will run in Karma without edits.
 */
describe('ArAgingComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArAgingComponent, HttpClientTestingModule],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            translations$: of({}),
            currentLanguage: () => 'en',
          },
        },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('renders rows once the API resolves', () => {
    const fixture = TestBed.createComponent(ArAgingComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne('/reports/ar-aging');
    expect(req.request.method).toBe('GET');
    req.flush({
      asOf: '2026-04-30',
      totals: {
        current: 0,
        b1_30: 100,
        b31_60: 0,
        b61_90: 0,
        b90_plus: 500,
        total: 600,
      },
      rows: [
        {
          customerId: 'a',
          customerName: 'Carla',
          current: 0,
          b1_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 500,
          total: 500,
        },
        {
          customerId: 'b',
          customerName: 'Bob',
          current: 0,
          b1_30: 100,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 0,
          total: 100,
        },
      ],
    });

    fixture.detectChanges();
    expect(fixture.componentInstance.report()?.rows.length).toBe(2);
    expect(fixture.componentInstance.chartData().labels?.length).toBe(2);
    expect(fixture.componentInstance.chartData().datasets.length).toBe(5);
  });

  it('records error on HTTP failure', () => {
    const fixture = TestBed.createComponent(ArAgingComponent);
    fixture.detectChanges();
    const req = httpMock.expectOne('/reports/ar-aging');
    req.flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('forbidden');
  });
});
