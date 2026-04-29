import { Component, inject, signal, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-bell-wrapper">
      <button class="bell-btn" (click)="toggleDropdown($event)" [class.has-unread]="notificationService.unreadCount() > 0">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        @if (notificationService.unreadCount() > 0) {
          <span class="unread-badge">{{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}</span>
        }
      </button>

      @if (isOpen()) {
        <div class="notification-dropdown glass-modal">
          <div class="dropdown-header">
            <h3>Notifications</h3>
            @if (notificationService.unreadCount() > 0) {
              <button class="mark-all-btn" (click)="markAllRead()">Mark all read</button>
            }
          </div>

          <div class="dropdown-list">
            @for (notification of notificationService.latestNotifications(); track notification.id) {
              <div class="notification-item" [class.unread]="!notification.isRead" (click)="onNotificationClick(notification.id)">
                <div class="notif-icon" [class]="'notif-type-' + notification.type">
                  {{ getTypeIcon(notification.type) }}
                </div>
                <div class="notif-content">
                  <span class="notif-title">{{ notification.title }}</span>
                  <span class="notif-message">{{ notification.message }}</span>
                  <span class="notif-time">{{ getTimeAgo(notification.createdAt) }}</span>
                </div>
                @if (!notification.isRead) {
                  <span class="unread-dot"></span>
                }
              </div>
            }
            @if (notificationService.latestNotifications().length === 0) {
              <div class="empty-state">No notifications</div>
            }
          </div>

          <div class="dropdown-footer">
            <button class="view-all-btn" (click)="viewAll()">View All Notifications</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-bell-wrapper {
      position: relative;
    }

    .bell-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 9999px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      color: #6b7280;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease, color 150ms ease;
    }

    .bell-btn:hover {
      color: #111827;
      border-color: #d1d5db;
      box-shadow: 0 2px 6px rgba(17, 24, 39, 0.06);
      transform: translateY(-1px);
    }

    .bell-btn.has-unread {
      color: #111827;
    }

    .bell-btn:focus-visible {
      outline: 2px solid #FF8400;
      outline-offset: 2px;
    }

    .unread-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      min-width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: #FF8400;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(255, 132, 0, 0.35);
    }

    .notification-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 380px;
      max-height: 480px;
      display: flex;
      flex-direction: column;
      z-index: 1000;
      padding: 0;
      overflow: hidden;
      animation: dropdownIn 0.2s ease;
    }

    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--color-border);
    }

    .dropdown-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .mark-all-btn {
      font-size: 0.8rem;
      color: #FF8400;
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .mark-all-btn:hover {
      text-decoration: underline;
    }

    .dropdown-list {
      overflow-y: auto;
      max-height: 350px;
    }

    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1.25rem;
      cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid var(--color-border-light);
    }

    .notification-item:hover {
      background: #f8fafc;
    }

    .notification-item.unread {
      background: rgba(255, 132, 0, 0.04);
    }

    .notif-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
      background: rgba(255, 132, 0, 0.1);
    }

    .notif-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .notif-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #111827;
    }

    .notif-message {
      font-size: 0.8rem;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notif-time {
      font-size: 0.7rem;
      color: #64748b;
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #FF8400;
      flex-shrink: 0;
      margin-top: 6px;
    }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
    }

    .dropdown-footer {
      padding: 0.75rem;
      border-top: 1px solid var(--color-border);
      text-align: center;
    }

    .view-all-btn {
      width: 100%;
      padding: 0.5rem;
      border-radius: 10px;
      background: rgba(255, 132, 0, 0.1);
      border: 1px solid rgba(255, 132, 0, 0.2);
      color: #FF8400;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .view-all-btn:hover {
      background: rgba(255, 132, 0, 0.2);
    }

    @media (max-width: 480px) {
      .notification-dropdown {
        width: calc(100vw - 2rem);
        right: -1rem;
      }
    }
  `],
})
export class NotificationBellComponent implements OnDestroy {
  notificationService = inject(NotificationService);
  private router = inject(Router);
  private markReadTimer: ReturnType<typeof setTimeout> | null = null;

  isOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-bell-wrapper')) {
      this.closeDropdown();
    }
  }

  ngOnDestroy() {
    this.clearMarkReadTimer();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    const wasOpen = this.isOpen();
    this.isOpen.update(v => !v);

    if (!wasOpen && this.notificationService.unreadCount() > 0) {
      this.markReadTimer = setTimeout(() => {
        this.notificationService.markAllAsRead();
        this.markReadTimer = null;
      }, 1000);
    } else if (wasOpen) {
      this.clearMarkReadTimer();
    }
  }

  private closeDropdown() {
    this.isOpen.set(false);
    this.clearMarkReadTimer();
  }

  private clearMarkReadTimer() {
    if (this.markReadTimer) {
      clearTimeout(this.markReadTimer);
      this.markReadTimer = null;
    }
  }

  onNotificationClick(id: string) {
    this.notificationService.markAsRead(id);
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  viewAll() {
    this.closeDropdown();
    this.router.navigate(['/notifications']);
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      appointment_reminder: '📅',
      appointment_created: '📋',
      appointment_updated: '🔄',
      maintenance_status: '🔧',
      approval_request: '✋',
      approval_response: '✅',
      invoice_created: '📄',
      invoice_overdue: '⚠️',
      low_stock: '📦',
      employee_schedule: '👤',
      system: '🔔',
    };
    return icons[type] || '🔔';
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
