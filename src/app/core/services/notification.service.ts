import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppNotification, NotificationType } from '../models/notification.model';
import { fromBackendEnum } from '../utils/enum-mapper';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);

  private notifications = signal<AppNotification[]>([]);

  allNotifications = computed(() => this.notifications());
  unreadCount = computed(() => this.notifications().filter(n => !n.isRead).length);
  latestNotifications = computed(() => this.notifications().slice(0, 5));

  loadNotifications(): void {
    this.http.get<any[]>('/notifications').subscribe({
      next: (items) => {
        const mapped = items.map(n => this.mapFromBackend(n));
        this.notifications.set(mapped);
      },
      error: () => {
        // Leave notifications empty on error
      }
    });
  }

  loadUnreadCount(): void {
    this.http.get<{ count: number }>('/notifications/unread-count').subscribe({
      next: () => {
        // unreadCount is computed from notifications signal
      },
      error: () => {}
    });
  }

  getNotifications(type?: NotificationType, isRead?: boolean): AppNotification[] {
    let result = this.notifications();
    if (type) result = result.filter(n => n.type === type);
    if (isRead !== undefined) result = result.filter(n => n.isRead === isRead);
    return result;
  }

  markAsRead(id: string) {
    this.http.put(`/notifications/${id}/read`, {}).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      }
    });
  }

  markAllAsRead() {
    this.http.put('/notifications/read-all', {}).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => ({ ...n, isRead: true }))
        );
      }
    });
  }

  addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.update(list => [newNotification, ...list]);
  }

  removeNotification(id: string) {
    this.http.delete(`/notifications/${id}`).subscribe({
      next: () => {
        this.notifications.update(list => list.filter(n => n.id !== id));
      }
    });
  }

  private mapFromBackend(b: any): AppNotification {
    return {
      id: b.id,
      type: (fromBackendEnum(b.type) || 'system') as NotificationType,
      title: b.title || '',
      message: b.message || b.body || '',
      isRead: b.isRead ?? b.read ?? false,
      createdAt: new Date(b.createdAt),
    };
  }
}
