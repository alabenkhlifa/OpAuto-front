import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { ownerGuard, moduleGuard } from './core/guards/role.guard';

export const routes: Routes = [
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
    path: 'calendar',
    loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent),
    canActivate: [authGuard, moduleGuard('calendar')]
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
    path: 'cars/:id',
    loadComponent: () => import('./features/cars/car-detail/car-detail.component').then(m => m.CarDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('inventory')]
  },
  {
    path: 'invoices',
    loadComponent: () => import('./features/invoicing/invoicing.component').then(m => m.InvoicingComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('invoicing')],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/invoicing/pages/dashboard/dashboard.component').then(m => m.InvoicingDashboardComponent)
      },
      {
        path: 'list',
        loadComponent: () => import('./features/invoicing/pages/invoice-list/invoice-list.component').then(m => m.InvoiceListPageComponent)
      },
      {
        path: 'pending',
        loadComponent: () => import('./features/invoicing/pages/pending-list/pending-list.component').then(m => m.PendingListPageComponent)
      },
      {
        path: 'quotes',
        loadComponent: () => import('./features/invoicing/pages/quote-list/quote-list.component').then(m => m.QuoteListPageComponent)
      },
      {
        path: 'quotes/new',
        loadComponent: () => import('./features/invoicing/pages/quote-form/quote-form.component').then(m => m.QuoteFormPageComponent)
      },
      {
        path: 'quotes/edit/:id',
        loadComponent: () => import('./features/invoicing/pages/quote-form/quote-form.component').then(m => m.QuoteFormPageComponent)
      },
      {
        path: 'quotes/:id',
        loadComponent: () => import('./features/invoicing/pages/quote-detail/quote-detail.component').then(m => m.QuoteDetailPageComponent)
      },
      {
        path: 'credit-notes',
        loadComponent: () => import('./features/invoicing/pages/credit-note-list/credit-note-list.component').then(m => m.CreditNoteListPageComponent)
      },
      {
        path: 'credit-notes/new',
        loadComponent: () => import('./features/invoicing/pages/credit-note-form/credit-note-form.component').then(m => m.CreditNoteFormPageComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/invoicing/pages/reports/reports.component').then(m => m.InvoicingReportsPageComponent)
      },
      {
        path: 'templates',
        loadComponent: () => import('./features/invoicing/pages/templates/templates.component').then(m => m.InvoicingTemplatesPageComponent)
      },
      {
        path: 'settings',
        redirectTo: '/settings',
        pathMatch: 'full'
      },
      {
        path: 'create',
        loadComponent: () => import('./features/invoicing/components/invoice-form.component').then(m => m.InvoiceFormComponent)
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./features/invoicing/components/invoice-form.component').then(m => m.InvoiceFormComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/invoicing/components/invoice-details.component').then(m => m.InvoiceDetailsComponent)
      }
    ]
  },
  {
    path: 'customers',
    loadComponent: () => import('./features/customers/customers.component').then(m => m.CustomersComponent),
    canActivate: [authGuard]
  },
  {
    path: 'customers/new',
    loadComponent: () => import('./features/customers/components/customer-form.component').then(m => m.CustomerFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'customers/:id/edit',
    loadComponent: () => import('./features/customers/components/customer-form.component').then(m => m.CustomerFormComponent),
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
    canActivate: [authGuard, ownerGuard, moduleGuard('reports')]
  },
  {
    path: 'maintenance',
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/active',
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/history',
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/schedule',
    loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/new',
    loadComponent: () => import('./features/maintenance/components/maintenance-form.component').then(m => m.MaintenanceFormComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/edit/:id',
    loadComponent: () => import('./features/maintenance/components/maintenance-form.component').then(m => m.MaintenanceFormComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'maintenance/details/:id',
    loadComponent: () => import('./features/maintenance/components/maintenance-details.component').then(m => m.MaintenanceDetailsComponent),
    canActivate: [authGuard, moduleGuard('maintenance')]
  },
  {
    path: 'employees',
    loadComponent: () => import('./features/employees/employees.component').then(m => m.EmployeesComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('employees')]
  },
  {
    path: 'employees/new',
    loadComponent: () => import('./features/employees/components/employee-form.component').then(m => m.EmployeeFormComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('employees')]
  },
  {
    path: 'employees/edit/:id',
    loadComponent: () => import('./features/employees/components/employee-form.component').then(m => m.EmployeeFormComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('employees')]
  },
  {
    path: 'employees/details/:id',
    loadComponent: () => import('./features/employees/components/employee-details.component').then(m => m.EmployeeDetailsComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('employees')]
  },
  {
    path: 'users',
    loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('users')]
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/garage-settings/garage-settings.component').then(m => m.GarageSettingsComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('settings')]
  },
  {
    path: 'approvals',
    loadComponent: () => import('./features/approvals/approvals.component').then(m => m.ApprovalsComponent),
    canActivate: [authGuard, ownerGuard, moduleGuard('approvals')]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard, moduleGuard('notifications')]
  },
  {
    path: 'modules',
    loadComponent: () => import('./features/subscription/subscription.component').then(m => m.SubscriptionComponent),
    canActivate: [authGuard, ownerGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'subscription',
    loadComponent: () => import('./features/subscription/subscription.component').then(m => m.SubscriptionComponent),
    canActivate: [authGuard, ownerGuard]
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
