import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarService } from './core/services/sidebar.service';
import { TranslationService } from './core/services/translation.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  styleUrl: './app.css'
})
export class App {
  protected title = 'OpAuto-front';
  public sidebarService = inject(SidebarService);
  private translationService = inject(TranslationService); // Force early initialization
  private router = inject(Router);

  public isAuthRoute(): boolean {
    return this.router.url === '/auth' || this.router.url === '/';
  }
}
