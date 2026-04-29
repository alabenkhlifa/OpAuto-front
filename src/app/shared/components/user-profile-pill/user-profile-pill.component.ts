import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/auth.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-profile-pill',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (currentUser()) {
      <button
        type="button"
        class="user-pill"
        (click)="goToProfile()"
        [attr.aria-label]="'navigation.profile' | translate">
        <span class="user-pill__avatar">{{ initials() }}</span>
        <span class="user-pill__meta">
          <span class="user-pill__name">{{ currentUser()!.name }}</span>
          <span class="user-pill__role">{{ roleKey() | translate }}</span>
        </span>
      </button>
    }
  `,
  styles: [`
    .user-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.375rem 1rem 0.375rem 0.375rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
      font: inherit;
      color: inherit;
      max-width: 100%;
    }

    .user-pill:hover {
      border-color: #d1d5db;
      box-shadow: 0 2px 6px rgba(17, 24, 39, 0.06);
      transform: translateY(-1px);
    }

    .user-pill:focus-visible {
      outline: 2px solid #FF8400;
      outline-offset: 2px;
    }

    .user-pill__avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 9999px;
      background: #FF8400;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    .user-pill__meta {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
      min-width: 0;
    }

    .user-pill__name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 10rem;
    }

    .user-pill__role {
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
    }

    @media (max-width: 640px) {
      .user-pill {
        padding: 0.25rem;
      }
      .user-pill__meta {
        display: none;
      }
    }
  `],
})
export class UserProfilePillComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  currentUser = signal<User | null>(null);

  initials = computed(() => {
    const name = this.currentUser()?.name?.trim() || '';
    if (!name) return '';
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });

  roleKey = computed(() => {
    const role = this.currentUser()?.role;
    return role === UserRole.OWNER ? 'roles.owner' : 'roles.staff';
  });

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.currentUser.set(user));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
