import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FiscalSettingsComponent, MF_NUMBER_PATTERN, RIB_PATTERN } from './fiscal-settings.component';
import { FiscalSettings } from '../../../core/models/garage-settings.model';
import { TranslationService } from '../../../core/services/translation.service';
import { BehaviorSubject } from 'rxjs';

describe('FiscalSettingsComponent', () => {
  let component: FiscalSettingsComponent;
  let fixture: ComponentFixture<FiscalSettingsComponent>;

  const baseSettings: FiscalSettings = {
    mfNumber: '',
    rib: '',
    bankName: '',
    logoUrl: '',
    numberingPrefix: 'INV',
    numberingResetPolicy: 'YEARLY',
    numberingDigitCount: 4,
    defaultTvaRate: 19,
    fiscalStampEnabled: true,
    defaultPaymentTermsDays: 30,
  };

  beforeEach(async () => {
    const translations$ = new BehaviorSubject<Record<string, unknown>>({});
    const mockTranslation = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: translations$.asObservable(),
    });
    mockTranslation.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [FiscalSettingsComponent],
      providers: [{ provide: TranslationService, useValue: mockTranslation }],
    }).compileComponents();

    fixture = TestBed.createComponent(FiscalSettingsComponent);
    component = fixture.componentInstance;
    component.settings = { ...baseSettings };
    component.ngOnInit();
  });

  describe('regex constants', () => {
    it('MF_NUMBER_PATTERN accepts valid Tunisian matricule fiscal', () => {
      expect(MF_NUMBER_PATTERN.test('1234567/A/B/000')).toBeTrue();
      expect(MF_NUMBER_PATTERN.test('9876543/Z/Y/999')).toBeTrue();
    });

    it('MF_NUMBER_PATTERN rejects malformed input', () => {
      expect(MF_NUMBER_PATTERN.test('abc')).toBeFalse();
      expect(MF_NUMBER_PATTERN.test('123/A/B/000')).toBeFalse(); // too short
      expect(MF_NUMBER_PATTERN.test('1234567/AB/C/000')).toBeFalse(); // double letter
      expect(MF_NUMBER_PATTERN.test('1234567/a/b/000')).toBeFalse(); // lowercase
    });

    it('RIB_PATTERN accepts exactly 20 digits', () => {
      expect(RIB_PATTERN.test('12345678901234567890')).toBeTrue();
    });

    it('RIB_PATTERN rejects non-20-digit values', () => {
      expect(RIB_PATTERN.test('123')).toBeFalse();
      expect(RIB_PATTERN.test('12345678901234567890A')).toBeFalse();
      expect(RIB_PATTERN.test('1234567890123456789')).toBeFalse(); // 19 digits
    });
  });

  describe('form validation', () => {
    it('marks mfNumber invalid when format is wrong', () => {
      const ctrl = component.form.get('mfNumber')!;
      ctrl.setValue('not-a-mf');
      ctrl.markAsTouched();
      expect(ctrl.valid).toBeFalse();
      expect(component.isInvalid('mfNumber')).toBeTrue();
    });

    it('marks mfNumber valid for canonical format', () => {
      const ctrl = component.form.get('mfNumber')!;
      ctrl.setValue('1234567/A/B/000');
      expect(ctrl.valid).toBeTrue();
    });

    it('marks rib invalid when not 20 digits', () => {
      const ctrl = component.form.get('rib')!;
      ctrl.setValue('123');
      ctrl.markAsTouched();
      expect(ctrl.valid).toBeFalse();
    });

    it('marks rib valid when exactly 20 digits', () => {
      const ctrl = component.form.get('rib')!;
      ctrl.setValue('12345678901234567890');
      expect(ctrl.valid).toBeTrue();
    });

    it('marks numberingDigitCount invalid below 3 / above 8', () => {
      const ctrl = component.form.get('numberingDigitCount')!;
      ctrl.setValue(2);
      expect(ctrl.valid).toBeFalse();
      ctrl.setValue(9);
      expect(ctrl.valid).toBeFalse();
      ctrl.setValue(5);
      expect(ctrl.valid).toBeTrue();
    });

    it('marks defaultTvaRate invalid above 50', () => {
      const ctrl = component.form.get('defaultTvaRate')!;
      ctrl.setValue(75);
      expect(ctrl.valid).toBeFalse();
      ctrl.setValue(13);
      expect(ctrl.valid).toBeTrue();
    });
  });

  describe('save()', () => {
    it('does NOT emit when form is invalid', () => {
      const spy = spyOn(component.saveFiscal, 'emit');
      component.form.get('mfNumber')!.setValue('garbage');
      component.save();
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits the full payload when form is valid', () => {
      const spy = spyOn(component.saveFiscal, 'emit');
      component.form.patchValue({
        mfNumber: '1234567/A/B/000',
        rib: '12345678901234567890',
        bankName: 'BIAT',
        logoUrl: '/uploads/logo.png',
        numberingPrefix: 'FACT',
        numberingResetPolicy: 'MONTHLY',
        numberingDigitCount: 6,
        defaultTvaRate: 13,
        fiscalStampEnabled: false,
        defaultPaymentTermsDays: 45,
      });

      component.save();

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = spy.calls.mostRecent().args[0]!;
      expect(payload.mfNumber).toBe('1234567/A/B/000');
      expect(payload.rib).toBe('12345678901234567890');
      expect(payload.bankName).toBe('BIAT');
      expect(payload.logoUrl).toBe('/uploads/logo.png');
      expect(payload.numberingPrefix).toBe('FACT');
      expect(payload.numberingResetPolicy).toBe('MONTHLY');
      expect(payload.numberingDigitCount).toBe(6);
      expect(payload.defaultTvaRate).toBe(13);
      expect(payload.fiscalStampEnabled).toBe(false);
      expect(payload.defaultPaymentTermsDays).toBe(45);
    });
  });

  describe('populate()', () => {
    it('reflects existing settings into the form on ngOnInit', () => {
      const settings: FiscalSettings = {
        ...baseSettings,
        mfNumber: '7654321/Z/Y/999',
        numberingPrefix: 'AGR',
        numberingResetPolicy: 'NEVER',
        numberingDigitCount: 6,
      };

      const newFixture = TestBed.createComponent(FiscalSettingsComponent);
      const newComponent = newFixture.componentInstance;
      newComponent.settings = settings;
      newComponent.ngOnInit();

      expect(newComponent.form.get('mfNumber')!.value).toBe('7654321/Z/Y/999');
      expect(newComponent.form.get('numberingPrefix')!.value).toBe('AGR');
      expect(newComponent.form.get('numberingResetPolicy')!.value).toBe('NEVER');
      expect(newComponent.form.get('numberingDigitCount')!.value).toBe(6);
    });
  });
});
