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

  /**
   * S-RPT-007 — clicking Print delegates to `window.print()`. The actual
   * print stylesheet is asserted at component-CSS level (the `@media print`
   * block hides chrome + monochromes the card); here we only pin that the
   * Print button calls into the browser print pipeline rather than
   * triggering an in-page navigation.
   */
  it('S-RPT-007: print() delegates to window.print()', () => {
    const fixture = TestBed.createComponent(ZReportComponent);
    fixture.detectChanges();
    httpMock.expectOne(
      (r) => r.url === '/reports/z-report' && r.params.has('date'),
    ).flush({
      date: '2026-05-01', invoicesIssued: 0, totalHT: 0, totalTVA: 0, totalTTC: 0,
      paymentsByMethod: { CASH: 0, CARD: 0, BANK_TRANSFER: 0, CHECK: 0, MOBILE_PAYMENT: 0 },
      creditNotesIssued: 0, creditNotesTotal: 0, netCash: 0,
    });
    const spy = spyOn(window, 'print');
    fixture.componentInstance.print();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  /**
   * S-RPT-007 — DOM contract: the controls header is marked `.no-print`
   * (so the print stylesheet can hide it) and a `.print-only` summary
   * line is present in the rendered output (visible only on the printout).
   */
  it('S-RPT-007: header has .no-print marker and print-only summary exists', () => {
    const fixture = TestBed.createComponent(ZReportComponent);
    fixture.detectChanges();
    httpMock.expectOne(
      (r) => r.url === '/reports/z-report' && r.params.has('date'),
    ).flush({
      date: '2026-05-01', invoicesIssued: 1, totalHT: 100, totalTVA: 19, totalTTC: 119,
      paymentsByMethod: { CASH: 119, CARD: 0, BANK_TRANSFER: 0, CHECK: 0, MOBILE_PAYMENT: 0 },
      creditNotesIssued: 0, creditNotesTotal: 0, netCash: 119,
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('header.no-print')).toBeTruthy();
    expect(host.querySelector('.print-only')).toBeTruthy();
  });
});
