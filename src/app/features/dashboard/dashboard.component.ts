import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';

interface GarageMetrics {
  totalCarsToday: number;
  carsInProgress: number;
  carsCompleted: number;
  carsWaitingApproval: number;
  todayRevenue: number;
  availableSlots: number;
  totalSlots: number;
  activeMechanics: number;
}

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  carModel: string;
  licensePlate: string;
  serviceType: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'delayed';
  estimatedDuration: number; // in hours
  mechanic?: string;
}

interface ActiveJob {
  id: string;
  customerName: string;
  carModel: string;
  licensePlate: string;
  services: string[];
  startedAt: string;
  estimatedCompletion: string;
  mechanic: string;
  progress: number; // 0-100
  status: 'diagnosis' | 'waiting_parts' | 'in_repair' | 'quality_check' | 'waiting_approval';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LanguageToggleComponent, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  
  isOwner = signal(false);
  
  metrics: GarageMetrics = {
    totalCarsToday: 12,
    carsInProgress: 5,
    carsCompleted: 7,
    carsWaitingApproval: 3,
    todayRevenue: 2450.50,
    availableSlots: 2,
    totalSlots: 8,
    activeMechanics: 4
  };

  todayAppointments: TodayAppointment[] = [
    {
      id: '1',
      time: '09:00',
      customerName: 'Ahmed Ben Ali',
      carModel: 'Peugeot 308',
      licensePlate: '123TUN456',
      serviceType: 'Oil Change + Inspection',
      status: 'completed',
      estimatedDuration: 1,
      mechanic: 'Mohamed'
    },
    {
      id: '2',
      time: '10:30',
      customerName: 'Fatima Mahmoud',
      carModel: 'Renault Clio',
      licensePlate: '789TUN123',
      serviceType: 'Brake System Repair',
      status: 'in_progress',
      estimatedDuration: 3,
      mechanic: 'Khalil'
    },
    {
      id: '3',
      time: '14:00',
      customerName: 'Omar Trabelsi',
      carModel: 'BMW X3',
      licensePlate: '456TUN789',
      serviceType: 'Engine Diagnostics',
      status: 'scheduled',
      estimatedDuration: 2
    },
    {
      id: '4',
      time: '16:00',
      customerName: 'Leila Sassi',
      carModel: 'Ford Focus',
      licensePlate: '321TUN654',
      serviceType: 'Transmission Service',
      status: 'delayed',
      estimatedDuration: 4
    },
    {
      id: '5',
      time: '17:30',
      customerName: 'Sami Gharbi',
      carModel: 'Hyundai Tucson',
      licensePlate: '555TUN888',
      serviceType: 'Tire Replacement',
      status: 'scheduled',
      estimatedDuration: 1
    },
    {
      id: '6',
      time: '18:00',
      customerName: 'Nadia Khelifi',
      carModel: 'Kia Sportage',
      licensePlate: '999TUN111',
      serviceType: 'Air Conditioning Service',
      status: 'scheduled',
      estimatedDuration: 2
    },
    {
      id: '7',
      time: '19:00',
      customerName: 'Yasmine Hamdi',
      carModel: 'Nissan Qashqai',
      licensePlate: '333TUN777',
      serviceType: 'Battery Replacement',
      status: 'scheduled',
      estimatedDuration: 1
    }
  ];

  activeJobs: ActiveJob[] = [
    {
      id: '1',
      customerName: 'Fatima Mahmoud',
      carModel: 'Renault Clio',
      licensePlate: '789TUN123',
      services: ['Brake Pads', 'Brake Discs', 'Brake Fluid'],
      startedAt: '10:30',
      estimatedCompletion: '13:30',
      mechanic: 'Khalil',
      progress: 65,
      status: 'in_repair'
    },
    {
      id: '2',
      customerName: 'Sami Chaabane',
      carModel: 'Volkswagen Golf',
      licensePlate: '987TUN321',
      services: ['Engine Oil', 'Oil Filter', 'Air Filter'],
      startedAt: '11:00',
      estimatedCompletion: '12:00',
      mechanic: 'Youssef',
      progress: 90,
      status: 'quality_check'
    },
    {
      id: '3',
      customerName: 'Nadia Bouzid',
      carModel: 'Toyota Corolla',
      licensePlate: '654TUN987',
      services: ['Timing Belt', 'Water Pump'],
      startedAt: '08:00',
      estimatedCompletion: '15:00',
      mechanic: 'Hichem',
      progress: 30,
      status: 'waiting_parts'
    }
  ];

  ngOnInit(): void {
    this.loadDashboardData();
    this.isOwner.set(this.authService.isOwner());
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }


  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getCapacityPercentage(): number {
    return ((this.metrics.totalSlots - this.metrics.availableSlots) / this.metrics.totalSlots) * 100;
  }

  getStatusColor(status: string): string {
    const colors = {
      'scheduled': 'text-primary-600',
      'in_progress': 'text-secondary-600',
      'completed': 'text-success-600',
      'delayed': 'text-error-600',
      'diagnosis': 'text-blue-600',
      'waiting_parts': 'text-warning-600',
      'in_repair': 'text-secondary-600',
      'quality_check': 'text-purple-600',
      'waiting_approval': 'text-orange-600'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      'scheduled': 'badge badge-pending',
      'in_progress': 'badge badge-active',
      'completed': 'badge badge-completed',
      'delayed': 'badge badge-cancelled',
      'diagnosis': 'badge badge-active',
      'waiting_parts': 'badge badge-pending',
      'in_repair': 'badge badge-active',
      'quality_check': 'badge badge-completed',
      'waiting_approval': 'badge badge-pending'
    };
    return classes[status as keyof typeof classes] || 'badge badge-pending';
  }

  getProgressBarClass(progress: number): string {
    if (progress < 30) return 'bg-error-500';
    if (progress < 70) return 'bg-warning-500';
    return 'bg-success-500';
  }

  private loadDashboardData(): void {
    // TODO: Replace with actual API call
    // This is placeholder data for the MVP
  }

  // Quick Action Navigation Methods
  public navigateToNewCar(): void {
    this.router.navigate(['/cars']);
  }

  public navigateToAppointments(): void {
    this.router.navigate(['/appointments']);
  }

  public navigateToInvoicing(): void {
    this.router.navigate(['/invoicing']);
  }

  public navigateToQualityCheck(): void {
    this.router.navigate(['/maintenance/active']);
  }

  // New methods for redesigned components
  public getTimelineItemClass(status: string): string {
    return `timeline-item-${status.replace('_', '-')}`;
  }

  public getTimelineDotClass(status: string): string {
    const statusMap = {
      'scheduled': 'scheduled',
      'in_progress': 'in-progress',
      'completed': 'completed',
      'delayed': 'delayed'
    };
    return statusMap[status as keyof typeof statusMap] || 'scheduled';
  }

}