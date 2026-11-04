import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { PassengerCorrectionCrypto } from './passenger-correction.crypto';
import { CustomerService } from '../../customers/customer.service';
import {
  PassengerCorrectionService,
  correctionDay,
  PASSENGER_CORRECTION,
} from './passenger-correction.service';

const id = '10000000-0000-4000-8000-000000000001';
const customerId = '20000000-0000-4000-8000-000000000001';
const operationId = '30000000-0000-4000-8000-000000000001';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: [
    'sales.contracts.update.own',
    'sales.contracts.read.own',
    'customers.sensitive.read',
  ],
} as AuthenticatedActor;
const cipher = () =>
  new PassengerCorrectionCrypto(
    new ConfigService({
      CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
    }),
  );
const person = {
  customerId,
  birthDate: '1990-02-03',
  passportNumber: 'NEW1234',
  passportExpiryDate: '2030-01-01',
};
const input = () => ({
  operationId,
  expectedVersion: 3,
  passengers: [person],
  note: 'Synthetic reservation note',
});
function setup() {
  const row = {
    id,
    branchId: 'branch',
    ownerUserId: 'owner',
    assignedUserId: null as string | null,
    status: 'SENT_TO_RESERVATIONS',
    version: 3,
    contractNumber: 'SC-SYNTHETIC',
    departureDate: new Date('2026-12-01'),
    passengers: [
      {
        customerId,
        displayNameSnapshot: 'Synthetic passenger',
        birthDate: new Date('1990-01-01'),
        ageCategory: 'ADT',
      },
    ],
  };
  type Audit = {
    id?: string;
    contractId: string;
    action: string;
    actorUserId: string;
    afterSnapshot?: unknown;
    occurredAt: Date;
  };
  const events: Audit[] = [];
  const audit = {
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { contractId: string; action: string; id?: string };
      }) =>
        events.find(
          (e) =>
            e.contractId === where.contractId &&
            e.action === where.action &&
            (!where.id || e.id === where.id),
        ) ?? null,
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        events.find((e) => e.id === where.id) ?? null,
    ),
    findMany: vi.fn(async () =>
      events.filter((e) => e.action === PASSENGER_CORRECTION),
    ),
    create: vi.fn(async ({ data }: { data: Omit<Audit, 'occurredAt'> }) => {
      const e = { ...data, occurredAt: new Date() };
      events.unshift(e);
      return e;
    }),
  };
  const tx = {
    salesContract: {
      updateMany: vi.fn(async () => {
        row.version++;
        return { count: 1 };
      }),
    },
    salesContractPassenger: {
      update: vi.fn(async ({ data }: { data: { birthDate: Date } }) => {
        row.passengers[0]!.birthDate = data.birthDate;
      }),
    },
    salesContractAuditEvent: audit,
  };
  const database = {
    client: {
      salesContract: {
        findFirst: vi.fn(
          async ({ where }: { where: { branchId: { in: string[] } } }) =>
            where.branchId.in.includes(row.branchId) ? row : null,
        ),
      },
      salesContractAuditEvent: audit,
      $transaction: vi.fn(
        async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
      ),
    },
  };
  const customers = {
    salesEntryActor: vi.fn(CustomerService.prototype.salesEntryActor),
    detail: vi.fn(async () => ({
      data: { passportNumber: 'OLD1234', passportExpiryDate: '2030-01-01' },
    })),
  };
  const directory = {
    names: vi.fn(async () => new Map([['owner', 'Synthetic agent']])),
    recipients: vi.fn(async () => ['reservation-user']),
  };
  const notifications = {
    createWithinTransaction: vi.fn(async () => undefined),
  };
  const crypto = cipher();
  const service = new PassengerCorrectionService(
    database as never,
    customers as never,
    directory as never,
    notifications as never,
    crypto,
  );
  return {
    service,
    row,
    events,
    tx,
    database,
    customers,
    directory,
    notifications,
    crypto,
    audit,
  };
}
describe('contract-specific passenger correction', () => {
  it('retains existing sensitive readers without requiring the new-contract route', async () => {
    const s = setup();
    const reader = {
      ...actor,
      permissions: [...actor.permissions, 'sales.contracts.create'],
    } as AuthenticatedActor;
    await expect(s.service.form(id, reader)).resolves.toHaveProperty(
      'passengers',
    );
    expect(s.customers.salesEntryActor).not.toHaveBeenCalled();
    expect(s.customers.detail).toHaveBeenCalledWith(
      customerId,
      reader,
      undefined,
      'customer-verification',
    );
  });
  it('lets a contract creator read owned passenger details using request-local Sales capabilities', async () => {
    const s = setup();
    const creator = {
      ...actor,
      permissions: ['sales.contracts.create'],
    } as AuthenticatedActor;
    await expect(s.service.form(id, creator)).resolves.toHaveProperty(
      'passengers',
    );
    expect(s.customers.detail).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({
        permissions: expect.arrayContaining(['customers.sensitive.read']),
      }),
      undefined,
      'customer-verification',
    );
    expect(creator.permissions).toEqual(['sales.contracts.create']);
    s.customers.detail.mockClear();
    s.row.ownerUserId = 'other';
    await expect(s.service.form(id, creator)).rejects.toThrow();
    expect(s.customers.detail).not.toHaveBeenCalled();
  });
  it('denies reading or changing another seller contract even when assigned to the actor', async () => {
    const s = setup();
    s.row.ownerUserId = 'other';
    s.row.assignedUserId = actor.userId;
    await expect(s.service.contract(id, actor)).rejects.toThrow('مجوز');
    await expect(s.service.correct(id, input(), actor)).rejects.toThrow('مجوز');
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
  it('encrypts evidence with randomized nonces and binds it to the contract', () => {
    const c = cipher(),
      e = c.protect(id, person);
    expect(JSON.stringify(e)).not.toContain(person.passportNumber);
    expect(c.decrypt(id, e)).toEqual(person);
    expect(c.protect(id, person).iv).not.toEqual(e.iv);
    expect(() => c.decrypt('other-contract', e)).toThrow('integrity');
    expect(() => c.decrypt(id, { ...e, keyVersion: 2 })).toThrow('integrity');
    expect(() =>
      c.decrypt(id, { ...e, tag: Buffer.alloc(16).toString('base64') }),
    ).toThrow('integrity');
  });
  it.each(['2026-02-30', '2026-13-01', '01/02/2026', 'garbage', undefined])(
    'rejects invalid date %s',
    (value) => expect(() => correctionDay(value, true)).toThrow(),
  );
  it('writes version, DOB, encrypted history and exact notification in one serializable transaction', async () => {
    const s = setup();
    expect(await s.service.correct(id, input(), actor)).toEqual({
      version: 4,
      id: operationId,
    });
    expect(s.database.client.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(s.tx.salesContract.updateMany).toHaveBeenCalledWith({
      where: { id, version: 3, status: 'SENT_TO_RESERVATIONS' },
      data: { version: { increment: 1 } },
    });
    expect(s.row.passengers[0]!.birthDate.toISOString()).toBe(
      '1990-02-03T00:00:00.000Z',
    );
    const event = s.events.find((e) => e.action === PASSENGER_CORRECTION)!;
    expect(JSON.stringify(event)).not.toContain('NEW1234');
    expect(s.notifications.createWithinTransaction).toHaveBeenCalledWith(
      s.tx,
      expect.objectContaining({
        recipientUserIds: ['reservation-user'],
        href: `/reservations?correctionContract=${id}&correctionEvent=${operationId}`,
        message: expect.stringContaining('SC-SYNTHETIC'),
      }),
    );
    expect(s.customers.detail).toHaveBeenCalledTimes(1);
    const effective = await s.service.effective(id, actor);
    expect(effective.get(customerId)).toMatchObject(person);
  });
  it('retries an identical command without duplicate updates or notifications', async () => {
    const s = setup();
    await s.service.correct(id, input(), actor);
    expect(await s.service.correct(id, input(), actor)).toEqual({
      version: 4,
      id: operationId,
    });
    expect(s.notifications.createWithinTransaction).toHaveBeenCalledTimes(1);
    await expect(
      s.service.correct(id, { ...input(), note: 'different' }, actor),
    ).rejects.toThrow('شناسه');
  });
  it('records actor and exact before/after; masks sensitive values for ordinary Reservations readers', async () => {
    const s = setup();
    await s.service.correct(id, input(), actor);
    const h = await s.service.history(id, actor, undefined, operationId);
    expect(h.items[0]).toMatchObject({
      actorName: 'Synthetic agent',
      note: input().note,
      version: 4,
    });
    expect(h.items[0]!.changes).toContainEqual(
      expect.objectContaining({
        field: 'passportNumber',
        before: 'OLD1234',
        after: 'NEW1234',
      }),
    );
    expect(s.audit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: operationId, contractId: id }),
      }),
    );
    const restricted = {
      ...actor,
      permissions: ['reservations.read'],
    } as AuthenticatedActor;
    const masked = await s.service.history(id, restricted);
    expect(
      masked.items[0]!.changes.every(
        (c) => c.masked && c.before === null && c.after === null,
      ),
    ).toBe(true);
    expect((await s.service.effective(id, restricted)).size).toBe(0);
  });
  it('allows a note-only correction without rewriting passengers', async () => {
    const s = setup();
    await s.service.correct(id, { ...input(), passengers: [] }, actor);
    expect(s.tx.salesContractPassenger.update).not.toHaveBeenCalled();
    expect((await s.service.history(id, actor)).items[0]!.changes).toEqual([]);
  });
  it('rejects branch isolation, non-owner writes and missing sensitive permission', async () => {
    const s = setup();
    await expect(
      s.service.form(id, { ...actor, branchIds: ['other'] }),
    ).rejects.toThrow('یافت');
    await expect(
      s.service.correct(id, input(), { ...actor, userId: 'other' }),
    ).rejects.toThrow('مجوز');
    await expect(
      s.service.correct(id, input(), {
        ...actor,
        permissions: ['sales.contracts.update.own'],
      } as AuthenticatedActor),
    ).rejects.toThrow('حساس');
    expect(s.database.client.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    { expectedVersion: 2 },
    { passengers: [{ ...person, customerId: id }] },
    { passengers: [person, person] },
    { passengers: [{ ...person, birthDate: '2020-01-01' }] },
    { passengers: [{ ...person, passportNumber: 'bad spaces' }] },
    { passengers: [{ ...person, passportExpiryDate: '2020-01-01' }] },
    { passengers: [], note: '' },
  ])(
    'rejects invalid, stale or commercially different command %#',
    async (overrides) => {
      const s = setup();
      await expect(
        s.service.correct(id, { ...input(), ...overrides }, actor),
      ).rejects.toThrow();
      expect(s.database.client.$transaction).not.toHaveBeenCalled();
    },
  );
  it('rejects CAS loss before any passenger/audit/notification write', async () => {
    const s = setup();
    s.tx.salesContract.updateMany.mockImplementationOnce(async () => ({
      count: 0,
    }));
    await expect(s.service.correct(id, input(), actor)).rejects.toThrow(
      'هم‌زمان',
    );
    expect(s.tx.salesContractPassenger.update).not.toHaveBeenCalled();
    expect(s.audit.create).not.toHaveBeenCalled();
    expect(s.notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('rejects a history cursor belonging to a different contract', async () => {
    const s = setup();
    await expect(s.service.history(id, actor, operationId)).rejects.toThrow(
      'فیلتر',
    );
  });
});
it('allows a contract-area creator to read and edit their own passenger correction without separate grants', async () => {
  const t = setup();
  const creator = {
    ...actor,
    permissions: ['sales.contracts.create'],
  } as AuthenticatedActor;
  await expect(t.service.contract(id, creator)).resolves.toHaveProperty(
    'id',
    id,
  );
  await expect(t.service.contract(id, creator, true)).resolves.toHaveProperty(
    'id',
    id,
  );
  t.row.ownerUserId = 'other';
  await expect(t.service.contract(id, creator, true)).rejects.toThrow();
});
