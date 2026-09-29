import type {
  IamPersonalProfileResponseV1,
  IamPersonalProfileUpdateInputV1,
  WorkbenchActivityResponseV1,
  WorkbenchCalendarEventInputV1,
  WorkbenchCalendarEventV1,
  WorkbenchCalendarResponseV1,
  WorkbenchNoteInputV1,
  WorkbenchNotesResponseV1,
  WorkbenchNoteV1,
  WorkbenchPerformanceResponseV1,
} from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await fetch(`${base}/workbench${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: { message?: string };
    } | null;
    const message = payload?.error?.message ?? payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(' ')
        : (message ?? 'عملیات میزکار انجام نشد.'),
    );
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const json = (method: 'POST' | 'PATCH', value: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

export const workbenchPersonalApi = {
  performance: (days: string) =>
    request<WorkbenchPerformanceResponseV1>(
      `/performance?days=${encodeURIComponent(days)}`,
    ),
  notes: () => request<WorkbenchNotesResponseV1>('/notes'),
  createNote: (input: WorkbenchNoteInputV1) =>
    request<{ data: WorkbenchNoteV1 }>('/notes', json('POST', input)),
  updateNote: (id: string, input: WorkbenchNoteInputV1) =>
    request<{ data: WorkbenchNoteV1 }>(
      `/notes/${encodeURIComponent(id)}`,
      json('PATCH', input),
    ),
  deleteNote: (id: string) =>
    request<void>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createFolder: (name: string) =>
    request<{ data: { name: string } }>(
      '/note-folders',
      json('POST', { name }),
    ),
  calendar: () => request<WorkbenchCalendarResponseV1>('/calendar'),
  createEvent: (input: WorkbenchCalendarEventInputV1) =>
    request<{ data: WorkbenchCalendarEventV1 }>(
      '/calendar',
      json('POST', input),
    ),
  updateEvent: (id: string, input: WorkbenchCalendarEventInputV1) =>
    request<{ data: WorkbenchCalendarEventV1 }>(
      `/calendar/${encodeURIComponent(id)}`,
      json('PATCH', input),
    ),
  deleteEvent: (id: string) =>
    request<void>(`/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  profile: () => request<IamPersonalProfileResponseV1>('/profile'),
  updateProfile: (input: IamPersonalProfileUpdateInputV1) =>
    request<IamPersonalProfileResponseV1>('/profile', json('PATCH', input)),
  activity: () => request<WorkbenchActivityResponseV1>('/activity'),
};
