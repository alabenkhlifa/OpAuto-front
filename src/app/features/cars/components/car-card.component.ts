import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { CarWithHistory } from '../services/car.service';

@Component({
  selector: 'app-car-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="car-card" (click)="onCardClick()">
      <!-- Car Header -->
      <div class="car-header">
        <div class="car-image" 
             [attr.aria-label]="'Vehicle image for ' + car.make + ' ' + car.model"
             role="img">
          <svg class="w-8 h-8 text-gray-400" 
               fill="currentColor" 
               viewBox="0 0 24 24"
               [attr.alt]="car.make + ' ' + car.model + ' vehicle icon'">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
        <div class="car-info">
          <h3 class="car-title">{{ car.make }} {{ car.model }}</h3>
          <p class="car-year">{{ car.year }}</p>
        </div>
        <div class="status-badge" 
             [ngClass]="getStatusBadgeClass(car.serviceStatus)"
             [attr.aria-label]="'Service status: ' + getStatusLabel(car.serviceStatus)"
             role="status">
          {{ getStatusLabel(car.serviceStatus) }}
        </div>
      </div>
      
      <!-- License Plate -->
      <div class="license-plate">
        {{ car.licensePlate }}
      </div>
      
      <!-- Customer Info -->
      <div class="customer-section">
        <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span class="font-medium">{{ customerName }}</span>
        </div>
      </div>
      
      <!-- Service Stats -->
      <div class="service-stats">
        <div class="stat-row">
          <span class="stat-label">{{ 'cars.mileage' | translate }}:</span>
          <span class="stat-value">{{ formatMileage(car.currentMileage) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ 'cars.totalServices' | translate }}:</span>
          <span class="stat-value">{{ car.totalServices }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ 'cars.lastService' | translate }}:</span>
          <span class="stat-value">{{ formatDate(car.lastServiceDate) }}</span>
        </div>
        @if (car.nextServiceDue) {
          <div class="stat-row">
            <span class="stat-label">{{ 'cars.nextDue' | translate }}:</span>
            <span class="stat-value" [ngClass]="getDateColor(car.nextServiceDue)">
              {{ formatDate(car.nextServiceDue) }}
            </span>
          </div>
        }
      </div>
      
      <!-- Quick Actions -->
      <div class="card-actions">
        <button class="action-btn primary" 
                (click)="onScheduleClick($event)"
                [attr.aria-label]="'Schedule service for ' + car.make + ' ' + car.model"
                type="button">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="action-text">{{ 'cars.schedule' | translate }}</span>
        </button>
        <button class="action-btn secondary" 
                (click)="onHistoryClick($event)"
                [attr.aria-label]="'View service history for ' + car.make + ' ' + car.model"
                type="button">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="action-text">{{ 'cars.history' | translate }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* Car Card - Permanent Dark Glassmorphism Design to match appointments */
    .car-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      margin-bottom: 1rem;
    }

    .car-card:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    .car-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .car-image {
      flex-shrink: 0;
      width: 3rem;
      height: 3rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(29, 78, 216, 0.1));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(59, 130, 246, 0.2);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .car-image::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
      transform: translateX(-100%) translateY(-100%);
      transition: transform 0.6s ease;
    }

    .car-card:hover .car-image::before {
      transform: translateX(0) translateY(0);
    }

    .car-image svg {
      width: 1.5rem;
      height: 1.5rem;
      color: #3b82f6;
      transition: all 0.3s ease;
      z-index: 1;
    }

    .car-card:hover .car-image {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(29, 78, 216, 0.15));
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }

    .car-card:hover .car-image svg {
      color: #60a5fa;
      transform: scale(1.1);
    }

    .car-info {
      flex: 1;
      min-width: 0;
    }

    .car-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0;
      line-height: 1.2;
    }

    .car-year {
      font-size: 0.875rem;
      color: #9ca3af;
      margin: 0;
    }

    .status-badge {
      padding: 0.375rem 0.875rem;
      border-radius: 16px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 2px solid;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }

    .status-badge::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s ease;
    }

    .car-card:hover .status-badge::before {
      left: 100%;
    }

    .status-badge::after {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.2);
      }
    }

    .license-plate {
      background: linear-gradient(135deg, #1f2937, #374151);
      color: white;
      padding: 0.75rem;
      border-radius: 8px;
      text-align: center;
      font-family: 'Courier New', monospace;
      font-size: 1.125rem;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 1rem;
      border: 2px solid #4b5563;
    }

    .customer-section {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .customer-section span {
      color: #ffffff;
    }

    .service-stats {
      margin-bottom: 1rem;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .stat-label {
      color: #9ca3af;
    }

    .stat-value {
      font-weight: 600;
      color: #ffffff;
    }

    .card-actions {
      display: flex;
      gap: 0.75rem;
    }

    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 44px; /* Touch-friendly minimum height */
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid;
      backdrop-filter: blur(20px);
      cursor: pointer;
      position: relative;
      outline: none;
    }

    /* Focus management for accessibility */
    .action-btn:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .action-btn {
        border-width: 2px;
        box-shadow: 0 0 0 1px currentColor;
      }
      
      .status-badge {
        border-width: 2px;
        font-weight: 700;
      }
    }

    /* Responsive text display */
    .action-text {
      transition: opacity 0.2s ease;
    }

    @media (max-width: 375px) {
      .action-text {
        display: none;
      }
      
      .action-btn {
        min-width: 44px;
        padding: 0.75rem;
      }
    }

    @media (min-width: 376px) {
      .action-text {
        display: inline;
      }
    }

    /* Schedule button - green to match appointment complete button */
    .action-btn.primary {
      background: linear-gradient(135deg, #059669, #047857);
      border-color: #059669;
      color: white;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .action-btn.primary:hover {
      background: linear-gradient(135deg, #047857, #065f46);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
      transform: translateY(-1px);
    }

    /* History button - orange to match appointment edit button */
    .action-btn.secondary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border-color: #f59e0b;
      color: white;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .action-btn.secondary:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    /* Responsive Scaling */
    @media (max-width: 375px) {
      .car-image {
        width: 2.5rem;
        height: 2.5rem;
      }

      .car-image svg {
        width: 1.25rem;
        height: 1.25rem;
      }

      .status-badge {
        font-size: 0.625rem;
        padding: 0.25rem 0.625rem;
      }

      .status-badge::after {
        width: 4px;
        height: 4px;
      }
    }

    @media (min-width: 768px) {
      .car-image {
        width: 3.5rem;
        height: 3.5rem;
      }

      .car-image svg {
        width: 1.75rem;
        height: 1.75rem;
      }

      .status-badge {
        font-size: 0.8125rem;
        padding: 0.5rem 1rem;
      }
    }

    @media (min-width: 1280px) {
      .car-image {
        width: 4rem;
        height: 4rem;
      }

      .car-image svg {
        width: 2rem;
        height: 2rem;
      }
    }

    /* RTL Layout Support */
    :host-context([dir="rtl"]) .car-header {
      flex-direction: row-reverse;
    }

    :host-context([dir="rtl"]) .customer-section .flex {
      flex-direction: row-reverse;
    }

    :host-context([dir="rtl"]) .stat-row {
      flex-direction: row-reverse;
      text-align: right;
    }

    :host-context([dir="rtl"]) .card-actions {
      flex-direction: row-reverse;
    }

    :host-context([dir="rtl"]) .action-btn {
      flex-direction: row-reverse;
    }

    /* Arabic text alignment */
    :host-context([dir="rtl"]) .car-title,
    :host-context([dir="rtl"]) .car-year,
    :host-context([dir="rtl"]) .stat-label,
    :host-context([dir="rtl"]) .stat-value,
    :host-context([dir="rtl"]) .legend-text {
      text-align: right;
    }
  `]
})
export class CarCardComponent {
  private translationService = inject(TranslationService);
  
  @Input() car!: CarWithHistory;
  @Input() customerName!: string;
  
  @Output() carSelected = new EventEmitter<CarWithHistory>();
  @Output() scheduleService = new EventEmitter<CarWithHistory>();
  @Output() viewHistory = new EventEmitter<CarWithHistory>();

  onCardClick(): void {
    this.carSelected.emit(this.car);
  }

  onScheduleClick(event: Event): void {
    event.stopPropagation();
    this.scheduleService.emit(this.car);
  }

  onHistoryClick(event: Event): void {
    event.stopPropagation();
    this.viewHistory.emit(this.car);
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      'up-to-date': 'badge badge-up-to-date',
      'due-soon': 'badge badge-due-soon', 
      'overdue': 'badge badge-overdue'
    };
    return classes[status as keyof typeof classes] || 'badge badge-unknown';
  }

  getStatusLabel(status: string): string {
    const labels = {
      'up-to-date': this.translationService.instant('cars.upToDate'),
      'due-soon': this.translationService.instant('cars.dueSoon'),
      'overdue': this.translationService.instant('cars.overdue')
    };
    return labels[status as keyof typeof labels] || this.translationService.instant('cars.unknown');
  }

  getDateColor(date: Date | undefined): string {
    if (!date) return '';
    
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-red-600 dark:text-red-400'; // Overdue
    if (diffDays <= 7) return 'text-amber-600 dark:text-amber-400'; // Due soon
    return 'text-green-600 dark:text-green-400'; // Future
  }

  formatMileage(mileage: number): string {
    return new Intl.NumberFormat('en-US').format(mileage) + ' km';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
}