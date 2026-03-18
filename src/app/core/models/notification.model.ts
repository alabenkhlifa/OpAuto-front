export type NotificationType =
  | 'appointment_reminder'
  | 'appointment_created'
  | 'appointment_updated'
  | 'maintenance_status'
  | 'approval_request'
  | 'approval_response'
  | 'invoice_created'
  | 'invoice_overdue'
  | 'low_stock'
  | 'employee_schedule'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilter {
  type?: NotificationType;
  isRead?: boolean;
}
