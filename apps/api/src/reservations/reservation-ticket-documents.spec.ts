import { describe, expect, it, vi } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { ReservationTicketDocumentsService } from './reservation-ticket-documents';
const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: ['reservations.read', 'reservations.documents.manage'],
} as unknown as AuthenticatedActor;
function fixture(automatic = true) {
  const rows: Array<{
    customerId: string;
    number: string;
    source: string;
    issuedAt: Date;
    intakeId: string;
    actorUserId: string;
  }> = [];
  let counter = 100000n;
  const tx = {
    $queryRaw: vi.fn(async (sql: { strings: readonly string[] }) =>
      sql.strings.join('').includes('nextval')
        ? [{ value: counter++ }]
        : sql.strings.join('').includes('SELECT 1 AS locked FROM')
          ? [{ locked: 1 }]
          : Promise.reject(new Error('Cannot deserialize PostgreSQL void')),
    ),
    auditEvent: { create: vi.fn(async () => ({})) },
    reservationIntake: {
      findFirst: vi.fn(async () => ({ workflowRevisions: [] })),
    },
    reservationTicketDocument: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            number?: string;
            intakeId_customerId?: { intakeId: string; customerId: string };
          };
        }) =>
          rows.find((r) =>
            where.number
              ? r.number === where.number
              : r.intakeId === where.intakeId_customerId?.intakeId &&
                r.customerId === where.intakeId_customerId?.customerId,
          ) ?? null,
      ),
      update: vi.fn(async () => ({})),
      create: vi.fn(
        async ({ data }: { data: Omit<(typeof rows)[number], 'issuedAt'> }) => {
          const row = { ...data, issuedAt: new Date('2026-10-01T08:00:00Z') };
          rows.push(row);
          return row;
        },
      ),
    },
  };
  let queue = Promise.resolve<unknown>(undefined);
  const database = {
    client: {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => {
        const result = queue.then(() => fn(tx));
        queue = result.catch(() => undefined);
        return result;
      }),
    },
  };
  const service = new ReservationTicketDocumentsService(
    database as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service, 'choices').mockResolvedValue([
    { customerId: 'passenger', automatic, document: null },
  ]);
  return { service, tx, rows, database };
}
describe('persisted ticket numbering', () => {
  it('replays concurrent company issuance with the same six-digit number and original UTC issue time', async () => {
    const { service, tx } = fixture();
    const [a, b] = await Promise.all([
      service.issue('intake', { customerId: 'passenger' }, actor),
      service.issue('intake', { customerId: 'passenger' }, actor),
    ]);
    expect(a).toEqual(b);
    expect(a.number).toBe('100000');
    expect(a.issuedAt).toBe('2026-10-01T08:00:00.000Z');
    expect(tx.reservationTicketDocument.create).toHaveBeenCalledTimes(1);
  });
  it('validates manual floating numbers and rejects an existing global number', async () => {
    const { service } = fixture(false);

    await expect(
      service.issue('a', { customerId: 'passenger', number: '12345' }, actor),
    ).rejects.toThrow('۶ رقم');
    await service.issue(
      'a',
      { customerId: 'passenger', number: '100000' },
      actor,
    );
    await expect(
      service.issue('b', { customerId: 'passenger', number: '100000' }, actor),
    ).rejects.toThrow('قبلاً');
  });
  it('skips numbers reserved manually when generating company numbers', async () => {
    const { service, rows } = fixture();
    rows.push({
      intakeId: 'other',
      customerId: 'other',
      actorUserId: 'actor',
      source: 'MANUAL',
      number: '100000',
      issuedAt: new Date(),
    });
    expect(
      (await service.issue('a', { customerId: 'passenger' }, actor)).number,
    ).toBe('100001');
  });
  it('rejects unauthorized actors and canceled intakes', async () => {
    const { service, tx } = fixture();

    await expect(
      service.issue(
        'a',
        { customerId: 'passenger' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow();
    tx.reservationIntake.findFirst.mockResolvedValueOnce({
      workflowRevisions: [{ state: { supplierStatus: 'CANCELLED' } }],
    } as never);
    await expect(
      service.issue('a', { customerId: 'passenger' }, actor),
    ).rejects.toThrow('ابطال');
    expect(tx.reservationTicketDocument.create).not.toHaveBeenCalled();
  });
  it('generates floating numbers and permits audited manual corrections with optimistic concurrency', async () => {
    const { service, tx } = fixture(false);
    const issued = await service.issue('a', { customerId: 'passenger' }, actor);
    expect(issued.number).toBe('100000');
    await expect(
      service.issue(
        'a',
        { customerId: 'passenger', number: '123456', expectedNumber: '999999' },
        actor,
      ),
    ).rejects.toThrow('تغییر');
    const corrected = await service.issue(
      'a',
      { customerId: 'passenger', number: '123456', expectedNumber: '100000' },
      actor,
    );
    expect(corrected.number).toBe('123456');
    expect(corrected.issuedAt).toBe(issued.issuedAt);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.reservationTicketDocument.update).toHaveBeenCalledTimes(1);
  });
  it('accepts a manual company number and rejects duplicate corrections', async () => {
    const { service, rows, tx } = fixture();
    await service.issue(
      'a',
      { customerId: 'passenger', number: '123456' },
      actor,
    );
    rows.push({ ...rows[0]!, intakeId: 'other', number: '654321' });
    await expect(
      service.issue(
        'a',
        { customerId: 'passenger', number: '654321', expectedNumber: '123456' },
        actor,
      ),
    ).rejects.toThrow('قبلاً');
    expect(tx.reservationTicketDocument.update).not.toHaveBeenCalled();
  });
  it('does not allocate a number for an unassigned passenger', async () => {
    const { service, tx } = fixture();
    await expect(
      service.issue('a', { customerId: 'other' }, actor),
    ).rejects.toThrow('تخصیص');
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('ticket supply numbering choices', () => {
  it.each([
    ['COMPANY', true],
    ['FLOATING', true],
    ['API', true],
    [null, true],
  ])('uses saved %s supply for automatic=%s', async (supply, automatic) => {
    const catalog = { documentSupply: vi.fn().mockResolvedValue(supply) };
    const workflow = {
      detail: vi.fn().mockResolvedValue({
        workflow: { supplierStatus: 'PENDING' },
        snapshot: {
          serviceSelections: [],
          ticketSelections: [
            {
              offerId: 'offer',
              serviceClientKey: 'out',
              direction: 'OUTBOUND',
              departureAt: '2026-10-03T10:00:00Z',
            },
          ],
          passengerIds: ['passenger'],
          passengerAssignments: [
            { customerId: 'passenger', serviceClientKeys: ['out'] },
          ],
        },
        ticketDocuments: [],
      }),
    };
    const service = new ReservationTicketDocumentsService(
      {} as never,
      workflow as never,
      catalog as never,
    );
    expect(await service.choices('intake', actor)).toEqual([
      { customerId: 'passenger', automatic, document: null },
    ]);
    expect(catalog.documentSupply).not.toHaveBeenCalled();
  });
});

const testDatabaseUrl = process.env.TICKET_DOCUMENTS_TEST_DATABASE_URL;
describe.skipIf(!testDatabaseUrl)('ticket issuance locks on PostgreSQL', () => {
  it('registers a manual number through real Prisma advisory locks without void decoding', async () => {
    if (
      !testDatabaseUrl ||
      !['localhost', '127.0.0.1'].includes(new URL(testDatabaseUrl).hostname)
    )
      throw new Error('Local test database required');
    const client = createDatabaseClient(testDatabaseUrl);
    const { service, tx, database } = fixture(false);
    const rollback = new Error('ROLLBACK_ONLY');
    try {
      await expect(
        client.$transaction(async (pgTx) => {
          database.client.$transaction.mockImplementationOnce(async (fn) =>
            fn({ ...tx, $queryRaw: pgTx.$queryRaw.bind(pgTx) } as typeof tx),
          );
          expect(
            (
              await service.issue(
                'intake',
                { customerId: 'passenger', number: '250415' },
                actor,
              )
            ).number,
          ).toBe('250415');
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    } finally {
      await client.$disconnect();
    }
  });
});
