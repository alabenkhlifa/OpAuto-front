import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationType, AppNotification } from '../../core/models/notification.model';
import { SidebarService } from '../../core/services/sidebar.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="notifications-page" [class.sidebar-collapsed]="sidebarService.isCollapsed()">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            Notifications
          </h1>
          <span class="unread-count" *ngIf="notificationService.unreadCount() > 0">
            {{ notificationService.unreadCount() }} unread
          </span>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="notificationService.markAllAsRead()" *ngIf="notificationService.unreadCount() > 0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Mark All Read
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters glass-card">
        <button class="btn-filter-chip" [class.active]="filterType() === null" (click)="filterType.set(null)">All</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'appointment_reminder'" (click)="filterType.set('appointment_reminder')">Appointments</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'maintenance_status'" (click)="filterType.set('maintenance_status')">Maintenance</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'approval_request'" (click)="filterType.set('approval_request')">Approvals</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'invoice_overdue'" (click)="filterType.set('invoice_overdue')">Invoices</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'low_stock'" (click)="filterType.set('low_stock')">Stock</button>
        <button class="btn-filter-chip" [class.active]="filterType() === 'system'" (click)="filterType.set('system')">System</button>

        <div class="filter-separator"></div>

        <button class="btn-filter-chip" [class.active]="showUnreadOnly()" (click)="toggleUnreadOnly()">
          Unread Only
        </button>
      </div>

      <!-- Notifications List -->
      <div class="notifications-list">
        @for (notification of filteredNotifications(); track notification.id) {
          <div class="notification-card glass-card" [class.unread]="!notification.isRead">
            <div class="notif-icon-lg" [class]="'type-' + notification.type">
              {{ getTypeIcon(notification.type) }}
            </div>
            <div class="notif-body">
              <div class="notif-header">
                <span class="notif-title">{{ notification.title }}</span>
                <span class="notif-time">{{ getTimeAgo(notification.createdAt) }}</span>
              </div>
              <p class="notif-message">{{ notification.message }}</p>
              <div class="notif-type-badge">
                <span class="type-label">{{ getTypeLabel(notification.type) }}</span>
              </div>
            </div>
            <div class="notif-actions">
              @if (!notification.isRead) {
                <button class="action-btn" (click)="notificationService.markAsRead(notification.id)" title="Mark as read">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              }
              <button class="action-btn delete" (click)="notificationService.removeNotification(notification.id)" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-state glass-card">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <h3>No notifications</h3>
            <p>You're all caught up!</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .notifications-page { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .page-title { display: flex; align-items: center; gap: 0.75rem; font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0; }
    .page-title svg { color: #FF8400; }
    .unread-count { padding: 0.25rem 0.75rem; border-radius: 12px; background: rgba(255, 132, 0, 0.15); color: #FF8400; font-size: 0.85rem; font-weight: 600; }
    .filters { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; align-items: center; }
    .filter-separator { width: 1px; height: 24px; background: rgba(255, 255, 255, 0.1); margin: 0 0.5rem; }
    .notifications-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .notification-card { display: flex; align-items: flex-start; gap: 1rem; padding: 1.25rem; transition: all 0.2s; }
    .notification-card.unread { border-left: 3px solid #FF8400; }
    .notification-card:hover { transform: translateY(-1px); }
    .notif-icon-lg { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; background: rgba(255, 132, 0, 0.1); flex-shrink: 0; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; }
    .notif-title { font-size: 0.95rem; font-weight: 600; color: #fff; }
    .notif-time { font-size: 0.75rem; color: #64748b; white-space: nowrap; }
    .notif-message { font-size: 0.875rem; color: #94a3b8; margin: 0 0 0.5rem; line-height: 1.5; }
    .type-label { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 6px; background: rgba(143, 160, 216, 0.1); color: #8FA0D8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    .notif-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
    .action-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border: none; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
    .action-btn:hover { background: rgba(255, 132, 0, 0.1); color: #FF8400; }
    .action-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 3rem; color: #64748b; text-align: center; }
    .empty-state svg { color: #2A2566; margin-bottom: 1rem; }
    .empty-state h3 { color: #fff; margin: 0 0 0.5rem; }
    .empty-state p { margin: 0; }
    @media (max-width: 640px) {
      .notifications-page { padding: 1rem; }
      .notification-card { flex-direction: column; }
      .notif-header { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
    }
  `],
})
export class NotificationsComponent {
  notificationService = inject(NotificationService);
  sidebarService = inject(SidebarService);

  filterType = signal<NotificationType | null>(null);
  showUnreadOnly = signal(false);

  filteredNotifications = computed(() => {
    let notifications = this.notificationService.allNotifications();
    const type = this.filterType();
    if (type) notifications = notifications.filter(n => n.type === type);
    if (this.showUnreadOnly()) notifications = notifications.filter(n => !n.isRead);
    return notifications;
  });

  toggleUnreadOnly() {
    this.showUnreadOnly.update(v => !v);
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      appointment_reminder: '📅', appointment_created: '📋', appointment_updated: '🔄',
      maintenance_status: '🔧', approval_request: '✋', approval_response: '✅',
      invoice_created: '📄', invoice_overdue: '⚠️', low_stock: '📦',
      employee_schedule: '👤', system: '🔔',
    };
    return icons[type] || '🔔';
  }

  getTypeLabel(type: string): string {
    return type.replace(/_/g, ' ');
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
