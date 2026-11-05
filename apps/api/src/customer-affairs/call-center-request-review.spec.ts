import type { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';
import {
  pendingReviewToken,
  recordCallRequestReview,
} from './call-center-request-review';

const input = {
  branchId: 'branch',
  actorUserId: 'expert',
  synthetic: false,
  completedAt: new Date('2026-11-05T10:00:00Z'),
  call: {
    id: 'call',
    contactId: 'contact',
    ticketId: 'request',
    origin: 'TELEPHONY',
    occurredAt: new Date('2026-11-05T09:00:00Z'),
    outcome: 'NO_ANSWER',
  },
};

function fixture() {
  const rows = new Map<
    string,
    {
      id: string;
      ticketId: string;
      callId: string;
      completedByUserId: string;
      completedAt: Date;
      reviewedAt: Date | null;
    }
  >();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    customerAffairsTicket: {
      findFirst: vi.fn().mockResolvedValue({ id: 'request', version: 3 }),
    },
    callCenterRequestReview: {
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Omit<
            typeof rows extends Map<string, infer R> ? R : never,
            'reviewedAt'
          >;
        }) => {
          const key = data.ticketId + ':' + data.callId;
          if (rows.has(key)) return { count: 0 };
          rows.set(key, { ...data, reviewedAt: null });
          return { count: 1 };
        },
      ),
    },
    customerAffairsAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient, rows };
}

describe('explicit linked call follow-up receipts', () => {
  it.each(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'WRONG_NUMBER'])(
    'records a saved %s result without changing owner or business status',
    async (outcome) => {
      const { tx, client, rows } = fixture();
      expect(
        await recordCallRequestReview(client, {
          ...input,
          call: { ...input.call, outcome },
        }),
      ).toBe(true);
      expect([...rows.values()]).toEqual([
        expect.objectContaining({
          ticketId: 'request',
          callId: 'call',
          completedByUserId: 'expert',
          completedAt: input.completedAt,
          reviewedAt: null,
        }),
      ]);
      expect(tx.customerAffairsAuditEvent.create).toHaveBeenCalledWith({
        data: {
          branchId: 'branch',
          actorUserId: 'expert',
          entityType: 'CALL_CENTER_REQUEST',
          entityId: 'request',
          action: 'REQUEST_FOLLOWUP_RECORDED',
          version: 3,
          afterSnapshot: { reviewId: expect.any(String), callId: 'call' },
          occurredAt: input.completedAt,
        },
      });
      // Only the read port is available: receipt creation cannot silently close
      // or reassign the business request.
      expect(Object.keys(tx.customerAffairsTicket)).toEqual(['findFirst']);
    },
  );

  it.each([
    { synthetic: true },
    { synthetic: undefined },
    { call: { ...input.call, origin: 'MANUAL' } },
    { call: { ...input.call, origin: 'SYNTHETIC' } },
    { call: { ...input.call, origin: null } },
    { call: { ...input.call, ticketId: null } },
    { call: { ...input.call, outcome: null } },
    { call: { ...input.call, outcome: '' } },
    { call: { ...input.call, outcome: 'UNKNOWN' } },
  ])('does not record an ineligible call (%j)', async (override) => {
    const { tx, client, rows } = fixture();
    expect(
      await recordCallRequestReview(client, { ...input, ...override }),
    ).toBe(false);
    expect(rows.size).toBe(0);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
  });

  it('requires the current open request, matching branch/contact/assignee and a new-enough call under SHARE lock', async () => {
    const { tx, client, rows } = fixture();
    tx.customerAffairsTicket.findFirst.mockResolvedValue(null);
    expect(await recordCallRequestReview(client, input)).toBe(false);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    const query = tx.$queryRaw.mock.calls[0]![0] as TemplateStringsArray;
    expect(query.join('?')).toContain('FOR SHARE');
    expect(query.join('?')).not.toContain('FOR UPDATE');
    expect(tx.customerAffairsTicket.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'request',
        branchId: 'branch',
        callCenterContactId: 'contact',
        category: 'CALL_CENTER_REQUEST',
        status: { not: 'CLOSED' },
        executionOwnerUserId: 'expert',
        createdAt: { lte: input.call.occurredAt },
      },
      select: { id: true, version: true },
    });
    expect(tx.customerAffairsTicket.findFirst).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.customerAffairsTicket.findFirst.mock.invocationCallOrder[0]!,
    );
    expect(rows.size).toBe(0);
    expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
  });

  it('never refreshes or requeues the same call after manager review; a new call queues again', async () => {
    const { tx, client, rows } = fixture();
    expect(await recordCallRequestReview(client, input)).toBe(true);
    const first = rows.get('request:call')!;
    const originalId = first.id;
    expect(await recordCallRequestReview(client, input)).toBe(false);
    first.reviewedAt = new Date('2026-11-05T11:00:00Z');
    expect(
      await recordCallRequestReview(client, {
        ...input,
        completedAt: new Date('2026-11-05T12:00:00Z'),
        call: { ...input.call, outcome: 'ANSWERED' },
      }),
    ).toBe(false);
    expect(first.id).toBe(originalId);
    expect(first.completedAt).toEqual(input.completedAt);
    expect(pendingReviewToken([...rows.values()])).toBeNull();
    expect(
      await recordCallRequestReview(client, {
        ...input,
        call: { ...input.call, id: 'second-call' },
      }),
    ).toBe(true);
    expect(pendingReviewToken([...rows.values()])).not.toBeNull();
    expect(tx.customerAffairsAuditEvent.create).toHaveBeenCalledTimes(2);
  });

  it('propagates audit failure so the enclosing call-save transaction can roll back', async () => {
    const { tx, client } = fixture();
    tx.customerAffairsAuditEvent.create.mockRejectedValueOnce(
      Error('audit unavailable'),
    );
    await expect(recordCallRequestReview(client, input)).rejects.toThrow(
      'audit unavailable',
    );
  });
});

describe('pending manager review token', () => {
  it('is null for no pending work and ignores already reviewed receipts', () => {
    expect(pendingReviewToken([])).toBeNull();
    expect(
      pendingReviewToken([{ id: 'old', reviewedAt: new Date() }]),
    ).toBeNull();
    expect(
      pendingReviewToken([
        { id: 'old', reviewedAt: new Date() },
        { id: 'pending', reviewedAt: null },
      ]),
    ).toBe(pendingReviewToken([{ id: 'pending' }]));
  });

  it('is order independent and changes for every newly arrived pending receipt', () => {
    const first = pendingReviewToken([{ id: 'a' }, { id: 'b' }]);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(pendingReviewToken([{ id: 'b' }, { id: 'a' }])).toBe(first);
    expect(
      pendingReviewToken([{ id: 'a' }, { id: 'b' }, { id: 'earlier' }]),
    ).not.toBe(first);
    expect(pendingReviewToken([{ id: 'a' }])).not.toBe(first);
  });
});
