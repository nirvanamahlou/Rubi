import type {
  AuthenticatedActor,
  CustomerAffairsTicketInput,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CustomerAffairsService } from './customer-affairs.service';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
} as unknown as AuthenticatedActor;

const input: CustomerAffairsTicketInput = {
  subject: 'پیگیری تنظیمات',
  description: 'بررسی SLA منتشرشده',
  channel: 'PHONE',
  contactOccurredAt: '2026-09-12T08:00:00.000Z',
  category: 'GENERAL',
  impact: 'NORMAL',
  urgency: 'NORMAL',
  priority: 'URGENT',
  nextAction: 'تماس با مشتری',
  nextActionAt: '2026-09-12T09:00:00.000Z',
};

describe('CustomerAffairsService system settings consumer', () => {
  it('uses the branch SLA and snapshots its setting version on new tickets', async () => {
    const now = new Date();
    const create = vi.fn().mockResolvedValue({
      id: 'ticket-1',
      version: 1,
      status: 'NEW',
      executionOwnerUserId: null,
    });
    const transaction = vi.fn(async (work) =>
      work({
        customerAffairsTicket: { create },
        customerAffairsTimeline: { create: vi.fn() },
        customerAffairsCommand: { create: vi.fn() },
        customerAffairsAuditEvent: { create: vi.fn() },
      }),
    );
    const service = new CustomerAffairsService(
      {
        findTicketCommand: vi.fn().mockResolvedValue(null),
        transaction,
      } as never,
      { detail: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { createWithinTransaction: vi.fn() } as never,
      {} as never,
      {
        json: vi.fn().mockResolvedValue({
          value: { urgent: '7', resolution: '2' },
          version: 4,
        }),
      } as never,
    );
    vi.spyOn(service, 'getTicket').mockResolvedValue({ data: {} } as never);

    await service.createTicket(input, actor, undefined, 'ticket-key');

    const data = create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data.slaPolicyVersion).toBe(
      'customer-affairs.elapsed-clock.v1:settings-4',
    );
    expect((data.firstResponseDueAt as Date).getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect((data.resolutionDueAt as Date).getTime()).toBeGreaterThan(
      (data.firstResponseDueAt as Date).getTime(),
    );
  });
});
