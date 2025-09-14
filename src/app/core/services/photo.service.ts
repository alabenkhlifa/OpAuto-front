import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { SubscriptionService } from './subscription.service';
import { MaintenancePhoto, PhotoCategory } from '../models/maintenance.model';

export interface PhotoUploadConfig {
  maxPhotosPerJob: number;
  maxFileSize: number; // MB
  allowedFormats: string[];
  requiresTier: 'professional';
}

export interface PhotoUploadError {
  code: 'TIER_REQUIRED' | 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'LIMIT_EXCEEDED' | 'UPLOAD_FAILED';
  message: string;
  requiredTier?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private readonly uploadConfig: PhotoUploadConfig = {
    maxPhotosPerJob: 20,
    maxFileSize: 10, // 10MB
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    requiresTier: 'professional'
  };

  private mockPhotos = signal<MaintenancePhoto[]>([
    {
      id: 'photo-001',
      url: 'https://via.placeholder.com/300x200/1f2937/ffffff?text=Engine+Before',
      filename: 'engine-before.jpg',
      description: 'Engine condition before maintenance',
      category: 'before',
      uploadedAt: new Date('2024-01-15T10:30:00'),
      uploadedBy: 'mechanic-001'
    },
    {
      id: 'photo-002',
      url: 'https://via.placeholder.com/300x200/dc2626/ffffff?text=Brake+Issue',
      filename: 'brake-pads.jpg',
      description: 'Worn brake pads requiring replacement',
      category: 'diagnostic',
      uploadedAt: new Date('2024-01-15T11:15:00'),
      uploadedBy: 'mechanic-001'
    },
    {
      id: 'photo-003',
      url: 'https://via.placeholder.com/300x200/059669/ffffff?text=Repair+Complete',
      filename: 'repair-complete.jpg',
      description: 'Repair completed successfully',
      category: 'after',
      uploadedAt: new Date('2024-01-15T14:45:00'),
      uploadedBy: 'mechanic-001'
    }
  ]);

  private uploadingSignal = signal(false);
  private errorSignal = signal<PhotoUploadError | null>(null);

  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * Check if user has photo upload access
   */
  hasPhotoAccess(): Observable<boolean> {
    return this.subscriptionService.isFeatureEnabled('photos_documentation');
  }

  /**
   * Get upload configuration
   */
  getUploadConfig(): PhotoUploadConfig {
    return { ...this.uploadConfig };
  }

  /**
   * Get photos for a maintenance job
   */
  getPhotosByJobId(jobId: string): Observable<MaintenancePhoto[]> {
    return this.hasPhotoAccess().pipe(
      switchMap(hasAccess => {
        if (!hasAccess) {
          return throwError(() => ({
            code: 'TIER_REQUIRED',
            message: 'photos.errors.tierRequired',
            requiredTier: 'professional'
          } as PhotoUploadError));
        }
        
        // Mock filtering by job ID - in real app, this would be a real filter
        return of(this.mockPhotos()).pipe(delay(300));
      })
    );
  }

  /**
   * Get all photos (for demo)
   */
  getPhotos(): Observable<MaintenancePhoto[]> {
    return of(this.mockPhotos()).pipe(delay(200));
  }

  /**
   * Upload photos with tier validation
   */
  uploadPhotos(files: File[], jobId: string, category: PhotoCategory, descriptions?: string[]): Observable<MaintenancePhoto[]> {
    return this.hasPhotoAccess().pipe(
      switchMap(hasAccess => {
        if (!hasAccess) {
          const error: PhotoUploadError = {
            code: 'TIER_REQUIRED',
            message: 'photos.errors.tierRequired',
            requiredTier: 'professional'
          };
          this.errorSignal.set(error);
          return throwError(() => error);
        }

        // Validate files
        const validationError = this.validateFiles(files);
        if (validationError) {
          this.errorSignal.set(validationError);
          return throwError(() => validationError);
        }

        // Check photo limit
        const currentCount = this.mockPhotos().length;
        if (currentCount + files.length > this.uploadConfig.maxPhotosPerJob) {
          const error: PhotoUploadError = {
            code: 'LIMIT_EXCEEDED',
            message: 'photos.errors.limitExceeded'
          };
          this.errorSignal.set(error);
          return throwError(() => error);
        }

        // Simulate upload
        this.uploadingSignal.set(true);
        this.errorSignal.set(null);

        const newPhotos: MaintenancePhoto[] = files.map((file, index) => ({
          id: `photo-${Date.now()}-${index}`,
          url: URL.createObjectURL(file),
          filename: file.name,
          description: descriptions?.[index] || `${category} photo`,
          category,
          uploadedAt: new Date(),
          uploadedBy: 'current-user'
        }));

        return of(newPhotos).pipe(
          delay(1500), // Simulate upload time
          map(photos => {
            this.uploadingSignal.set(false);
            // Add to mock storage
            this.mockPhotos.update(existing => [...existing, ...photos]);
            return photos;
          })
        );
      })
    );
  }

  /**
   * Delete photo with tier validation
   */
  deletePhoto(photoId: string): Observable<boolean> {
    return this.hasPhotoAccess().pipe(
      switchMap(hasAccess => {
        if (!hasAccess) {
          const error: PhotoUploadError = {
            code: 'TIER_REQUIRED',
            message: 'photos.errors.tierRequired',
            requiredTier: 'professional'
          };
          return throwError(() => error);
        }

        // Remove from mock storage
        this.mockPhotos.update(photos => photos.filter(p => p.id !== photoId));
        return of(true).pipe(delay(300));
      })
    );
  }

  /**
   * Update photo description
   */
  updatePhoto(photoId: string, updates: Partial<MaintenancePhoto>): Observable<MaintenancePhoto | null> {
    return this.hasPhotoAccess().pipe(
      switchMap(hasAccess => {
        if (!hasAccess) {
          const error: PhotoUploadError = {
            code: 'TIER_REQUIRED',
            message: 'photos.errors.tierRequired',
            requiredTier: 'professional'
          };
          return throwError(() => error);
        }

        let updatedPhoto: MaintenancePhoto | null = null;
        this.mockPhotos.update(photos => 
          photos.map(photo => {
            if (photo.id === photoId) {
              updatedPhoto = { ...photo, ...updates };
              return updatedPhoto;
            }
            return photo;
          })
        );

        return of(updatedPhoto).pipe(delay(200));
      })
    );
  }

  /**
   * Get photos by category
   */
  getPhotosByCategory(jobId: string, category: PhotoCategory): Observable<MaintenancePhoto[]> {
    return this.getPhotosByJobId(jobId).pipe(
      map(photos => photos.filter(photo => photo.category === category))
    );
  }

  /**
   * Validate uploaded files
   */
  private validateFiles(files: File[]): PhotoUploadError | null {
    for (const file of files) {
      // Check file size
      if (file.size > this.uploadConfig.maxFileSize * 1024 * 1024) {
        return {
          code: 'FILE_TOO_LARGE',
          message: 'photos.errors.fileTooLarge'
        };
      }

      // Check file format
      if (!this.uploadConfig.allowedFormats.includes(file.type)) {
        return {
          code: 'INVALID_FORMAT',
          message: 'photos.errors.invalidFormat'
        };
      }
    }

    return null;
  }

  /**
   * Get upload progress (for UI feedback)
   */
  get isUploading(): Observable<boolean> {
    return of(this.uploadingSignal());
  }

  /**
   * Get last upload error
   */
  get lastError(): Observable<PhotoUploadError | null> {
    return of(this.errorSignal());
  }

  /**
   * Clear upload error
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Get photo categories with labels
   */
  getPhotoCategories(): { value: PhotoCategory; label: string; icon: string }[] {
    return [
      { value: 'before', label: 'photos.categories.before', icon: 'camera' },
      { value: 'during', label: 'photos.categories.during', icon: 'tool' },
      { value: 'after', label: 'photos.categories.after', icon: 'check-circle' },
      { value: 'diagnostic', label: 'photos.categories.diagnostic', icon: 'search' },
      { value: 'damage', label: 'photos.categories.damage', icon: 'alert-triangle' },
      { value: 'parts', label: 'photos.categories.parts', icon: 'package' }
    ];
  }

  /**
   * Generate thumbnail URL (mock implementation)
   */
  generateThumbnail(photoUrl: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    // In real implementation, this would generate actual thumbnails
    const sizes = { small: '150x100', medium: '300x200', large: '600x400' };
    return photoUrl.replace('300x200', sizes[size]);
  }
}