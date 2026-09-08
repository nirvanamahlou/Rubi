export const NOTIFICATIONS_CONTRACT_VERSION = 1 as const;

export interface NotificationActorV1 {
  id: string;
  displayName: string;
}

export interface NotificationItemV1 {
  id: string;
  sourceModule: string;
  eventType: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  href: string | null;
  isRead: boolean;
  occurredAt: string;
  actor: NotificationActorV1 | null;
}

export interface NotificationListResponseV1 {
  data: NotificationItemV1[];
  meta: {
    unreadCount: number;
    limit: number;
  };
}

export interface NotificationReadResponseV1 {
  data: {
    updatedCount: number;
  };
}
