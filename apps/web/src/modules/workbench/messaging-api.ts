import { authenticatedFetch } from '@/lib/authenticated-fetch';
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
  SetMessagingReactionInputV1,
} from '@nora/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await authenticatedFetch(`${base}/messaging${path}`, base, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
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

async function downloadAttachment(
  conversationId: string,
  documentId: string,
): Promise<Blob> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await authenticatedFetch(
    `${base}/messaging/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(documentId)}`,
    base,
    { timeoutMs: 120_000 },
  );
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: { message?: string };
    } | null;
    const message = envelope?.error?.message ?? envelope?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(' ')
        : (message ?? 'دریافت پیوست پیام انجام نشد.'),
    );
  }
  return response.blob();
}

function json<T>(body: T): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const messagingApi = {
  removeMember: (id: string, memberId: string) =>
    request<MessagingConversationResponseV1>(
      `/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    ),
  promoteMember: (id: string, memberId: string) =>
    request<MessagingConversationResponseV1>(
      `/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}/owner`,
      { method: 'PUT' },
    ),
  downloadAttachment,
  contacts(search = '') {
    const query = new URLSearchParams({ limit: '50' });
    if (search.trim()) query.set('search', search.trim());
    return request<MessagingContactsResponseV1>(
      `/contacts?${query.toString()}`,
    );
  },
  remove(conversationId: string) {
    return request<{ data: { id: string } }>(
      `/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' },
    );
  },
  updateGroup(
    conversationId: string,
    input: { title: string; memberIds: string[] },
  ) {
    return request<MessagingConversationResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}`,
      { ...json(input), method: 'PATCH' },
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
  messages(
    conversationId: string,
    options: { search?: string; cursor?: string } = {},
  ) {
    const query = new URLSearchParams({ limit: '50' });
    if (options.search) query.set('search', options.search);
    if (options.cursor) query.set('cursor', options.cursor);
    return request<MessagingMessagesResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
    );
  },
  send(conversationId: string, input: SendMessagingMessageInputV1) {
    return request<MessagingMessageResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      json(input),
    );
  },
  react(
    conversationId: string,
    messageId: string,
    input: SetMessagingReactionInputV1,
  ) {
    return request<MessagingMessageResponseV1>(
      `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reaction`,
      { ...json(input), method: 'PUT' },
    );
  },
  uploadAttachment(
    conversationId: string,
    clientRequestId: string,
    file: File,
  ) {
    const form = new FormData();
    form.set('file', file);
    form.set('clientRequestId', clientRequestId);
    return request<{ data: { id: string; scanStatus: string } }>(
      `/conversations/${encodeURIComponent(conversationId)}/attachments`,
      { method: 'POST', body: form },
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
