import { beforeEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { CheckoutTicketCapacity } from './checkout-ticket-capacity';
const now = new Date('2030-01-01T00:00:00Z');
const actor = {
  permissions: ['ticket_catalog.manage'],
  branchIds: ['branch'],
} as AuthenticatedActor;
const fixture = () => ({
  ticketPublishedOffer: {
    findFirst: vi.fn().mockResolvedValue({ id: 'offer' }),
  },
  ticketOfferCapacityHold: {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  websiteCheckoutSession: { findMany: vi.fn().mockResolvedValue([]) },
});
const row = {
  id: '00000000-0000-4000-8000-000000000001',
  quantity: 2,
  requesterName: 'Synthetic Operator Fixture',
  requesterPhone: '00000000000',
  expiresAt: new Date(now.getTime() + 600000),
  createdAt: now,
  paymentPendingAt: null,
  checkoutSessionId: 'session',
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
import { afterEach } from 'vitest';
afterEach(() => vi.useRealTimers());
it('projects only scoped website order references and anchors the deadline to server time', async () => {
  const f = fixture();
  f.ticketOfferCapacityHold.findMany.mockResolvedValue([row]);
  f.websiteCheckoutSession.findMany.mockResolvedValue([
    { id: 'session', siteCode: 'nss', externalId: 'SYNTHETIC-ORDER' },
  ]);
  const result = await new CheckoutTicketCapacity().roster(
    f as never,
    'offer',
    actor,
  );
  expect(result).toMatchObject({
    serverNow: now.toISOString(),
    hasMore: false,
    nextCursor: null,
    data: [
      {
        externalId: 'SYNTHETIC-ORDER',
        siteCode: 'nss',
        quantity: 2,
        remainingSeconds: 600,
      },
    ],
  });
  expect(f.websiteCheckoutSession.findMany).toHaveBeenCalledWith({
    where: { id: { in: ['session'] }, branchId: { in: ['branch'] } },
    select: { id: true, siteCode: true, externalId: true },
  });
  expect(
    f.ticketOfferCapacityHold.findMany.mock.calls[0]![0].where,
  ).toMatchObject({
    offerId: 'offer',
    branchId: { in: ['branch'] },
    status: 'ACTIVE',
  });
});
it('never exposes holds to an unauthorized or out-of-branch operator', async () => {
  const f = fixture(),
    service = new CheckoutTicketCapacity();
  await expect(
    service.roster(f as never, 'offer', { ...actor, permissions: [] }),
  ).rejects.toThrow();
  expect(f.ticketPublishedOffer.findFirst).not.toHaveBeenCalled();
  f.ticketPublishedOffer.findFirst.mockResolvedValue(null);
  await expect(service.roster(f as never, 'offer', actor)).rejects.toThrow();
  expect(f.ticketOfferCapacityHold.findMany).not.toHaveBeenCalled();
});
it('preserves pinned bank holds past the deadline without announcing remaining seconds', async () => {
  const f = fixture();
  f.ticketOfferCapacityHold.findMany.mockResolvedValue([
    {
      ...row,
      expiresAt: new Date(now.getTime() - 1000),
      paymentPendingAt: now,
    },
  ]);
  const result = await new CheckoutTicketCapacity().roster(
    f as never,
    'offer',
    actor,
  );
  expect(result.data[0]).toMatchObject({
    remainingSeconds: null,
    paymentPendingAt: now.toISOString(),
  });
  expect(f.ticketOfferCapacityHold.findMany.mock.calls[0]![0].where.OR).toEqual(
    [
      { expiresAt: { gt: now } },
      { checkoutSessionId: { not: null }, paymentPendingAt: { not: null } },
    ],
  );
});
it('returns explicit continuation after100 rows and uses a same-offer scoped keyset', async () => {
  const f = fixture(),
    service = new CheckoutTicketCapacity();
  const rows = Array.from({ length: 101 }, (_, i) => ({
    ...row,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  }));
  f.ticketOfferCapacityHold.findMany.mockResolvedValue(rows);
  const first = await service.roster(f as never, 'offer', actor);
  expect(first.data).toHaveLength(100);
  expect(first.hasMore).toBe(true);
  expect(first.nextCursor).toBe(rows[99]!.id);
  f.ticketOfferCapacityHold.findFirst.mockResolvedValue({
    id: first.nextCursor,
    createdAt: now,
  });
  f.ticketOfferCapacityHold.findMany.mockResolvedValue([rows[100]]);
  const second = await service.roster(
    f as never,
    'offer',
    actor,
    first.nextCursor!,
  );
  expect(second.hasMore).toBe(false);
  expect(second.nextCursor).toBeNull();
  expect(f.ticketOfferCapacityHold.findFirst).toHaveBeenCalledWith({
    where: {
      id: first.nextCursor,
      offerId: 'offer',
      branchId: { in: ['branch'] },
    },
    select: { id: true, createdAt: true },
  });
});
it('rejects invalid or foreign pagination cursors before listing holds', async () => {
  const f = fixture(),
    service = new CheckoutTicketCapacity();
  await expect(
    service.roster(f as never, 'offer', actor, 'bad'),
  ).rejects.toThrow();
  f.ticketOfferCapacityHold.findFirst.mockResolvedValue(null);
  await expect(
    service.roster(f as never, 'offer', actor, row.id),
  ).rejects.toThrow();
  expect(f.ticketOfferCapacityHold.findMany).not.toHaveBeenCalled();
});
