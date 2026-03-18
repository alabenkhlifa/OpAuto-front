import { Component, inject, OnInit } from '@angular/core';
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

  ngOnInit(): void {
    // After auth is confirmed, load active modules and notifications
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.moduleService.loadActiveModules();
        this.notificationService.loadNotifications();
      }
    });
  }

  public isAuthRoute(): boolean {
    return this.router.url === '/auth' || this.router.url === '/';
  }
}
