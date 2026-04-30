import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ZReportComponent } from './z-report.component';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * Z-report component spec — same Karma `.html` loader caveat as the
 * AR-aging spec; compiles cleanly under tsc, runs once the harness is
 * fixed.
 */
describe('ZReportComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZReportComponent, HttpClientTestingModule],
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

  it('fetches today by default and reflects payload', () => {
    const fixture = TestBed.createComponent(ZReportComponent);
    fixture.detectChanges();
    const req = httpMock.expectOne(
      (r) => r.url === '/reports/z-report' && r.params.has('date'),
    );
    req.flush({
      date: '2026-04-30',
      invoicesIssued: 2,
      totalHT: 200,
      totalTVA: 38,
      totalTTC: 239,
      paymentsByMethod: { CASH: 100, CARD: 80, BANK_TRANSFER: 0, CHECK: 0, MOBILE_PAYMENT: 0 },
      creditNotesIssued: 1,
      creditNotesTotal: 50,
      netCash: 50,
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.report()?.invoicesIssued).toBe(2);
    expect(fixture.componentInstance.totalPayments()).toBe(180);
  });
});
