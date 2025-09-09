import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

const routes: Routes = [
  // Production: redirect to auth, Development: redirect to dashboard
  { 
    path: '', 
    redirectTo: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? '/dashboard'  // Development
      : '/auth',      // Production 
    pathMatch: 'full' 
  },
  { 
    path: 'auth', 
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    canActivate: [guestGuard]
  },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'appointments', 
    loadComponent: () => import('./features/appointments/appointments.component').then(m => m.AppointmentsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'cars', 
    loadComponent: () => import('./features/cars/cars.component').then(m => m.CarsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'inventory', 
    loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'invoices', 
    loadComponent: () => import('./features/invoicing/invoicing.component').then(m => m.InvoicingComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'invoices/create', 
    loadComponent: () => import('./features/invoicing/components/invoice-form.component').then(m => m.InvoiceFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'invoices/edit/:id', 
    loadComponent: () => import('./features/invoicing/components/invoice-form.component').then(m => m.InvoiceFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'invoices/pending', 
    loadComponent: () => import('./features/invoicing/invoicing.component').then(m => m.InvoicingComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'invoices/:id', 
    loadComponent: () => import('./features/invoicing/components/invoice-details.component').then(m => m.InvoiceDetailsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'customers', 
    loadComponent: () => import('./features/customers/customers.component').then(m => m.CustomersComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'customers/:id', 
    loadComponent: () => import('./features/customers/components/customer-details.component').then(m => m.CustomerDetailsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'reports', 
    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance', 
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/active', 
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/history', 
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/schedule', 
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/new', 
    loadComponent: () => import('./features/maintenance/components/maintenance-form.component').then(m => m.MaintenanceFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/edit/:id', 
    loadComponent: () => import('./features/maintenance/components/maintenance-form.component').then(m => m.MaintenanceFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'maintenance/details/:id', 
    loadComponent: () => import('./features/maintenance/components/maintenance-details.component').then(m => m.MaintenanceDetailsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'employees', 
    loadComponent: () => import('./features/employees/employees.component').then(m => m.EmployeesComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'employees/new', 
    loadComponent: () => import('./features/employees/components/employee-form.component').then(m => m.EmployeeFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'employees/edit/:id', 
    loadComponent: () => import('./features/employees/components/employee-form.component').then(m => m.EmployeeFormComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'employees/details/:id', 
    loadComponent: () => import('./features/employees/components/employee-details.component').then(m => m.EmployeeDetailsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'settings', 
    loadComponent: () => import('./features/garage-settings/garage-settings.component').then(m => m.GarageSettingsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'approvals', 
    loadComponent: () => import('./features/approvals/approvals.component').then(m => m.ApprovalsComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'profile', 
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/auth' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    useHash: false,
    enableTracing: false
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
