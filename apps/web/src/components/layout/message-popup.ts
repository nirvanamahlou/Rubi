import {
  canViewRoute,
  type AuthenticatedActor,
  type NotificationItemV1,
} from '@nora/contracts';
import {
  isCallCenterAssignment,
  notificationKind,
} from './notification-presentation';
export function newMessagePopup(
  items: readonly NotificationItemV1[],
  seen: ReadonlySet<string> | null,
  permissions: AuthenticatedActor['permissions'],
  receivedAfter = '',
) {
  if (!seen) return null;
  return (
    items
      .filter(
        (item) =>
          !seen.has(item.id) &&
          item.occurredAt >= receivedAfter &&
          !item.isRead &&
          ((notificationKind(item) === 'message' &&
            item.href?.startsWith('/workbench?tab=messages&conversation=')) ||
            (isCallCenterAssignment(item) &&
              item.href ===
                '/customer-affairs/call-center#cc-follow-up-queue')) &&
          canViewRoute(permissions, item.href),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null
  );
}
