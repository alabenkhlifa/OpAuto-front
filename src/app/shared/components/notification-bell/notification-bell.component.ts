import { Component, inject, signal, HostListener } from '@angular/core';
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
        <div class="notification-dropdown glass-card">
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
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(11, 8, 41, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s;
    }

    .bell-btn:hover, .bell-btn.has-unread {
      color: #FF8400;
      border-color: rgba(255, 132, 0, 0.3);
    }

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #FF8400;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid #0B0829;
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .dropdown-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .notification-item:hover {
      background: rgba(255, 255, 255, 0.03);
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
      color: #fff;
    }

    .notif-message {
      font-size: 0.8rem;
      color: #94a3b8;
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
      border-top: 1px solid rgba(255, 255, 255, 0.08);
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
export class NotificationBellComponent {
  notificationService = inject(NotificationService);
  private router = inject(Router);

  isOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-bell-wrapper')) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  onNotificationClick(id: string) {
    this.notificationService.markAsRead(id);
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  viewAll() {
    this.isOpen.set(false);
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
