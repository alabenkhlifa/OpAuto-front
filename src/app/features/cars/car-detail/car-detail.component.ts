import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { CarService, CarWithHistory } from '../services/car.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { MaintenanceJob } from '../../../core/models/maintenance.model';
import { CustomerService } from '../../../core/services/customer.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MaintenanceAlertsCardComponent } from '../../../shared/components/maintenance-alerts-card/maintenance-alerts-card.component';

interface HistoryRow {
  date: Date;
  title: string;
  mechanicName?: string;
  cost?: number;
}

@Component({
  selector: 'app-car-detail',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MaintenanceAlertsCardComponent],
  templateUrl: './car-detail.component.html',
  styleUrl: './car-detail.component.css',
})
export class CarDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private carService = inject(CarService);
  private maintenanceService = inject(MaintenanceService);
  private customerService = inject(CustomerService);

  carId = signal<string | null>(null);
  car = signal<CarWithHistory | null>(null);
  customerName = signal<string>('');
  history = signal<HistoryRow[]>([]);
  isLoading = signal(true);
  notFound = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.carId.set(id);

    if (!id) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    forkJoin({
      cars: this.carService.getCars(),
      jobs: this.maintenanceService.getMaintenanceJobs().pipe(catchError(() => of<MaintenanceJob[]>([]))),
      customers: this.customerService.getCustomers().pipe(catchError(() => of([] as any[]))),
    }).subscribe({
      next: ({ cars, jobs, customers }) => {
        const found = cars.find((c) => c.id === id) || null;
        this.car.set(found);

        if (!found) {
          this.notFound.set(true);
          this.isLoading.set(false);
          return;
        }

        const customer = customers.find((c: any) => c.id === found.customerId);
        this.customerName.set(
          customer ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() : '',
        );

        const rows: HistoryRow[] = jobs
          .filter((j) => j.carId === id && j.status === 'completed' && j.completionDate)
          .map((j) => ({
            date: new Date(j.completionDate as Date),
            title: j.jobTitle,
            mechanicName: j.mechanicName,
            cost: j.actualCost ?? j.estimatedCost,
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        this.history.set(rows);

        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/cars']);
  }
}
