import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { MaintenancePhoto, PhotoCategory } from '../../../core/models/maintenance.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-photo-gallery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="photo-gallery-container">
      
      @if (photos.length > 0) {
        <div class="gallery-header glass-card">
          <div class="header-content">
            <div class="gallery-title">
              <svg class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 class="text-white font-semibold">
                {{ 'photos.galleryTitle' | translate }}
              </h3>
            </div>
            
            <div class="gallery-stats">
              <span class="photo-count">
                {{ photos.length }} {{ 'photos.photoCount' | translate }}
              </span>
              
              <!-- Category Filter -->
              <select 
                [value]="selectedCategory()"
                (change)="onCategoryFilter($event)"
                class="category-filter"
                [attr.aria-label]="'photos.filterByCategory' | translate">
                <option value="">{{ 'photos.allCategories' | translate }}</option>
                @for (category of availableCategories(); track category.value) {
                  <option [value]="category.value">
                    {{ category.label | translate }}
                  </option>
                }
              </select>
            </div>
          </div>
        </div>

        <!-- Photo Grid -->
        <div class="photo-grid" 
             [attr.aria-label]="'photos.galleryAriaLabel' | translate"
             role="region">
          
          @for (photo of filteredPhotos(); track photo.id) {
            <div class="photo-item glass-card" 
                 [attr.data-category]="photo.category">
              
              <!-- Photo Image -->
              <div class="photo-container">
                <img 
                  [src]="photo.url"
                  [alt]="photo.description || ('photos.photoAlt' | translate: { category: photo.category })"
                  class="photo-image"
                  [attr.loading]="'lazy'"
                  (click)="openPhotoModal(photo)"
                  (keydown.enter)="openPhotoModal(photo)"
                  (keydown.space)="openPhotoModal(photo)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'photos.openPhoto' | translate">
                
                <!-- Category Badge -->
                <div class="category-badge" 
                     [attr.data-category]="photo.category">
                  <span class="category-icon">
                    @switch (photo.category) {
                      @case ('before') {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                      }
                      @case ('during') {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                      }
                      @case ('after') {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      @case ('diagnostic') {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      }
                      @case ('damage') {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      }
                      @default {
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      }
                    }
                  </span>
                  <span class="category-text">
                    {{ ('photos.categories.' + photo.category) | translate }}
                  </span>
                </div>
                
                <!-- Loading Overlay -->
                @if (loading) {
                  <div class="photo-loading">
                    <svg class="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                }
              </div>

              <!-- Photo Info -->
              <div class="photo-info">
                <div class="photo-details">
                  @if (photo.description) {
                    <p class="photo-description">{{ photo.description }}</p>
                  }
                  <div class="photo-meta">
                    <span class="photo-filename">{{ photo.filename }}</span>
                    <span class="photo-date">
                      {{ photo.uploadedAt | date:'short' }}
                    </span>
                  </div>
                </div>

                <!-- Photo Actions -->
                @if (editable) {
                  <div class="photo-actions">
                    <button 
                      class="action-btn view-btn"
                      (click)="openPhotoModal(photo)"
                      [attr.aria-label]="'photos.viewPhoto' | translate"
                      type="button">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    <button 
                      class="action-btn edit-btn"
                      (click)="editPhoto(photo)"
                      [attr.aria-label]="'photos.editPhoto' | translate"
                      type="button">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button 
                      class="action-btn delete-btn"
                      (click)="confirmDelete(photo)"
                      [attr.aria-label]="'photos.deletePhoto' | translate"
                      type="button">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>
          }
          
          @empty {
            <div class="empty-gallery">
              <svg class="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="text-gray-400 text-center">
                {{ selectedCategory() ? ('photos.noCategoryPhotos' | translate) : ('photos.noPhotos' | translate) }}
              </p>
            </div>
          }
        </div>
      } @else if (!loading) {
        <div class="empty-state glass-card">
          <div class="empty-content">
            <svg class="w-20 h-20 text-gray-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            
            <h3 class="text-white text-lg font-semibold mb-2">
              {{ 'photos.noPhotosYet' | translate }}
            </h3>
            
            <p class="text-gray-300 text-center mb-6 max-w-md">
              {{ 'photos.startUploading' | translate }}
            </p>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (loading) {
        <div class="gallery-loading glass-card">
          <div class="loading-content">
            <svg class="animate-spin w-8 h-8 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-300">{{ 'photos.loadingPhotos' | translate }}</p>
          </div>
        </div>
      }

      <!-- Photo Modal -->
      @if (selectedPhoto()) {
        <div class="photo-modal-overlay" 
             (click)="closePhotoModal()"
             role="dialog" 
             aria-modal="true"
             [attr.aria-label]="'photos.photoModal' | translate">
          
          <div class="photo-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-white font-semibold">
                {{ selectedPhoto()?.description || ('photos.photoDetails' | translate) }}
              </h3>
              <button 
                class="close-btn"
                (click)="closePhotoModal()"
                [attr.aria-label]="'photos.closeModal' | translate">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="modal-body">
              <img 
                [src]="selectedPhoto()?.url"
                [alt]="selectedPhoto()?.description || 'Photo'"
                class="modal-image">
              
              <div class="photo-details-panel">
                <div class="detail-row">
                  <span class="detail-label">{{ 'photos.category' | translate }}:</span>
                  <span class="detail-value">{{ ('photos.categories.' + selectedPhoto()?.category) | translate }}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">{{ 'photos.filename' | translate }}:</span>
                  <span class="detail-value">{{ selectedPhoto()?.filename }}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">{{ 'photos.uploaded' | translate }}:</span>
                  <span class="detail-value">{{ selectedPhoto()?.uploadedAt | date:'medium' }}</span>
                </div>
                
                @if (selectedPhoto()?.description) {
                  <div class="detail-row">
                    <span class="detail-label">{{ 'photos.description' | translate }}:</span>
                    <span class="detail-value">{{ selectedPhoto()?.description }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (photoToDelete()) {
        <div class="delete-modal-overlay" 
             role="dialog" 
             aria-modal="true"
             [attr.aria-label]="'photos.deleteConfirmation' | translate">
          
          <div class="delete-modal glass-card">
            <div class="modal-header">
              <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 class="text-white font-semibold ml-3">
                {{ 'photos.confirmDelete' | translate }}
              </h3>
            </div>
            
            <div class="modal-body">
              <p class="text-gray-300 mb-6">
                {{ 'photos.deleteWarning' | translate }}
              </p>
              
              <div class="modal-actions">
                <button 
                  class="btn-secondary"
                  (click)="cancelDelete()">
                  {{ 'photos.cancel' | translate }}
                </button>
                
                <button 
                  class="btn-danger"
                  (click)="deletePhoto()">
                  {{ 'photos.delete' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Gallery Container */
    .photo-gallery-container {
      width: 100%;
      margin-top: 2rem;
    }

    /* Gallery Header */
    .gallery-header {
      margin-bottom: 1.5rem;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .gallery-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .gallery-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .photo-count {
      color: #9ca3af;
      font-size: 0.875rem;
    }

    .category-filter {
      background: rgba(31, 41, 55, 0.8);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 0.5rem;
      color: #ffffff;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      min-width: 140px;
    }

    .category-filter:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .category-filter option {
      background: #1f2937;
      color: #ffffff;
    }

    /* Photo Grid */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .photo-item {
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 1rem;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .photo-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
    }

    /* Photo Container */
    .photo-container {
      position: relative;
      aspect-ratio: 4/3;
      overflow: hidden;
    }

    .photo-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
      transition: transform 0.3s ease;
    }

    .photo-image:hover {
      transform: scale(1.05);
    }

    .photo-image:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    /* Category Badge */
    .category-badge {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      color: #ffffff;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .category-badge[data-category="before"] {
      background: rgba(59, 130, 246, 0.9);
    }

    .category-badge[data-category="during"] {
      background: rgba(245, 158, 11, 0.9);
    }

    .category-badge[data-category="after"] {
      background: rgba(34, 197, 94, 0.9);
    }

    .category-badge[data-category="diagnostic"] {
      background: rgba(168, 85, 247, 0.9);
    }

    .category-badge[data-category="damage"] {
      background: rgba(239, 68, 68, 0.9);
    }

    .category-badge[data-category="parts"] {
      background: rgba(107, 114, 128, 0.9);
    }

    .category-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
    }

    .category-text {
      white-space: nowrap;
    }

    /* Photo Loading */
    .photo-loading {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Photo Info */
    .photo-info {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .photo-details {
      flex: 1;
      min-width: 0;
    }

    .photo-description {
      color: #ffffff;
      font-weight: 500;
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }

    .photo-meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .photo-filename {
      color: #d1d5db;
      font-size: 0.75rem;
      font-weight: 500;
      truncate: true;
    }

    .photo-date {
      color: #9ca3af;
      font-size: 0.75rem;
    }

    /* Photo Actions */
    .photo-actions {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .action-btn {
      background: rgba(75, 85, 99, 0.3);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 0.5rem;
      color: #d1d5db;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn:hover {
      background: rgba(75, 85, 99, 0.5);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .action-btn:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .view-btn:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
      color: #60a5fa;
    }

    .edit-btn:hover {
      background: rgba(245, 158, 11, 0.2);
      border-color: #f59e0b;
      color: #fbbf24;
    }

    .delete-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #f87171;
    }

    /* Empty States */
    .empty-gallery,
    .empty-state {
      text-align: center;
      grid-column: 1 / -1;
      padding: 3rem 2rem;
    }

    .empty-content {
      max-width: 400px;
      margin: 0 auto;
    }

    /* Loading State */
    .gallery-loading {
      padding: 3rem 2rem;
    }

    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* Photo Modal */
    .photo-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .photo-modal {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 1rem;
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(75, 85, 99, 0.3);
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      color: #ffffff;
      background: rgba(75, 85, 99, 0.3);
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      max-height: calc(90vh - 120px);
      overflow: auto;
    }

    .modal-image {
      width: 100%;
      max-height: 60vh;
      object-fit: contain;
      background: #000000;
    }

    .photo-details-panel {
      padding: 1.5rem;
      background: rgba(31, 41, 55, 0.8);
      border-top: 1px solid rgba(75, 85, 99, 0.3);
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(75, 85, 99, 0.2);
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      color: #9ca3af;
      font-size: 0.875rem;
      font-weight: 500;
      flex-shrink: 0;
    }

    .detail-value {
      color: #d1d5db;
      font-size: 0.875rem;
      text-align: right;
      word-break: break-word;
    }

    /* Delete Modal */
    .delete-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
      padding: 1rem;
    }

    .delete-modal {
      max-width: 400px;
      width: 100%;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .photo-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 1rem;
      }

      .header-content {
        flex-direction: column;
        align-items: stretch;
      }

      .gallery-stats {
        justify-content: space-between;
      }

      .photo-info {
        flex-direction: column;
        gap: 0.75rem;
      }

      .photo-actions {
        align-self: flex-start;
      }

      .modal-body {
        max-height: calc(90vh - 100px);
      }

      .photo-details-panel {
        padding: 1rem;
      }
    }

    @media (max-width: 480px) {
      .photo-grid {
        grid-template-columns: 1fr;
      }

      .photo-modal {
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
      }

      .modal-image {
        max-height: 50vh;
      }

      .category-filter {
        width: 100%;
      }
    }

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .photo-item {
        border-width: 2px;
        border-color: #ffffff;
      }

      .category-badge {
        background: #000000;
        border: 1px solid #ffffff;
      }

      .action-btn {
        border-width: 2px;
        border-color: #ffffff;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .photo-item,
      .photo-image,
      .action-btn,
      .close-btn {
        transition: none;
      }

      .photo-item:hover,
      .photo-image:hover,
      .action-btn:hover {
        transform: none;
      }
    }

    /* Touch Devices */
    @media (pointer: coarse) {
      .action-btn {
        padding: 0.75rem;
        min-width: 44px;
        min-height: 44px;
      }

      .close-btn {
        padding: 0.75rem;
        min-width: 44px;
        min-height: 44px;
      }

      .category-filter {
        padding: 0.75rem;
        min-height: 44px;
      }
    }

    /* RTL Support */
    [dir="rtl"] .category-badge {
      right: 0.5rem;
      left: auto;
    }

    [dir="rtl"] .header-content {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .gallery-stats {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .photo-info {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .detail-row {
      flex-direction: row-reverse;
      text-align: left;
    }

    [dir="rtl"] .detail-value {
      text-align: left;
    }

    /* Focus Visible Support */
    .photo-image:focus-visible,
    .action-btn:focus-visible,
    .close-btn:focus-visible,
    .category-filter:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  `]
})
export class PhotoGalleryComponent {
  @Input() photos: MaintenancePhoto[] = [];
  @Input() loading: boolean = false;
  @Input() editable: boolean = true;

  @Output() photoDeleted = new EventEmitter<string>();
  @Output() photoUpdated = new EventEmitter<MaintenancePhoto>();
  @Output() photoSelected = new EventEmitter<MaintenancePhoto>();

  private fb = inject(FormBuilder);

  // Component state
  selectedCategory = signal<PhotoCategory | ''>('');
  selectedPhoto = signal<MaintenancePhoto | null>(null);
  photoToDelete = signal<MaintenancePhoto | null>(null);
  editingPhoto = signal<MaintenancePhoto | null>(null);

  // Computed properties
  availableCategories = computed(() => {
    const categories = new Set(this.photos.map(photo => photo.category));
    return Array.from(categories).map(category => ({
      value: category,
      label: `photos.categories.${category}`
    }));
  });

  filteredPhotos = computed(() => {
    const category = this.selectedCategory();
    if (!category) return this.photos;
    return this.photos.filter(photo => photo.category === category);
  });

  // Event handlers
  onCategoryFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value as PhotoCategory | '');
  }

  openPhotoModal(photo: MaintenancePhoto): void {
    this.selectedPhoto.set(photo);
    this.photoSelected.emit(photo);
  }

  closePhotoModal(): void {
    this.selectedPhoto.set(null);
  }

  editPhoto(photo: MaintenancePhoto): void {
    // In a real implementation, this would open an edit modal
    console.log('Edit photo:', photo);
  }

  confirmDelete(photo: MaintenancePhoto): void {
    this.photoToDelete.set(photo);
  }

  deletePhoto(): void {
    const photo = this.photoToDelete();
    if (photo) {
      this.photoDeleted.emit(photo.id);
      this.photoToDelete.set(null);
    }
  }

  cancelDelete(): void {
    this.photoToDelete.set(null);
  }
}