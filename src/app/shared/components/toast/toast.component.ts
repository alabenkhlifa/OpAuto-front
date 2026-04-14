import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.type" (click)="toastService.dismiss(toast.id)">
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') {
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @case ('error') {
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @case ('warning') {
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
              @case ('info') {
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            }
          </div>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id); $event.stopPropagation()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 400px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      border: 1px solid;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }

    .toast-success {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #166534;
    }
    .toast-error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .toast-warning {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }
    .toast-info {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
    }

    .toast-icon { flex-shrink: 0; }
    .toast-message { flex: 1; font-size: 0.875rem; font-weight: 500; }

    .toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.5;
      color: inherit;
      padding: 0;
      transition: opacity 0.2s;
    }
    .toast-close:hover { opacity: 1; }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}
