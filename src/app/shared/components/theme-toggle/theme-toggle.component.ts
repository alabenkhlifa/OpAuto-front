import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Dark mode indicator (non-interactive) -->
    <div
      class="relative inline-flex items-center justify-center w-10 h-10 p-2 rounded-lg 
             bg-gray-800 border-2 border-gray-600
             backdrop-blur-sm shadow-sm"
      title="Dark mode (permanent)">
      
      <!-- Moon Icon - Always visible -->
      <svg
        class="w-5 h-5 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ThemeToggleComponent {
  // Component simplified - no theme service dependency
}