import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FiscalSettings, NumberingResetPolicy } from '../../../core/models/garage-settings.model';

// Tunisian matricule fiscal — e.g. "1234567/A/B/000"
export const MF_NUMBER_PATTERN = /^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/;
// Tunisian RIB — exactly 20 digits
export const RIB_PATTERN = /^\d{20}$/;

@Component({
  selector: 'app-fiscal-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="space-y-6">

      <!-- Identity -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">{{ 'settings.fiscal.identity' | translate }}</h3>
          <button
            type="button"
            class="btn-primary text-sm"
            [disabled]="form.invalid"
            (click)="save()">
            {{ 'settings.saveChanges' | translate }}
          </button>
        </div>

        <form [formGroup]="form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">{{ 'settings.fiscal.mfNumber' | translate }}</label>
              <input
                type="text"
                class="form-input"
                formControlName="mfNumber"
                [placeholder]="'settings.fiscal.mfNumberPlaceholder' | translate"
                [class.border-red-500]="isInvalid('mfNumber')">
              @if (isInvalid('mfNumber')) {
                <p class="mt-1 text-sm text-red-400">{{ 'settings.fiscal.mfNumberInvalid' | translate }}</p>
              }
            </div>

            <div>
              <label class="form-label">{{ 'settings.fiscal.rib' | translate }}</label>
              <input
                type="text"
                class="form-input"
                formControlName="rib"
                [placeholder]="'settings.fiscal.ribPlaceholder' | translate"
                [class.border-red-500]="isInvalid('rib')">
              @if (isInvalid('rib')) {
                <p class="mt-1 text-sm text-red-400">{{ 'settings.fiscal.ribInvalid' | translate }}</p>
              }
            </div>

            <div>
              <label class="form-label">{{ 'settings.fiscal.bankName' | translate }}</label>
              <input
                type="text"
                class="form-input"
                formControlName="bankName">
            </div>

            <div>
              <!-- TODO: file upload pipeline (using URL input for v1) -->
              <label class="form-label">{{ 'settings.fiscal.logoUrl' | translate }}</label>
              <input
                type="text"
                class="form-input"
                formControlName="logoUrl"
                [placeholder]="'settings.fiscal.logoUrlPlaceholder' | translate">
            </div>
          </div>
        </form>
      </div>

      <!-- Numbering -->
      <div class="glass-card">
        <h3 class="text-lg font-semibold text-white mb-4">{{ 'settings.fiscal.numbering' | translate }}</h3>

        <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="form-label">{{ 'settings.fiscal.prefix' | translate }}</label>
            <input
              type="text"
              class="form-input"
              formControlName="numberingPrefix"
              maxlength="10"
              [class.border-red-500]="isInvalid('numberingPrefix')">
            @if (isInvalid('numberingPrefix')) {
              <p class="mt-1 text-sm text-red-400">{{ 'settings.fiscal.prefixInvalid' | translate }}</p>
            }
          </div>

          <div>
            <label class="form-label">{{ 'settings.fiscal.resetPolicy' | translate }}</label>
            <select class="form-select" formControlName="numberingResetPolicy">
              <option value="NEVER">{{ 'settings.fiscal.resetPolicyNever' | translate }}</option>
              <option value="YEARLY">{{ 'settings.fiscal.resetPolicyYearly' | translate }}</option>
              <option value="MONTHLY">{{ 'settings.fiscal.resetPolicyMonthly' | translate }}</option>
            </select>
          </div>

          <div>
            <label class="form-label">{{ 'settings.fiscal.digitCount' | translate }}</label>
            <input
              type="number"
              class="form-input"
              formControlName="numberingDigitCount"
              min="3"
              max="8"
              step="1"
              [class.border-red-500]="isInvalid('numberingDigitCount')">
            @if (isInvalid('numberingDigitCount')) {
              <p class="mt-1 text-sm text-red-400">{{ 'settings.fiscal.digitCountInvalid' | translate }}</p>
            }
          </div>
        </form>
      </div>

      <!-- Tax -->
      <div class="glass-card">
        <h3 class="text-lg font-semibold text-white mb-4">{{ 'settings.fiscal.tax' | translate }}</h3>

        <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">{{ 'settings.fiscal.defaultTvaRate' | translate }}</label>
            <input
              type="number"
              class="form-input"
              formControlName="defaultTvaRate"
              min="0"
              max="50"
              step="0.5">
          </div>

          <div class="flex items-end">
            <label class="flex items-center">
              <input
                type="checkbox"
                class="form-checkbox mr-2"
                formControlName="fiscalStampEnabled">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.fiscal.fiscalStampEnabled' | translate }}</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Payment Terms -->
      <div class="glass-card">
        <h3 class="text-lg font-semibold text-white mb-4">{{ 'settings.fiscal.paymentTerms' | translate }}</h3>

        <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">{{ 'settings.fiscal.defaultPaymentTermsDays' | translate }}</label>
            <input
              type="number"
              class="form-input"
              formControlName="defaultPaymentTermsDays"
              min="0"
              max="365"
              step="1">
          </div>
        </form>
      </div>

    </div>
  `,
  styles: [`
    /* Component uses global form classes from /src/styles/forms.css */
    /* Component uses global button classes from /src/styles/buttons.css */
  `]
})
export class FiscalSettingsComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);

  @Input() settings!: FiscalSettings;
  @Output() saveFiscal = new EventEmitter<Partial<FiscalSettings>>();

  form!: FormGroup;

  readonly resetPolicies: NumberingResetPolicy[] = ['NEVER', 'YEARLY', 'MONTHLY'];

  ngOnInit() {
    this.form = this.fb.group({
      mfNumber: ['', [Validators.pattern(MF_NUMBER_PATTERN)]],
      rib: ['', [Validators.pattern(RIB_PATTERN)]],
      bankName: [''],
      logoUrl: [''],
      numberingPrefix: ['INV', [Validators.required, Validators.maxLength(10)]],
      numberingResetPolicy: ['YEARLY' as NumberingResetPolicy, [Validators.required]],
      numberingDigitCount: [4, [Validators.required, Validators.min(3), Validators.max(8)]],
      defaultTvaRate: [19, [Validators.required, Validators.min(0), Validators.max(50)]],
      fiscalStampEnabled: [true],
      defaultPaymentTermsDays: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
    });
    this.populate();
  }

  ngOnChanges() {
    if (this.form && this.settings) {
      this.populate();
    }
  }

  private populate() {
    if (!this.settings) return;
    this.form.patchValue({
      mfNumber: this.settings.mfNumber ?? '',
      rib: this.settings.rib ?? '',
      bankName: this.settings.bankName ?? '',
      logoUrl: this.settings.logoUrl ?? '',
      numberingPrefix: this.settings.numberingPrefix ?? 'INV',
      numberingResetPolicy: this.settings.numberingResetPolicy ?? 'YEARLY',
      numberingDigitCount: this.settings.numberingDigitCount ?? 4,
      defaultTvaRate: this.settings.defaultTvaRate ?? 19,
      fiscalStampEnabled: this.settings.fiscalStampEnabled ?? true,
      defaultPaymentTermsDays: this.settings.defaultPaymentTermsDays ?? 30,
    });
  }

  isInvalid(field: string): boolean {
    const control = this.form?.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value as FiscalSettings;
    this.saveFiscal.emit(value);
  }
}
