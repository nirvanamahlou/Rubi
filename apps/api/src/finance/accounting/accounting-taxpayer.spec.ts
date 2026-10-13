import { describe, it, expect, vi } from 'vitest';
import {
  AccountingTaxpayerService,
  taxpayerSellerValues,
} from './accounting-taxpayer.service';
import type { DatabaseService } from '../../database/database.service';
import type { AuthenticatedActor } from '@nora/contracts';
const bookId = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
const values = {
  fvwMain_lkpPartyType_ComboBox_Input: 'شرکت',
  fvwMain_txtNationalID: '001',
  fvwMain_txtEconomicID: '002',
  fvwMain_txtCivilParticipationID: '',
};
const actor = {
  userId: '33333333-3333-4333-8333-333333333333',
  permissions: [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
  ],
  branchIds: ['branch-a'],
} as AuthenticatedActor;
function fixture() {
  let row: Record<string, unknown> | null = null;
  const commands = new Map<string, Record<string, unknown>>();
  const tx = {
    accountingBook: {
      findFirst: vi.fn(async () => ({ id: bookId, branchId: 'branch-a' })),
    },
    accountingConfiguration: {
      findFirst: vi.fn(async () => row),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...data, version: 1 };
        return row;
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        row = {
          ...row,
          attributes: data.attributes,
          version: Number(row?.version) + 1,
        };
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => row),
    },
    accountingCommand: {
      findUnique: vi.fn(
        async ({ where }: { where: { bookId_key: { key: string } } }) =>
          commands.get(where.bookId_key.key) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        commands.set(String(data.key), data);
        return data;
      }),
    },
  };
  const client = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  return {
    service: new AccountingTaxpayerService({
      client,
    } as unknown as DatabaseService),
    tx,
  };
}
describe('taxpayer seller validation and isolation', () => {
  it('rejects extra fields, secrets and client-issued tax state', () => {
    for (const field of [
      'txtDirectPrivate',
      'status',
      'acknowledgment',
      'invented',
    ])
      expect(() => taxpayerSellerValues({ ...values, [field]: 'x' })).toThrow();
  });
  it('preserves identifiers including leading zeros and enforces observed conditional fields', () => {
    expect(taxpayerSellerValues(values).fvwMain_txtNationalID).toBe('001');
    expect(() =>
      taxpayerSellerValues({
        ...values,
        fvwMain_txtCivilParticipationID: '001',
      }),
    ).toThrow();
    expect(() =>
      taxpayerSellerValues({
        ...values,
        fvwMain_lkpPartyType_ComboBox_Input: 'مشارکت مدنی',
      }),
    ).toThrow();
  });
  it('requires read/write permissions independently', async () => {
    const { service } = fixture();
    await expect(
      service.seller(bookId, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(
      service.saveSeller(
        bookId,
        { version: 0, key, values },
        { ...actor, permissions: ['finance.read', 'finance.journal.read'] },
      ),
    ).rejects.toThrow();
  });
  it('scopes every book to the actor branches and blocks inaccessible books', async () => {
    const { service, tx } = fixture();
    tx.accountingBook.findFirst.mockResolvedValueOnce(null as never);
    await expect(service.seller(bookId, actor)).rejects.toThrow();
    expect(tx.accountingBook.findFirst).toHaveBeenCalledWith({
      where: { id: bookId, branchId: { in: ['branch-a'] } },
    });
    expect(tx.accountingConfiguration.findFirst).not.toHaveBeenCalled();
  });
  it('creates one inactive seller profile and replays the same command only once', async () => {
    const { service, tx } = fixture();
    const saved = await service.saveSeller(
      bookId,
      { version: 0, key, values },
      actor,
    );
    expect(
      await service.saveSeller(bookId, { version: 0, key, values }, actor),
    ).toEqual(saved);
    expect(tx.accountingConfiguration.create).toHaveBeenCalledTimes(1);
    expect(
      tx.accountingConfiguration.create.mock.calls[0]?.[0].data.active,
    ).toBe(false);
    expect(saved.version).toBe(1);
  });
  it('rejects stale updates and changed payloads or actors reusing a key', async () => {
    const { service } = fixture();
    await service.saveSeller(bookId, { version: 0, key, values }, actor);
    await expect(
      service.saveSeller(
        bookId,
        { version: 0, key: '44444444-4444-4444-8444-444444444444', values },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.saveSeller(
        bookId,
        {
          version: 0,
          key,
          values: { ...values, fvwMain_txtEconomicID: 'different' },
        },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.saveSeller(
        bookId,
        { version: 0, key, values },
        { ...actor, userId: '55555555-5555-4555-8555-555555555555' },
      ),
    ).rejects.toThrow();
  });
});
