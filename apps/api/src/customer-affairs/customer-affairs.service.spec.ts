import { describe, expect, it, vi } from 'vitest';

import type {
  AuthenticatedActor,
  CustomerAffairsLeadInput,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
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
    {} as never,
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
  it('persists the first assessment and returns it again after re-evaluation', async () => {
    const row = {
      id: 'lead-1',
      trackingNumber: 'CA-L-1',
      branchId: actor.branchIds[0],
      title: lead.title,
      sourceReference: lead.sourceReference,
      inboundChannel: lead.inboundChannel,
      contactOccurredAt: new Date(lead.contactOccurredAt),
      travelNeed: lead.travelNeed,
      nextAction: lead.nextAction,
      nextActionAt: new Date(lead.nextActionAt),
      priority: lead.priority,
      createdAt: new Date(lead.contactOccurredAt),
      updatedAt: new Date(lead.contactOccurredAt),
      version: 1,
      stage: 'NEW',
      qualification: null as Record<string, unknown> | null,
      contactFingerprint: null,
      requestedServices: [],
      timeline: [] as Array<{
        id: string;
        type: string;
        summary: string;
        occurredAt: Date;
      }>,
      handoffs: [],
    };
    const updateMany = vi.fn(async ({ where, data }) => {
      if (
        where.id !== row.id ||
        where.version !== row.version ||
        !where.stage.in.includes(row.stage)
      )
        return { count: 0 };
      row.qualification = data.qualification;
      row.stage = data.stage;
      row.version += 1;
      return { count: 1 };
    });
    const timelineCreate = vi.fn(async ({ data }) => {
      row.timeline.unshift({
        id: `event-${row.version}`,
        type: data.type,
        summary: data.summary,
        occurredAt: new Date(),
      });
    });
    const repository = {
      findLead: vi.fn().mockImplementation(async () => row),
      duplicateLeads: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (work) =>
        work({
          customerAffairsLead: {
            updateMany,
            findUniqueOrThrow: vi.fn().mockImplementation(async () => row),
          },
          customerAffairsTimeline: { create: timelineCreate },
          customerAffairsAuditEvent: { create: vi.fn() },
        }),
      ),
    };
    const subject = service(repository);
    const first = await subject.qualify(
      row.id,
      {
        travelNeedConfirmed: true,
        destinationKnown: true,
        timingKnown: true,
        budgetDiscussed: true,
        decisionMakerReachable: true,
        contactable: false,
        conversionProbability: 65,
        expectedVersion: 1,
      },
      actor,
    );
    expect(first.data).toMatchObject({
      version: 2,
      stage: 'QUALIFIED',
      qualification: {
        state: 'QUALIFIED',
        score: 85,
        conversionProbability: 65,
        reasons: expect.arrayContaining(['نیاز سفر تایید شده']),
      },
      timeline: [expect.objectContaining({ type: 'STATUS_CHANGE' })],
    });
    expect(
      (await subject.getLead(row.id, actor)).data.qualification,
    ).toMatchObject({
      score: 85,
      conversionProbability: 65,
    });

    const second = await subject.qualify(
      row.id,
      {
        travelNeedConfirmed: true,
        destinationKnown: false,
        timingKnown: false,
        budgetDiscussed: false,
        decisionMakerReachable: false,
        contactable: true,
        expectedVersion: 2,
      },
      actor,
    );
    expect(second.data).toMatchObject({
      version: 3,
      stage: 'QUALIFYING',
      qualification: {
        state: 'NEEDS_REVIEW',
        score: 40,
        conversionProbability: 65,
      },
    });
    expect(
      (await subject.getLead(row.id, actor)).data.qualification,
    ).toMatchObject({
      score: 40,
      conversionProbability: 65,
    });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(timelineCreate).toHaveBeenCalledTimes(2);
    await expect(
      subject.qualify(
        row.id,
        {
          travelNeedConfirmed: false,
          destinationKnown: false,
          timingKnown: false,
          budgetDiscussed: false,
          decisionMakerReachable: false,
          contactable: false,
          expectedVersion: 2,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each(['LOST', 'HANDED_OFF', 'HANDOFF_PROPOSED'])(
    'rejects assessment of a %s lead before writing',
    async (stage) => {
      const repository = {
        findLead: vi.fn().mockResolvedValue({
          id: 'lead-1',
          branchId: actor.branchIds[0],
          stage,
          version: 1,
        }),
        transaction: vi.fn(),
      };
      await expect(
        service(repository).qualify(
          'lead-1',
          {
            travelNeedConfirmed: true,
            destinationKnown: true,
            timingKnown: true,
            budgetDiscussed: true,
            decisionMakerReachable: true,
            contactable: true,
            expectedVersion: 1,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({
          code: 'LEAD_QUALIFICATION_STAGE_INVALID',
        }),
      });
      expect(repository.transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a stage changed after reading the lead through the write predicate', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = {
      findLead: vi.fn().mockResolvedValue({
        id: 'lead-1',
        branchId: actor.branchIds[0],
        stage: 'NEW',
        version: 1,
      }),
      transaction: vi.fn(async (work) =>
        work({ customerAffairsLead: { updateMany } }),
      ),
    };
    await expect(
      service(repository).qualify(
        'lead-1',
        {
          travelNeedConfirmed: true,
          destinationKnown: true,
          timingKnown: true,
          budgetDiscussed: true,
          decisionMakerReachable: true,
          contactable: true,
          expectedVersion: 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'lead-1',
          version: 1,
          stage: { in: ['NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED'] },
        },
      }),
    );
  });

  it('builds a permission-aware dashboard without querying forbidden domains', async () => {
    const repository = {
      dashboard: vi.fn().mockResolvedValue({
        leads: { open: 2, overdue: 1, waitingSales: 0 },
        tickets: { open: 0, overdue: 0, breached: 0, correctiveActions: 0 },
      }),
    };
    const result = await service(repository).dashboard({
      ...actor,
      permissions: [
        'customer_affairs.lead.read',
        'customer_affairs.lead.create',
      ],
    });
    expect(result.data.access).toEqual({
      leadsRead: true,
      leadCreate: true,
      ticketsRead: false,
      ticketCreate: false,
      reportsRead: false,
    });
    expect(repository.dashboard).toHaveBeenCalledWith(actor.branchIds, {
      leadsRead: true,
      leadCreate: true,
      ticketsRead: false,
      ticketCreate: false,
      reportsRead: false,
    });
  });

  it('rejects a lead without an owner or queue before persistence', async () => {
    const repository = { findLeadCommand: vi.fn().mockResolvedValue(null) };
    await expect(
      service(repository).createLead(lead, actor, undefined, 'key-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LEAD_ASSIGNMENT_REQUIRED' }),
    });
    expect(repository.findLeadCommand).toHaveBeenCalledOnce();
  });

  it('does not return another lead as a successful create on source collision', async () => {
    const repository = {
      findLeadCommand: vi.fn().mockResolvedValue(null),
      findLeadBySource: vi.fn().mockResolvedValue({ id: 'existing-lead' }),
      transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.9.1',
        }),
      ),
    };
    await expect(
      service(repository).createLead(
        { ...lead, queueCode: 'customer-affairs-front-office' },
        actor,
        undefined,
        'new-command',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LEAD_SOURCE_REFERENCE_EXISTS',
      }),
    });
    expect(repository.findLeadCommand).toHaveBeenCalledTimes(2);
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
