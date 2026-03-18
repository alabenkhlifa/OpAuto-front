import { Component, inject, OnInit, effect } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarService } from './core/services/sidebar.service';
import { TranslationService } from './core/services/translation.service';
import { AuthService } from './core/services/auth.service';
import { ModuleService } from './core/services/module.service';
import { NotificationService } from './core/services/notification.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { NotificationBellComponent } from './shared/components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NotificationBellComponent],
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected title = 'OpAuto-front';
  public sidebarService = inject(SidebarService);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  private moduleService = inject(ModuleService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  constructor() {
    // Once modules are loaded, conditionally load notifications
    effect(() => {
      if (this.moduleService.isLoaded() && this.moduleService.hasModuleAccess('notifications')) {
        this.notificationService.loadNotifications();
      }
    });
  }

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.moduleService.loadActiveModules();
      }
    });
  }

  public isAuthRoute(): boolean {
    return this.router.url === '/auth' || this.router.url === '/';
  }
}
