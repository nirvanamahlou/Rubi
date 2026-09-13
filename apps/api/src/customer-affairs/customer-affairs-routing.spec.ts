import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  CustomerAffairsLeadInput,
  CustomerAffairsTicketInput,
} from '@rubi/contracts';
import { CustomerAffairsService } from './customer-affairs.service';

const actor = {
  userId: 'agent',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
const leadInput: CustomerAffairsLeadInput = {
  title: 'درخواست سفر',
  sourceReference: 'source',
  inboundChannel: 'PHONE',
  contactOccurredAt: '2026-09-12T08:00:00Z',
  travelNeed: 'سفر خانوادگی',
  passengerCount: 2,
  priority: 'NORMAL',
  nextAction: 'تماس بعدی',
  nextActionAt: '2026-09-15T08:00:00Z',
  assigneeUserId: 'new-owner',
  expectedVersion: 1,
};
const ticketInput: CustomerAffairsTicketInput = {
  subject: 'پیگیری صدور',
  description: 'پیگیری دریافت مدرک سفر',
  channel: 'PHONE',
  contactOccurredAt: '2026-09-12T08:00:00Z',
  category: 'ISSUANCE',
  impact: 'LOW',
  urgency: 'LOW',
  priority: 'NORMAL',
  nextAction: 'پیگیری صدور بلیت',
  nextActionAt: '2026-09-15T08:00:00Z',
  expectedVersion: 1,
};

function setup(
  kind: 'lead' | 'ticket',
  changed: Record<string, unknown>,
  count = 1,
) {
  const current = {
    id: 'record',
    branchId: 'branch',
    version: 1,
    trackingNumber: 'CA-1',
    assigneeUserId: 'old',
    customerOwnerUserId: 'old',
    executionOwnerUserId: null,
  };
  const row = { ...current, ...changed, version: 2 };
  const model = {
    updateMany: vi.fn().mockResolvedValue({ count }),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
  };
  const tx = {
    customerAffairsLead: model,
    customerAffairsTicket: model,
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const repository = {
    findLead: vi.fn().mockResolvedValue(current),
    findTicket: vi.fn().mockResolvedValue(current),
    transaction: vi.fn(async (work) => work(tx)),
  };
  const service = new CustomerAffairsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  if (kind === 'lead')
    vi.spyOn(service, 'getLead').mockResolvedValue({ data: {} } as never);
  else vi.spyOn(service, 'getTicket').mockResolvedValue({ data: {} } as never);
  return { service, notifications, tx, current };
}

describe('Customer Affairs backend routing', () => {
  it('notifies a new lead assignee within the mutation transaction', async () => {
    const { service, notifications, tx } = setup('lead', {
      assigneeUserId: 'new-owner',
    });
    await service.updateLead('record', leadInput, actor);
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserIds: ['new-owner'],
        eventType: 'lead.assigned',
        href: '/customer-affairs?view=leads&lead=record',
      }),
    );
  });
  it('does not notify on an ordinary edit or clearing the assignee to a queue', async () => {
    for (const assigneeUserId of ['old', null]) {
      const { service, notifications } = setup('lead', { assigneeUserId });
      await service.updateLead(
        'record',
        { ...leadInput, assigneeUserId, queueCode: 'inbox' },
        actor,
      );
      expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
    }
  });
  it('never sends an assignment notification when the version is stale', async () => {
    const { service, notifications } = setup(
      'lead',
      { assigneeUserId: 'new' },
      0,
    );
    await expect(
      service.updateLead('record', leadInput, actor),
    ).rejects.toThrow();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('deduplicates the new ticket customer/execution owner', async () => {
    const { service, notifications, tx } = setup('ticket', {
      customerOwnerUserId: 'new',
      executionOwnerUserId: 'new',
    });
    await service.updateTicket(
      'record',
      { ...ticketInput, impact: 'LOW', urgency: 'LOW' },
      actor,
    );
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserIds: ['new'],
        href: '/customer-affairs?view=tickets&ticket=record',
      }),
    );
  });
  it('does not send ticket notifications to unchanged owners', async () => {
    const { service, notifications } = setup('ticket', {});
    await service.updateTicket(
      'record',
      { ...ticketInput, impact: 'LOW', urgency: 'LOW' },
      actor,
    );
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
});

function handoffSetup(
  status = 'WAITING_SALES',
  count = 1,
  assignee: string | null = 'owner',
) {
  const lead = {
    id: 'lead',
    branchId: 'branch',
    assigneeUserId: assignee,
    createdByUserId: 'creator',
    trackingNumber: 'CA-L-1',
  };
  const tx = {
    customerAffairsHandoff: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'handoff',
        leadId: 'lead',
        status,
        salesContractId: null,
        responseReason: 'تکمیل اطلاعات',
        packageVersion: 1,
        lead,
      }),
      updateMany: vi.fn().mockResolvedValue({ count }),
    },
    customerAffairsLead: { update: vi.fn().mockResolvedValue(lead) },
    customerAffairsTimeline: { create: vi.fn() },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const repository = { transaction: vi.fn(async (work) => work(tx)) };
  const service = new CustomerAffairsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  vi.spyOn(service, 'getLead').mockResolvedValue({ data: {} } as never);
  return { service, tx, notifications };
}

describe('Sales response return channel', () => {
  it('routes a response to the lead owner with a usable detail link', async () => {
    const { service, tx, notifications } = handoffSetup();
    await service.respondHandoff(
      'handoff',
      { status: 'RETURNED', reason: 'تکمیل اطلاعات' },
      actor,
    );
    expect(tx.customerAffairsHandoff.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'handoff', status: 'WAITING_SALES' },
      }),
    );
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserIds: ['owner'],
        eventType: 'handoff.responded',
        href: '/customer-affairs?view=leads&lead=lead',
      }),
    );
  });
  it('falls back to the creator for an unassigned queue lead', async () => {
    const { service, notifications } = handoffSetup('WAITING_SALES', 1, null);
    await service.respondHandoff(
      'handoff',
      { status: 'RETURNED', reason: 'تکمیل اطلاعات' },
      actor,
    );
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipientUserIds: ['creator'] }),
    );
  });
  it('does not write a duplicate response or notification on replay', async () => {
    const { service, tx, notifications } = handoffSetup('RETURNED');
    await service.respondHandoff(
      'handoff',
      { status: 'RETURNED', reason: 'تکمیل اطلاعات' },
      actor,
    );
    expect(tx.customerAffairsHandoff.updateMany).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
    await expect(
      service.respondHandoff(
        'handoff',
        { status: 'RETURNED', reason: 'دلیل دیگری' },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('stops a concurrent loser before modifying the lead or emitting a response', async () => {
    const { service, tx, notifications } = handoffSetup('WAITING_SALES', 0);
    await expect(
      service.respondHandoff(
        'handoff',
        { status: 'RETURNED', reason: 'تکمیل اطلاعات' },
        actor,
      ),
    ).rejects.toThrow();
    expect(tx.customerAffairsLead.update).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
});

function referralSetup(
  status = 'OPEN',
  responseSummary: string | null = null,
  count = 1,
) {
  const now = new Date('2026-09-12T12:00:00Z');
  const current = {
    id: 'referral',
    ticketId: 'ticket',
    assignedUserId: actor.userId,
    status,
    responseSummary,
    dueAt: now,
    createdAt: now,
    updatedAt: now,
    ticket: {
      branchId: 'branch',
      customerOwnerUserId: 'owner',
      trackingNumber: 'CA-T-1',
    },
  };
  const tx = {
    customerAffairsReferral: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        ...current,
        status: 'IN_PROGRESS',
        responseSummary: 'در حال بررسی',
      }),
    },
    customerAffairsTimeline: { create: vi.fn() },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const service = new CustomerAffairsService(
    { transaction: vi.fn(async (work) => work(tx)) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  return { service, tx, notifications, current };
}

describe('Workbench referral return channel', () => {
  it('writes the response, timeline and owner notification in the same transaction', async () => {
    const { service, tx, notifications } = referralSetup();
    await service.respondReferral(
      'referral',
      { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
      actor,
    );
    expect(tx.customerAffairsReferral.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'referral', status: 'OPEN', responseSummary: null },
      }),
    );
    expect(tx.customerAffairsTimeline.create).toHaveBeenCalledOnce();
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserIds: ['owner'],
        href: '/customer-affairs?view=tickets&ticket=ticket',
      }),
    );
  });
  it('does not repeat an in-progress response after a network retry', async () => {
    const { service, tx, notifications } = referralSetup(
      'IN_PROGRESS',
      'در حال بررسی',
    );
    await service.respondReferral(
      'referral',
      { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
      actor,
    );
    expect(tx.customerAffairsReferral.updateMany).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('does not reopen a completed referral', async () => {
    const { service, tx } = referralSetup('DONE', 'پایان رسیدگی');
    await expect(
      service.respondReferral(
        'referral',
        { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
        actor,
      ),
    ).rejects.toThrow();
    expect(tx.customerAffairsReferral.updateMany).not.toHaveBeenCalled();
  });
  it('rejects concurrent changes before timeline and notification writes', async () => {
    const { service, tx, notifications } = referralSetup('OPEN', null, 0);
    await expect(
      service.respondReferral(
        'referral',
        { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
        actor,
      ),
    ).rejects.toThrow();
    expect(tx.customerAffairsTimeline.create).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('retains branch and recipient authorization before any write', async () => {
    for (const deniedActor of [
      { ...actor, branchIds: ['other'] },
      { ...actor, userId: 'other' },
    ]) {
      const { service, tx } = referralSetup();
      await expect(
        service.respondReferral(
          'referral',
          { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
          deniedActor,
        ),
      ).rejects.toThrow();
      expect(tx.customerAffairsReferral.updateMany).not.toHaveBeenCalled();
    }
  });
  it('propagates notification failure to roll back the owning transaction', async () => {
    const { service, tx, notifications } = referralSetup();
    notifications.createWithinTransaction.mockRejectedValueOnce(
      new Error('notification unavailable'),
    );
    await expect(
      service.respondReferral(
        'referral',
        { status: 'IN_PROGRESS', responseSummary: 'در حال بررسی' },
        actor,
      ),
    ).rejects.toThrow('notification unavailable');
    expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
  });
});
