import { expect, it } from 'vitest';
import type { AuthenticatedActor, NotificationItemV1 } from '@nora/contracts';
import { newMessagePopup } from './message-popup';
const permissions: AuthenticatedActor['permissions'] = ['ui.administrator'];
const message = {
  id: 'message-1',
  isRead: false,
  sourceModule: 'messaging',
  eventType: 'message.received',
  href: '/workbench?tab=messages&conversation=chat-1',
  occurredAt: '2026-11-05T10:00:00Z',
} as NotificationItemV1;
it('does not replay the initial feed, seen or read messages', () => {
  expect(newMessagePopup([message], null, permissions)).toBeNull();
  expect(
    newMessagePopup([message], new Set([message.id]), permissions),
  ).toBeNull();
  expect(
    newMessagePopup([{ ...message, isRead: true }], new Set(), permissions),
  ).toBeNull();
});
it('selects a new internal message and preserves the exact conversation link', () => {
  expect(newMessagePopup([message], new Set(), permissions)?.href).toBe(
    message.href,
  );
  expect(
    newMessagePopup(
      [{ ...message, href: 'https://example.test' }],
      new Set(),
      permissions,
    ),
  ).toBeNull();
  expect(
    newMessagePopup(
      [{ ...message, sourceModule: 'other', eventType: 'other' }],
      new Set(),
      permissions,
    ),
  ).toBeNull();
});

it('ignores inaccessible and historical messages that newly enter the feed', () => {
  expect(newMessagePopup([message], new Set(), [])).toBeNull();
  expect(
    newMessagePopup([message], new Set(), permissions, '2026-11-05T11:00:00Z'),
  ).toBeNull();
});

it('shows a new assigned call-center request with its queue link', () => {
  const request = {
    ...message,
    id: 'request-1',
    sourceModule: 'customer-affairs',
    eventType: 'call-center.assigned',
    href: '/customer-affairs/call-center#cc-follow-up-queue',
  };
  expect(newMessagePopup([request], new Set(), permissions)).toEqual(request);
  expect(newMessagePopup([request], null, permissions)).toBeNull();
  expect(
    newMessagePopup([request], new Set([request.id]), permissions),
  ).toBeNull();
  expect(
    newMessagePopup([{ ...request, isRead: true }], new Set(), permissions),
  ).toBeNull();
  expect(newMessagePopup([request], new Set(), [])).toBeNull();
  expect(
    newMessagePopup([request], new Set(), permissions, '2026-11-06T00:00:00Z'),
  ).toBeNull();
  expect(
    newMessagePopup(
      [{ ...request, href: 'https://example.test' }],
      new Set(),
      permissions,
    ),
  ).toBeNull();
  expect(
    newMessagePopup(
      [{ ...request, eventType: 'call-center.closed' }],
      new Set(),
      permissions,
    ),
  ).toBeNull();
});
