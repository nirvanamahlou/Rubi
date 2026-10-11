import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';

const url = process.env.ACCOUNTING_MIGRATION_TEST_DATABASE_URL;
const ids = {
  branch: '11111111-1111-4111-8111-111111111111',
  actor: '22222222-2222-4222-8222-222222222222',
  book: '33333333-3333-4333-8333-333333333333',
  cancelled: '99999999-9999-4999-8999-999999999999',
  restoredBeforeAudit: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  oldCommand: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} as const;

describe.skipIf(!url)('accounting parity migration history rehearsal', () => {
  let db: DatabaseClient, service: AccountingService;
  const actor: AuthenticatedActor = {
    userId: ids.actor,
    sessionId: randomUUID(),
    branchIds: [ids.branch],
    permissions: [
      'finance.read',
      'finance.journal.read',
      'finance.journal.create',
    ],
  };

  beforeAll(() => {
    const target = new URL(url!);
    if (target.hostname !== '127.0.0.1' || target.port !== '55437')
      throw new Error('Dedicated accounting rehearsal database required.');
    db = createDatabaseClient(url);
    service = new AccountingService(
      { client: db } as never,
      {
        branches: async () => [
          { id: ids.branch, name: 'Migration rehearsal', code: 'MR' },
        ],
        displayNames: async () => [
          { id: ids.actor, displayName: 'Historical actor' },
        ],
      } as never,
    );
  });

  afterAll(async () => db?.$disconnect());

  it('leaves pre-migration cancelled/restored facts unknown and records only a prospective restore', async () => {
    const oldCommandBefore = await db.accountingCommand.findUniqueOrThrow({
      where: { id: ids.oldCommand },
    });
    expect(
      await db.accountingJournalStateEvent.count({
        where: {
          journalId: { in: [ids.cancelled, ids.restoredBeforeAudit] },
        },
      }),
    ).toBe(0);
    expect(
      await service.journalEvents(ids.book, ids.cancelled, actor),
    ).toMatchObject({ events: [], historicalGap: true });
    expect(
      await service.journalEvents(ids.book, ids.restoredBeforeAudit, actor),
    ).toMatchObject({ events: [], historicalGap: false });

    const startedAt = Date.now();
    const restored = (await service.command(
      ids.book,
      'restore',
      {
        key: randomUUID(),
        expectedVersion: 1,
        payload: { id: ids.cancelled, reason: 'Prospective restore rehearsal' },
      },
      actor,
    )) as { status: string; version: number };
    expect(restored).toMatchObject({ status: 'DRAFT', version: 2 });
    const history = await service.journalEvents(ids.book, ids.cancelled, actor);
    expect(history.historicalGap).toBe(false);
    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({
      actorId: ids.actor,
      eventType: 'STATUS',
      fromStatus: 'CANCELLED',
      toStatus: 'DRAFT',
      journalVersion: 2,
      reason: 'Prospective restore rehearsal',
    });
    expect(
      new Date(history.events[0]!.occurredAt).getTime(),
    ).toBeGreaterThanOrEqual(startedAt);

    const oldCommandAfter = await db.accountingCommand.findUniqueOrThrow({
      where: { id: ids.oldCommand },
    });
    expect(oldCommandAfter).toEqual(oldCommandBefore);
  });
});
