import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  computed, 
  signal,
  inject,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, switchMap, finalize, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { SubscriptionService } from '../../../core/services/subscription.service';
import { PhotoService, PhotoUploadError } from '../../../core/services/photo.service';
import { MaintenancePhoto, PhotoCategory } from '../../../core/models/maintenance.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FeatureLockComponent } from '../feature-lock/feature-lock.component';
import { UpgradePromptComponent } from '../upgrade-prompt/upgrade-prompt.component';
import { PhotoGalleryComponent } from '../photo-gallery/photo-gallery.component';

export interface PhotoUploadEvent {
  photos: MaintenancePhoto[];
  jobId: string;
  category: PhotoCategory;
}

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    TranslatePipe, 
    FeatureLockComponent,
    UpgradePromptComponent,
    PhotoGalleryComponent
  ],
  template: `
    <div class="photo-upload-container" [attr.data-tier]="currentTier()">
      
      <!-- Feature Lock Wrapper for SOLO/STARTER tiers -->
      <app-feature-lock 
        [config]="{
          feature: 'photos_documentation',
          title: 'photos.uploadTitle',
          description: 'photos.professionalDescription',
          showUpgradeButton: true
        }"
        (upgradeClicked)="onUpgradeClick($event)">
        
        <!-- Professional Tier - Full Photo Upload Interface -->
        <div class="photo-upload-enabled" *ngIf="hasPhotoAccess()">
          
          <!-- Upload Area -->
          <div class="glass-card photo-upload-section">
            <div class="upload-header">
              <div class="flex items-center space-x-3">
                <div class="upload-icon">
                  <svg class="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-white font-semibold">{{ 'photos.uploadTitle' | translate }}</h3>
                  <p class="text-gray-300 text-sm">{{ 'photos.uploadSubtitle' | translate }}</p>
                </div>
              </div>
              
              @if (showUpgradePrompt()) {
                <div class="tier-badge tier-professional" 
                     [attr.aria-label]="'tiers.professionalFeature' | translate">
                  {{ 'tiers.pro' | translate }}
                </div>
              }
            </div>

            <!-- Upload Form -->
            <form [formGroup]="uploadForm" class="upload-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="category">
                    {{ 'photos.category' | translate }} *
                  </label>
                  <select id="category" formControlName="category" class="form-select">
                    <option value="">{{ 'photos.selectCategory' | translate }}</option>
                    @for (cat of photoCategories; track cat.value) {
                      <option [value]="cat.value">{{ cat.label | translate }}</option>
                    }
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="form-label" for="description">
                    {{ 'photos.description' | translate }}
                  </label>
                  <input 
                    id="description"
                    type="text" 
                    formControlName="description"
                    [placeholder]="'photos.descriptionPlaceholder' | translate"
                    class="form-input">
                </div>
              </div>

              <!-- Drag & Drop Upload Zone -->
              <div class="upload-zone"
                   #uploadZone
                   (dragover)="onDragOver($event)"
                   (dragleave)="onDragLeave($event)"
                   (drop)="onFilesDrop($event)"
                   [class.drag-active]="isDragActive()"
                   [class.upload-disabled]="isUploading()"
                   [attr.aria-label]="'photos.uploadZoneAriaLabel' | translate"
                   tabindex="0"
                   role="button"
                   (click)="fileInput.click()"
                   (keydown.enter)="fileInput.click()"
                   (keydown.space)="fileInput.click()">
                
                <input 
                  #fileInput
                  type="file"
                  multiple
                  accept="image/*"
                  (change)="onFileSelect($event)"
                  class="file-input"
                  [attr.aria-describedby]="'upload-instructions'">

                <div class="upload-content">
                  @if (isUploading()) {
                    <div class="upload-loading" role="status" [attr.aria-label]="'photos.uploading' | translate">
                      <svg class="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" 
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span class="text-blue-300 font-medium">{{ 'photos.uploading' | translate }}</span>
                    </div>
                  } @else {
                    <div class="upload-instructions">
                      <svg class="w-12 h-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <h4 class="text-white font-semibold mb-2">{{ 'photos.dragAndDrop' | translate }}</h4>
                      <p id="upload-instructions" class="text-gray-300 mb-4 text-center">
                        {{ 'photos.uploadInstructions' | translate }}
                      </p>
                      <button type="button" class="btn-secondary">
                        {{ 'photos.selectFiles' | translate }}
                      </button>
                      <div class="upload-limits">
                        <span class="text-xs text-gray-400">
                          {{ 'photos.fileLimits' | translate: { 
                            maxSize: uploadConfig().maxFileSize,
                            maxCount: uploadConfig().maxPhotosPerJob
                          } }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Upload Button -->
              <div class="upload-actions">
                <button 
                  type="button"
                  class="btn-primary"
                  [disabled]="!selectedFiles().length || isUploading() || uploadForm.invalid"
                  (click)="uploadPhotos()"
                  [attr.aria-label]="'photos.uploadSelectedFiles' | translate">
                  @if (isUploading()) {
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {{ 'photos.uploading' | translate }}
                  } @else {
                    {{ 'photos.uploadFiles' | translate }} ({{ selectedFiles().length }})
                  }
                </button>
              </div>
            </form>

            <!-- Error Display -->
            @if (uploadError()) {
              <div class="upload-error glass-card-error" role="alert">
                <div class="error-content">
                  <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-red-300">{{ uploadError()?.message || 'photos.uploadError' | translate }}</span>
                </div>
                <button 
                  type="button" 
                  class="error-close"
                  (click)="clearError()"
                  [attr.aria-label]="'photos.closeError' | translate">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            }
          </div>

          <!-- Photo Gallery -->
          <app-photo-gallery 
            [photos]="photos()"
            [loading]="galleryLoading()"
            [editable]="true"
            (photoDeleted)="onPhotoDeleted($event)"
            (photoUpdated)="onPhotoUpdated($event)">
          </app-photo-gallery>
        </div>
        
        <!-- SOLO/STARTER Tiers - Locked State -->
        <div class="photo-upload-locked" *ngIf="!hasPhotoAccess()">
          <div class="locked-content glass-card">
            <div class="locked-overlay">
              <div class="lock-visual">
                <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="tier-badge tier-professional">
                  {{ 'tiers.pro' | translate }}
                </div>
              </div>
            </div>
            
            <div class="locked-text-content">
              <svg class="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              
              <h3 class="text-white text-lg font-semibold mb-2">
                {{ 'photos.professionalOnly' | translate }}
              </h3>
              
              <p class="text-gray-300 mb-6 text-center max-w-md">
                {{ 'photos.professionalDescription' | translate }}
              </p>

              <!-- Upgrade Benefits -->
              <div class="upgrade-benefits mb-6">
                <h4 class="text-white font-medium mb-3">{{ 'photos.upgradeToGet' | translate }}</h4>
                <ul class="benefits-list">
                  @for (benefit of upgradeBenefits; track benefit) {
                    <li class="benefit-item">
                      <svg class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{{ benefit | translate }}</span>
                    </li>
                  }
                </ul>
              </div>

              <button 
                class="btn-primary"
                (click)="showUpgradeModal()"
                [attr.aria-label]="'tiers.upgradeForPhotos' | translate">
                {{ 'tiers.upgradeToPro' | translate }}
              </button>

              <!-- Mock Photo Placeholders -->
              <div class="photo-placeholders mt-8">
                <h4 class="text-gray-400 text-sm font-medium mb-4">
                  {{ 'photos.sampleGallery' | translate }}
                </h4>
                <div class="placeholder-grid">
                  @for (placeholder of photoPlaceholders; track $index) {
                    <div class="placeholder-item">
                      <div class="placeholder-image">
                        <svg class="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div class="lock-badge">
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                      <span class="placeholder-label">{{ placeholder.label | translate }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </app-feature-lock>

      <!-- Upgrade Prompt Modal -->
      @if (showUpgradePrompt()) {
        <app-upgrade-prompt
          (close)="hideUpgradeModal()"
          (upgrade)="onUpgradeAction($event)">
        </app-upgrade-prompt>
      }
    </div>
  `,
  styles: [`
    /* Photo Upload Container */
    .photo-upload-container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }

    /* Upload Section */
    .photo-upload-section {
      margin-bottom: 2rem;
    }

    .upload-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .upload-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Form Styles */
    .upload-form {
      space-y: 1.5rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-label {
      color: #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .form-select,
    .form-input {
      background: rgba(31, 41, 55, 0.8);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 0.5rem;
      color: #ffffff;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }

    .form-select:focus,
    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-select option {
      background: #1f2937;
      color: #ffffff;
    }

    /* Upload Zone */
    .upload-zone {
      border: 2px dashed rgba(75, 85, 99, 0.5);
      border-radius: 1rem;
      padding: 3rem 2rem;
      text-align: center;
      background: rgba(17, 24, 39, 0.3);
      transition: all 0.3s ease;
      cursor: pointer;
      position: relative;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-zone:hover,
    .upload-zone:focus {
      border-color: #3b82f6;
      background: rgba(17, 24, 39, 0.5);
    }

    .upload-zone.drag-active {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }

    .upload-zone.upload-disabled {
      pointer-events: none;
      opacity: 0.7;
    }

    .file-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .upload-content {
      width: 100%;
    }

    .upload-instructions {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .upload-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .upload-limits {
      margin-top: 1rem;
    }

    /* Upload Actions */
    .upload-actions {
      display: flex;
      justify-content: center;
      margin-top: 1.5rem;
    }

    /* Error Display */
    .upload-error {
      margin-top: 1rem;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .error-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .error-close {
      background: none;
      border: none;
      color: #f87171;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: all 0.2s ease;
      margin-left: auto;
    }

    .error-close:hover {
      background: rgba(220, 38, 38, 0.2);
    }

    /* Locked State */
    .photo-upload-locked {
      padding: 2rem 0;
    }

    .locked-content {
      text-align: center;
      padding: 3rem 2rem;
      position: relative;
      overflow: hidden;
    }

    .locked-overlay {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 10;
    }

    .lock-visual {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .locked-text-content {
      position: relative;
      z-index: 5;
    }

    /* Upgrade Benefits */
    .upgrade-benefits {
      max-width: 400px;
      margin: 0 auto;
    }

    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-align: left;
      color: #d1d5db;
      font-size: 0.875rem;
    }

    /* Photo Placeholders */
    .photo-placeholders {
      margin-top: 2rem;
    }

    .placeholder-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .placeholder-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .placeholder-image {
      width: 80px;
      height: 60px;
      background: rgba(31, 41, 55, 0.8);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .lock-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }

    .placeholder-label {
      color: #9ca3af;
      font-size: 0.75rem;
      text-align: center;
    }

    /* Tier Badge */
    .tier-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      white-space: nowrap;
    }

    .tier-professional {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      border: 1px solid #f59e0b;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .photo-upload-container {
        padding: 0.5rem;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .upload-zone {
        padding: 2rem 1rem;
        min-height: 160px;
      }

      .upload-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .locked-content {
        padding: 2rem 1rem;
      }

      .placeholder-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }

      .benefits-list {
        gap: 0.5rem;
      }

      .benefit-item {
        font-size: 0.8rem;
      }
    }

    @media (max-width: 480px) {
      .upload-zone {
        padding: 1.5rem 1rem;
        min-height: 140px;
      }

      .upload-instructions h4 {
        font-size: 1rem;
      }

      .upload-instructions p {
        font-size: 0.875rem;
      }

      .placeholder-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .placeholder-image {
        width: 60px;
        height: 45px;
      }
    }

    /* High Contrast Mode Support */
    @media (prefers-contrast: high) {
      .upload-zone {
        border-width: 3px;
        border-color: #ffffff;
      }

      .form-select,
      .form-input {
        border-width: 2px;
        border-color: #ffffff;
      }

      .tier-badge.tier-professional {
        background: #000000;
        color: #ffffff;
        border: 2px solid #ffffff;
      }
    }

    /* Reduced Motion Support */
    @media (prefers-reduced-motion: reduce) {
      .upload-zone,
      .form-select,
      .form-input,
      .error-close,
      .tier-badge {
        transition: none;
      }

      .animate-spin {
        animation: none;
      }
    }

    /* Touch-Friendly Areas */
    @media (pointer: coarse) {
      .upload-zone {
        min-height: 180px;
        padding: 2.5rem 1.5rem;
      }

      .form-select,
      .form-input {
        padding: 1rem;
        font-size: 1rem;
      }

      .error-close {
        padding: 0.5rem;
        min-width: 44px;
        min-height: 44px;
      }

      .tier-badge {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
      }
    }

    /* RTL Support */
    [dir="rtl"] .upload-header {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .form-row {
      direction: rtl;
    }

    [dir="rtl"] .error-content {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .benefit-item {
      flex-direction: row-reverse;
      text-align: right;
    }

    [dir="rtl"] .locked-overlay {
      left: 1rem;
      right: auto;
    }

    /* Focus Visible Support */
    .upload-zone:focus-visible,
    .form-select:focus-visible,
    .form-input:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  `]
})
export class PhotoUploadComponent implements OnInit, OnDestroy {
  @Input() jobId: string = '';
  @Input() initialPhotos: MaintenancePhoto[] = [];
  @Input() maxPhotos: number = 20;
  @Input() allowedFormats: string[] = ['image/jpeg', 'image/png', 'image/webp'];
  @Input() maxFileSize: number = 10; // MB

  @Output() photosUploaded = new EventEmitter<PhotoUploadEvent>();
  @Output() photoDeleted = new EventEmitter<string>();
  @Output() photoUpdated = new EventEmitter<MaintenancePhoto>();

  @ViewChild('uploadZone') uploadZone!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  private subscriptionService = inject(SubscriptionService);
  private photoService = inject(PhotoService);
  private destroy$ = new Subject<void>();

  // Reactive state
  photos = signal<MaintenancePhoto[]>([]);
  selectedFiles = signal<File[]>([]);
  isDragActive = signal(false);
  isUploading = signal(false);
  galleryLoading = signal(false);
  uploadError = signal<PhotoUploadError | null>(null);
  showUpgradePrompt = signal(false);

  // Computed properties
  hasPhotoAccess = toSignal(
    this.subscriptionService.isFeatureEnabled('photos_documentation').pipe(
      startWith(false)
    ),
    { initialValue: false }
  );

  currentTier = computed(() => {
    return this.subscriptionService.currentTier();
  });

  uploadConfig = computed(() => {
    return this.photoService.getUploadConfig();
  });

  uploadForm!: FormGroup;
  photoCategories = this.photoService.getPhotoCategories();
  
  upgradeBenefits = [
    'photos.benefits.document',
    'photos.benefits.trust',
    'photos.benefits.evidence',
    'photos.benefits.comparison',
    'photos.benefits.quality'
  ];

  photoPlaceholders = [
    { label: 'photos.placeholders.before' },
    { label: 'photos.placeholders.during' },
    { label: 'photos.placeholders.after' },
    { label: 'photos.placeholders.parts' }
  ];

  ngOnInit(): void {
    this.initializeForm();
    this.photos.set([...this.initialPhotos]);
    this.loadPhotos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearSelectedFiles();
  }

  private initializeForm(): void {
    this.uploadForm = this.fb.group({
      category: ['before', Validators.required],
      description: ['']
    });
  }

  private loadPhotos(): void {
    if (!this.jobId) return;
    
    this.galleryLoading.set(true);
    this.photoService.getPhotosByJobId(this.jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.galleryLoading.set(false))
      )
      .subscribe({
        next: (photos) => this.photos.set(photos),
        error: (error) => this.handleError(error)
      });
  }

  // File handling methods
  onFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      this.handleFiles(Array.from(target.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive.set(false);
  }

  onFilesDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive.set(false);

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  private handleFiles(files: File[]): void {
    if (!this.hasPhotoAccess()) {
      this.showUpgradeModal();
      return;
    }

    const validFiles = files.filter(file => this.isValidFile(file));
    this.selectedFiles.set(validFiles);
    
    if (validFiles.length !== files.length) {
      this.uploadError.set({
        code: 'INVALID_FORMAT',
        message: 'photos.errors.someFilesInvalid'
      });
    }
  }

  private isValidFile(file: File): boolean {
    return this.allowedFormats.includes(file.type) && 
           file.size <= this.maxFileSize * 1024 * 1024;
  }

  uploadPhotos(): void {
    if (!this.uploadForm.valid || !this.selectedFiles().length) return;
    
    const formValue = this.uploadForm.value;
    const files = this.selectedFiles();
    
    this.isUploading.set(true);
    this.clearError();

    this.photoService.uploadPhotos(
      files,
      this.jobId,
      formValue.category,
      [formValue.description]
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isUploading.set(false))
    )
    .subscribe({
      next: (newPhotos) => {
        this.photos.update(existing => [...existing, ...newPhotos]);
        this.clearSelectedFiles();
        this.uploadForm.patchValue({ description: '' });
        
        this.photosUploaded.emit({
          photos: newPhotos,
          jobId: this.jobId,
          category: formValue.category
        });
      },
      error: (error) => this.handleError(error)
    });
  }

  onPhotoDeleted(photoId: string): void {
    this.photoService.deletePhoto(photoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.photos.update(photos => photos.filter(p => p.id !== photoId));
          this.photoDeleted.emit(photoId);
        },
        error: (error) => this.handleError(error)
      });
  }

  onPhotoUpdated(photo: MaintenancePhoto): void {
    this.photoService.updatePhoto(photo.id, photo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedPhoto) => {
          if (updatedPhoto) {
            this.photos.update(photos => 
              photos.map(p => p.id === updatedPhoto.id ? updatedPhoto : p)
            );
            this.photoUpdated.emit(updatedPhoto);
          }
        },
        error: (error) => this.handleError(error)
      });
  }

  // Upgrade flow methods
  onUpgradeClick(event: { feature: string; requiredTier?: string }): void {
    this.showUpgradeModal();
  }

  showUpgradeModal(): void {
    this.showUpgradePrompt.set(true);
  }

  hideUpgradeModal(): void {
    this.showUpgradePrompt.set(false);
  }

  onUpgradeAction(event: { tier: string; feature?: string }): void {
    // In real app, this would initiate the upgrade process
    console.log('Upgrade initiated for tier:', event.tier);
    this.hideUpgradeModal();
  }

  // Utility methods
  private clearSelectedFiles(): void {
    this.selectedFiles.set([]);
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private handleError(error: PhotoUploadError): void {
    this.uploadError.set(error);
    
    if (error.code === 'TIER_REQUIRED') {
      this.showUpgradeModal();
    }
  }

  clearError(): void {
    this.uploadError.set(null);
    this.photoService.clearError();
  }
}