import type { Prisma } from '@rubi/database';

export interface NotificationCommand {
  recipientUserIds: readonly string[];
  actorUserId: string | null;
  sourceModule: string;
  eventType: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  href?: string | null;
}

export type NotificationTransaction = Prisma.TransactionClient;
