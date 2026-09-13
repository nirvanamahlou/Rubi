import type { LoginResponse } from '@rubi/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { documentsApi } from '@/modules/documents/api/client';
import {
  notificationsApi,
  notifyNotificationFeedChanged,
} from '@/modules/notifications/api/client';
import { ProfileUnauthorizedError } from '@/modules/profile/api/client';
import type { Resource, WorkbenchHome } from './model';
import { messagingApi } from './messaging-api';
import { workbenchPersonalApi } from './workbench-personal-api';

async function resource<T>(operation: () => Promise<T>): Promise<Resource<T>> {
  try {
    return { status: 'ready', data: await operation() };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 403
    )
      return { status: 'forbidden' };
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'دریافت اطلاعات انجام نشد.',
    };
  }
}
interface Dependencies {
  identity: () => Promise<LoginResponse | null>;
  notifications: typeof notificationsApi.list;
  documents: typeof documentsApi.list;
  activity: typeof workbenchPersonalApi.activity;
  notes: typeof workbenchPersonalApi.notes;
  calendar: typeof workbenchPersonalApi.calendar;
  conversations: typeof messagingApi.conversations;
}
export async function loadWorkbenchHome(
  dependencies?: Dependencies,
): Promise<WorkbenchHome> {
  const deps = dependencies ?? {
    identity: async () => {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('ارتباط با سامانه برقرار نیست.');
      return refreshAuthenticatedSession(base);
    },
    notifications: notificationsApi.list,
    documents: documentsApi.list,
    activity: workbenchPersonalApi.activity,
    notes: workbenchPersonalApi.notes,
    calendar: workbenchPersonalApi.calendar,
    conversations: messagingApi.conversations,
  };
  const identity = await deps.identity();
  if (!identity) throw new ProfileUnauthorizedError();
  const [notifications, documents, activity, notes, calendar, conversations] =
    await Promise.all([
      resource(() => deps.notifications(50)),
      identity.user.permissions.includes('documents.metadata.read')
        ? resource(() =>
            deps.documents({
              personalView: 'OWNED',
              page: 1,
              pageSize: 10,
              sortBy: 'updatedAt',
              sortDirection: 'desc',
            }),
          )
        : Promise.resolve({ status: 'forbidden' } as const),
      resource(deps.activity),
      resource(deps.notes),
      resource(deps.calendar),
      resource(deps.conversations),
    ]);
  return {
    user: identity.user,
    notifications,
    documents,
    activity,
    notes,
    calendar,
    conversations,
  };
}
export async function markWorkbenchNotificationRead(id: string): Promise<void> {
  await notificationsApi.markRead(id);
  notifyNotificationFeedChanged();
}
