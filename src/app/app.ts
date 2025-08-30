import { Component, inject } from '@angular/core';
import { SidebarService } from './core/services/sidebar.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  protected title = 'OpAuto-front';
  public sidebarService = inject(SidebarService);
}
