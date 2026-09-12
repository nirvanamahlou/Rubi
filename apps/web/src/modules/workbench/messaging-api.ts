import type {
  CreateDirectConversationInputV1,
  CreateGroupConversationInputV1,
  ForwardMessagingMessageInputV1,
  MessagingContactsResponseV1,
  MessagingConversationResponseV1,
  MessagingConversationsResponseV1,
  MessagingMessageResponseV1,
  MessagingMessagesResponseV1,
  SendMessagingMessageInputV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await fetch(`${base}/messaging${path}`, {
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
    const envelope = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: { message?: string };
    } | null;
    const message = envelope?.error?.message ?? envelope?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(' ')
        : (message ?? 'عملیات پیام‌رسان ناموفق بود.'),
    );
  }
  return response.json() as Promise<T>;
}

function json<T>(body: T): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const messagingApi = {
  contacts(search = '') {
    const query = new URLSearchParams({ limit: '50' });
    if (search.trim()) query.set('search', search.trim());
    return request<MessagingContactsResponseV1>(
      `/contacts?${query.toString()}`,
    );
  },
  conversations() {
    return request<MessagingConversationsResponseV1>('/conversations');
  },
  createDirect(input: CreateDirectConversationInputV1) {
    return request<MessagingConversationResponseV1>(
      '/conversations/direct',
      json(input),
    );
  },
  createGroup(input: CreateGroupConversationInputV1) {
    return request<MessagingConversationResponseV1>(
      '/conversations/groups',
      json(input),
    );
  },
  messages(conversationId: string) {
    return request<MessagingMessagesResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
    );
  },
  send(conversationId: string, input: SendMessagingMessageInputV1) {
    return request<MessagingMessageResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      json(input),
    );
  },
  forward(conversationId: string, input: ForwardMessagingMessageInputV1) {
    return request<MessagingMessageResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/forwards`,
      json(input),
    );
  },
};

export function messagingRequestId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
