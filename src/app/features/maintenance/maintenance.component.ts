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
    <!-- Maintenance Main Container -->
    <div class="min-h-screen maintenance-container p-4 lg:p-6">
      
      <!-- Header Section -->
      <header class="glass-card maintenance-header">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl lg:text-3xl font-bold text-white mb-1">
              {{ getPageTitle() }}
            </h1>
            <p class="text-gray-300">{{ getPageDescription() }}</p>
          </div>

          <div class="flex items-center gap-3">
            <!-- Filter Toggle Button -->
            <button class="btn-filter-toggle" [class.active]="showFilters()" (click)="showFilters.set(!showFilters())">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filters</span>
            </button>

            <!-- Add Job Button -->
            <button class="btn-primary" (click)="createNewJob()">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Job</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Filters -->
      <div *ngIf="showFilters()" class="glass-card filters-panel">
        <app-maintenance-filters
          [filters]="filters()"
          (filtersChange)="onFiltersChange($event)">
        </app-maintenance-filters>
      </div>

      <!-- Stats Overview -->
      <div class="glass-card">
        <app-maintenance-stats 
          [stats]="stats()"
          [view]="currentView()">
        </app-maintenance-stats>
      </div>

      <!-- Jobs List -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-white">
            {{ getJobsTitle() }} ({{ filteredJobs().length }})
          </h2>
          
          <!-- View Toggle - Hidden on mobile, shown on desktop -->
          <div class="view-toggle" [class.hidden]="isMobile()">
            @for (view of viewOptions; track view.value) {
              <button
                class="view-toggle-btn"
                [class.active]="currentView() === view.value"
                (click)="setView(view.value)">
                {{ view.label }}
              </button>
            }
          </div>
        </div>

        <!-- No Jobs Message -->
        @if (filteredJobs().length === 0) {
          <div class="empty-state text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-white">No maintenance jobs</h3>
            <p class="mt-1 text-sm text-gray-300">Use the "New Job" button in the top right to create a new maintenance job.</p>
          </div>
        } @else {
          <!-- Jobs Grid -->
          <div class="grid gap-4" [class]="getGridClasses()">
            @for (job of filteredJobs(); track job.id) {
              <app-maintenance-job-card
                [job]="job"
                [view]="getViewForCard()"
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
    /* Maintenance Component - Permanent Dark Glassmorphism to match other screens */
    
    .maintenance-container {
      min-height: 100vh;
      background: transparent;
    }

    /* Glass card styling to match other screens */
    .glass-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-bottom: 1rem;
    }

    .glass-card:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    /* Header styling */
    .maintenance-header {
      /* Uses glass-card styles */
    }

    /* Component uses global button system from /src/styles/buttons.css */

    /* Filters panel styling */
    .filters-panel {
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.4);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .filters-panel:hover {
      transform: translateY(-2px);
      background: rgba(31, 41, 55, 0.95);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }

    /* View toggle styling */
    .view-toggle {
      display: flex;
      background: rgba(31, 41, 55, 0.6);
      border-radius: 12px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    /* Ensure hidden class works properly */
    .view-toggle.hidden {
      display: none !important;
    }

    .view-toggle-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.2s ease;
      color: #9ca3af;
      cursor: pointer;
    }

    .view-toggle-btn.active {
      background: rgba(59, 130, 246, 0.8);
      color: white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .view-toggle-btn:not(.active):hover {
      background: rgba(75, 85, 99, 0.4);
      color: #d1d5db;
    }

    /* Empty state styling */
    .empty-state h3 {
      color: #ffffff !important;
    }

    .empty-state p {
      color: #d1d5db !important;
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
  isMobile = signal(false);

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
    this.checkMobileView();
    
    // Set initial view based on route
    const segment = this.route.snapshot.url[1]?.path;
    if (segment) {
      this.setViewFromRoute(segment);
    }

    // Listen for window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkMobileView());
    }
  }

  private checkMobileView() {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth < 1024);
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

  getGridClasses(): string {
    // Always use list view on mobile (single column)
    // Use current view setting on desktop
    return this.isMobile() 
      ? 'grid-cols-1' 
      : (this.currentView() === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1');
  }

  getViewForCard(): 'list' | 'grid' {
    // Always use list view on mobile
    // Use current view setting on desktop
    return this.isMobile() ? 'list' : this.currentView();
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