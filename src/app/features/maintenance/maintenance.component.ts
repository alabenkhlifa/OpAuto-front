import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { MaintenanceJob, MaintenanceFilters, MaintenanceStats } from '../../core/models/maintenance.model';
import { MaintenanceJobCardComponent } from './components/maintenance-job-card.component';
import { MaintenanceStatsComponent } from './components/maintenance-stats.component';
import { MaintenanceFiltersComponent } from './components/maintenance-filters.component';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    MaintenanceJobCardComponent,
    MaintenanceStatsComponent,
    MaintenanceFiltersComponent
  ],
  template: `
    <div class="p-6 space-y-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ getPageTitle() }}
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ getPageDescription() }}
          </p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
          <button 
            class="btn-secondary"
            (click)="showFilters.set(!showFilters())">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span class="hidden sm:inline">Filters</span>
          </button>
          <button 
            class="btn-primary"
            (click)="createNewJob()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">New Job</span>
          </button>
        </div>
      </div>

      <!-- Stats Overview -->
      <app-maintenance-stats 
        [stats]="stats()"
        [view]="currentView()">
      </app-maintenance-stats>

      <!-- Filters -->
      <app-maintenance-filters
        *ngIf="showFilters()"
        [filters]="filters()"
        (filtersChange)="onFiltersChange($event)">
      </app-maintenance-filters>

      <!-- Jobs List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ getJobsTitle() }} ({{ filteredJobs().length }})
          </h2>
          
          <!-- View Toggle -->
          <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            @for (view of viewOptions; track view.value) {
              <button
                class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                [class]="currentView() === view.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
                (click)="setView(view.value)">
                {{ view.label }}
              </button>
            }
          </div>
        </div>

        <!-- No Jobs Message -->
        @if (filteredJobs().length === 0) {
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No maintenance jobs</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new maintenance job.</p>
            <div class="mt-6">
              <button class="btn-primary" (click)="createNewJob()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Maintenance Job
              </button>
            </div>
          </div>
        } @else {
          <!-- Jobs Grid -->
          <div class="grid gap-4" [class]="currentView() === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'">
            @for (job of filteredJobs(); track job.id) {
              <app-maintenance-job-card
                [job]="job"
                [view]="currentView()"
                (statusChange)="onStatusChange($event)"
                (edit)="editJob($event)"
                (viewDetails)="viewJob($event)">
              </app-maintenance-job-card>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .btn-primary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #2563eb;
      gap: 0.5rem;
    }
    
    .btn-primary:hover {
      background-color: #1d4ed8;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
      gap: 0.5rem;
    }
    
    .btn-secondary:hover {
      background-color: #f9fafb;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover {
      background-color: #374151;
    }
  `]
})
export class MaintenanceComponent implements OnInit {
  private maintenanceService = inject(MaintenanceService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Signals
  maintenanceJobs = signal<MaintenanceJob[]>([]);
  stats = signal<MaintenanceStats | null>(null);
  filters = signal<MaintenanceFilters>({});
  showFilters = signal(false);
  currentView = signal<'list' | 'grid'>('grid');
  loading = signal(false);

  // View options
  viewOptions = [
    { value: 'grid' as const, label: 'Grid' },
    { value: 'list' as const, label: 'List' }
  ];

  // Computed
  filteredJobs = computed(() => {
    const jobs = this.maintenanceJobs();
    const filterConfig = this.filters();
    const viewFilter = this.getViewFilter();
    
    let filtered = jobs.filter(job => {
      if (viewFilter.status && !viewFilter.status.includes(job.status)) {
        return false;
      }
      return true;
    });

    return this.applyAdditionalFilters(filtered, filterConfig);
  });

  ngOnInit() {
    this.loadMaintenanceData();
    this.loadStats();
    
    // Set initial view based on route
    const segment = this.route.snapshot.url[1]?.path;
    if (segment) {
      this.setViewFromRoute(segment);
    }
  }

  private loadMaintenanceData() {
    this.loading.set(true);
    this.maintenanceService.getMaintenanceJobs(this.filters()).subscribe({
      next: (jobs) => {
        this.maintenanceJobs.set(jobs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading maintenance jobs:', error);
        this.loading.set(false);
      }
    });
  }

  private loadStats() {
    this.maintenanceService.getMaintenanceStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (error) => console.error('Error loading stats:', error)
    });
  }

  private setViewFromRoute(segment: string) {
    switch (segment) {
      case 'active':
        this.filters.set({ status: ['waiting', 'in-progress', 'waiting-approval', 'waiting-parts'] });
        break;
      case 'history':
        this.filters.set({ status: ['completed'] });
        this.currentView.set('list');
        break;
      case 'schedule':
        this.filters.set({ status: ['waiting'] });
        break;
    }
  }

  private getViewFilter() {
    const segment = this.route.snapshot.url[1]?.path;
    switch (segment) {
      case 'active':
        return { status: ['waiting', 'in-progress', 'waiting-approval', 'waiting-parts'] };
      case 'history':
        return { status: ['completed', 'cancelled'] };
      case 'schedule':
        return { status: ['waiting'] };
      default:
        return {};
    }
  }

  private applyAdditionalFilters(jobs: MaintenanceJob[], filters: MaintenanceFilters): MaintenanceJob[] {
    return jobs.filter(job => {
      if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(job.priority)) {
        return false;
      }
      if (filters.mechanicId && job.mechanicId !== filters.mechanicId) {
        return false;
      }
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchableText = [job.jobTitle, job.description, job.licensePlate, job.customerName].join(' ').toLowerCase();
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }

  getPageTitle(): string {
    const segment = this.route.snapshot.url[1]?.path;
    switch (segment) {
      case 'active': return 'Active Maintenance Jobs';
      case 'history': return 'Maintenance History';
      case 'schedule': return 'Scheduled Maintenance';
      default: return 'Maintenance Management';
    }
  }

  getPageDescription(): string {
    const segment = this.route.snapshot.url[1]?.path;
    switch (segment) {
      case 'active': return 'Monitor ongoing repairs and services';
      case 'history': return 'View completed maintenance records';
      case 'schedule': return 'Manage upcoming maintenance appointments';
      default: return 'Manage vehicle maintenance and repairs';
    }
  }

  getJobsTitle(): string {
    const segment = this.route.snapshot.url[1]?.path;
    switch (segment) {
      case 'active': return 'Active Jobs';
      case 'history': return 'Completed Jobs';
      case 'schedule': return 'Scheduled Jobs';
      default: return 'All Jobs';
    }
  }

  setView(view: 'list' | 'grid') {
    this.currentView.set(view);
  }

  onFiltersChange(newFilters: MaintenanceFilters) {
    this.filters.set(newFilters);
    this.loadMaintenanceData();
  }

  onStatusChange(event: { jobId: string; status: any }) {
    this.maintenanceService.updateJobStatus(event.jobId, event.status).subscribe({
      next: () => this.loadMaintenanceData(),
      error: (error) => console.error('Error updating job status:', error)
    });
  }

  createNewJob() {
    this.router.navigate(['/maintenance/new']);
  }

  editJob(jobId: string) {
    this.router.navigate(['/maintenance/edit', jobId]);
  }

  viewJob(jobId: string) {
    this.router.navigate(['/maintenance/details', jobId]);
  }
}