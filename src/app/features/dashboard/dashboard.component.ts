import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';

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
  imports: [CommonModule, ThemeToggleComponent, LanguageToggleComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
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
      'scheduled': 'bg-primary-100 text-primary-700 border-primary-200',
      'in_progress': 'bg-secondary-100 text-secondary-700 border-secondary-200',
      'completed': 'bg-success-100 text-success-700 border-success-200',
      'delayed': 'bg-error-100 text-error-700 border-error-200',
      'diagnosis': 'bg-blue-100 text-blue-700 border-blue-200',
      'waiting_parts': 'bg-warning-100 text-warning-700 border-warning-200',
      'in_repair': 'bg-secondary-100 text-secondary-700 border-secondary-200',
      'quality_check': 'bg-purple-100 text-purple-700 border-purple-200',
      'waiting_approval': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-700 border-gray-200';
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
}