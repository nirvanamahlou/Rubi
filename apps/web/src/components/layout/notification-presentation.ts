import type { NotificationItemV1 } from '@nora/contracts';

export type NotificationKind = 'message' | 'request' | 'other';

export function isCallCenterAssignment(
  item: Pick<NotificationItemV1, 'sourceModule' | 'eventType'>,
) {
  return (
    item.sourceModule === 'customer-affairs' &&
    item.eventType === 'call-center.assigned'
  );
}

export function notificationKind(
  item: Pick<NotificationItemV1, 'sourceModule' | 'eventType' | 'href'>,
): NotificationKind {
  if (
    item.sourceModule === 'messaging' ||
    item.eventType === 'message.received'
  )
    return 'message';
  if (
    isCallCenterAssignment(item) ||
    item.href?.startsWith('/workbench?tab=requests') ||
    item.eventType.startsWith('ticket.') ||
    item.eventType.startsWith('request.')
  )
    return 'request';
  return 'other';
}

export function compareNotifications(
  left: { isRead: boolean; occurredAt: string },
  right: { isRead: boolean; occurredAt: string },
) {
  return (
    Number(left.isRead) - Number(right.isRead) ||
    right.occurredAt.localeCompare(left.occurredAt)
  );
}

export function notificationColors(
  kind: NotificationKind | undefined,
  isRead: boolean,
) {
  if (isRead)
    return { item: '', icon: 'bg-muted text-muted-foreground', dot: '' };
  if (kind === 'message')
    return {
      item: 'bg-sky-50 dark:bg-sky-950/40',
      icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200',
      dot: 'bg-sky-500',
    };
  if (kind === 'request')
    return {
      item: 'bg-violet-50 dark:bg-violet-950/40',
      icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
      dot: 'bg-violet-500',
    };
  return {
    item: 'bg-amber-50 dark:bg-amber-950/40',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    dot: 'bg-amber-500',
  };
}
