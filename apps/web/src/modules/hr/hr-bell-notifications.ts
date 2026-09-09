import type { HrNotificationDto } from '@rubi/contracts';

/** Pending HR notices share the global bell; read history remains in HR's audit. */
export function pendingHrBellNotifications(
  items: readonly HrNotificationDto[],
) {
  return items
    .filter((item) => !item.readAt)
    .map((item) => ({
      key: `hr:${item.id}`,
      id: item.id,
      source: 'hr' as const,
      title: item.title,
      description: 'منابع انسانی',
      href: item.recordId
        ? `/hr?record=${encodeURIComponent(item.recordId)}`
        : item.employeeId
          ? `/hr?section=employee&employee=${encodeURIComponent(item.employeeId)}`
          : '/hr',
      occurredAt: item.createdAt,
      isRead: false,
    }));
}
