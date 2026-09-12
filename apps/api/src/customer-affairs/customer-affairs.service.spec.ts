import { describe, expect, it, vi } from 'vitest';

import type {
  AuthenticatedActor,
  CustomerAffairsLeadInput,
} from '@rubi/contracts';
import { CustomerAffairsService } from './customer-affairs.service';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
} as unknown as AuthenticatedActor;

function service(
  repository: Record<string, unknown>,
  notifications = { createWithinTransaction: vi.fn() },
) {
  return new CustomerAffairsService(
    repository as never,
    { detail: vi.fn() } as never,
    { detail: vi.fn() } as never,
    { detail: vi.fn() } as never,
    { purchaseContext: vi.fn() } as never,
    notifications as never,
  );
}

const lead: CustomerAffairsLeadInput = {
  title: 'درخواست سفر نمونه',
  sourceReference: 'source-1',
  inboundChannel: 'PHONE',
  contactOccurredAt: '2026-09-12T08:00:00.000Z',
  travelNeed: 'سفر خانوادگی',
  passengerCount: 2,
  priority: 'NORMAL',
  nextAction: 'تماس بعدی',
  nextActionAt: '2026-09-12T09:00:00.000Z',
};

describe('CustomerAffairsService safety invariants', () => {
  it('rejects a lead without an owner or queue before persistence', async () => {
    const repository = { findLeadCommand: vi.fn().mockResolvedValue(null) };
    await expect(
      service(repository).createLead(lead, actor, undefined, 'key-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LEAD_ASSIGNMENT_REQUIRED' }),
    });
    expect(repository.findLeadCommand).toHaveBeenCalledOnce();
  });

  it('rejects a branch outside the authenticated scope before querying', async () => {
    const repository = { listLeads: vi.fn() };
    await expect(
      service(repository).listLeads(
        { branchId: '44444444-4444-4444-8444-444444444444' },
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CUSTOMER_AFFAIRS_BRANCH_FORBIDDEN',
      }),
    });
    expect(repository.listLeads).not.toHaveBeenCalled();
  });

  it('never lets an internal note become customer-visible', async () => {
    const repository = {
      findTicket: vi.fn().mockResolvedValue({
        id: 'ticket',
        branchId: actor.branchIds[0],
        firstRespondedAt: null,
      }),
    };
    await expect(
      service(repository).addTicketTimeline(
        'ticket',
        { type: 'NOTE', summary: 'یادداشت داخلی', customerVisible: true },
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INTERNAL_NOTE_CANNOT_BE_SENT',
      }),
    });
  });

  it('rejects satisfaction without a server-issued invitation token', async () => {
    const transaction = vi.fn(async (work) =>
      work({
        customerAffairsSatisfaction: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      }),
    );
    await expect(
      service({ transaction }).submitSatisfaction('forged-token', { score: 4 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SATISFACTION_INVITATION_INVALID',
      }),
    });
  });

  it('stores only a hash when a supervisor creates a satisfaction invitation', async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => ({
      id: 'survey',
      ...create,
    }));
    const transaction = vi.fn(async (work) =>
      work({
        customerAffairsSatisfaction: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert,
        },
        customerAffairsAuditEvent: { create: vi.fn() },
      }),
    );
    const result = await service({
      transaction,
      findTicket: vi.fn().mockResolvedValue({
        id: 'ticket',
        branchId: actor.branchIds[0],
        version: 3,
      }),
    }).createSatisfactionInvitation('ticket', actor);
    const stored = upsert.mock.calls[0]?.[0].create
      .invitationReference as string;
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(result.data.token).not.toBe(stored);
    expect(result.data).not.toHaveProperty('invitationReference');
  });

  it('creates one owned corrective action for a low customer score', async () => {
    const notifications = { createWithinTransaction: vi.fn() };
    const correctiveCreate = vi.fn().mockResolvedValue({ id: 'action' });
    const transaction = vi.fn(async (work) =>
      work({
        customerAffairsSatisfaction: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'survey',
            ticketId: 'ticket',
            invitationReference:
              '8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8',
            score: null,
            expiresAt: new Date(Date.now() + 60_000),
            ticket: {
              id: 'ticket',
              branchId: actor.branchIds[0],
              customerOwnerUserId: actor.userId,
              trackingNumber: 'CA-T-TEST',
              version: 2,
            },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        customerAffairsCorrectiveAction: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: correctiveCreate,
        },
        customerAffairsAuditEvent: { create: vi.fn() },
      }),
    );
    const result = await service(
      { transaction },
      notifications,
    ).submitSatisfaction('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      score: 2,
      comment: 'نیازمند پیگیری',
    });
    expect(result.data.score).toBe(2);
    expect(correctiveCreate).toHaveBeenCalledOnce();
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorUserId: null }),
    );
  });
});
