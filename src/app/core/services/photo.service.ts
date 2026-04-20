import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, delay, map, switchMap, tap } from 'rxjs/operators';
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

  private http = inject(HttpClient);
  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * Map a backend `maintenance_photos` row to the frontend MaintenancePhoto
   * shape. Backend stores filename/mime/size separately; frontend only needs
   * url + filename + category + uploadedAt + uploadedBy + description.
   */
  private mapFromBackend(b: any): MaintenancePhoto {
    return {
      id: b.id,
      url: b.url,
      filename: b.originalName || b.filename || 'photo',
      description: b.caption || '',
      category: (b.type || 'other') as PhotoCategory,
      uploadedAt: new Date(b.createdAt),
      uploadedBy: b.uploadedBy || 'unknown',
    };
  }

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
        return this.http.get<any[]>(`/maintenance/${jobId}/photos`).pipe(
          map(rows => rows.map(r => this.mapFromBackend(r))),
        );
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

        this.uploadingSignal.set(true);
        this.errorSignal.set(null);

        // Upload each file via multipart POST. ForkJoin waits for all to
        // settle; if any fails, the whole upload is surfaced as an error
        // so the UI doesn't show a partial result.
        const uploads = files.map((file, index) => {
          const form = new FormData();
          form.append('file', file);
          form.append('type', category);
          const desc = descriptions?.[index];
          if (desc) form.append('caption', desc);
          return this.http.post<any>(`/maintenance/${jobId}/photos`, form).pipe(
            map(row => this.mapFromBackend(row)),
          );
        });

        return forkJoin(uploads).pipe(
          tap(() => this.uploadingSignal.set(false)),
          catchError(err => {
            this.uploadingSignal.set(false);
            const error: PhotoUploadError = {
              code: 'UPLOAD_FAILED',
              message: err?.error?.message || 'Upload failed',
            };
            this.errorSignal.set(error);
            return throwError(() => error);
          }),
        );
      })
    );
  }

  /**
   * Delete photo with tier validation
   */
  deletePhoto(photoId: string, jobId?: string): Observable<boolean> {
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
        if (!jobId) {
          return throwError(() => ({
            code: 'UPLOAD_FAILED',
            message: 'Cannot delete photo without jobId',
          } as PhotoUploadError));
        }
        return this.http.delete(`/maintenance/${jobId}/photos/${photoId}`).pipe(
          map(() => true),
        );
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