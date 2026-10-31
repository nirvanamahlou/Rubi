import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { denyPermission, type AuthenticatedActor } from '@nora/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BankAccountCrypto } from './bank-account.crypto';
import { BankAccountService } from './bank-account.service';
import {
  bankVersion,
  bankUuid,
  normalizeBankIdentifier,
} from './bank-account.validation';

export const bankTestCrypto = () =>
  new BankAccountCrypto(
    new ConfigService({
      MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 17).toString(
        'base64',
      ),
    }),
  );
describe('company bank identifiers', () => {
  it('normalizes Persian/Arabic digits and separators without losing leading zeros', () => {
    expect(normalizeBankIdentifier('accountNumber', ' ۰۰۰-١٢٣٤٥ ')).toBe(
      '00012345',
    );
    expect(normalizeBankIdentifier('cardNumber', '4111 1111-1111 1111')).toBe(
      '4111111111111111',
    );
    expect(normalizeBankIdentifier('iban', 'gb82 west 1234 5698 7654 32')).toBe(
      'GB82WEST12345698765432',
    );
    expect(normalizeBankIdentifier('iban', '')).toBeNull();
  });
  it.each([
    ['cardNumber', '4111111111111112'],
    ['cardNumber', '0000000000000000'],
    ['iban', 'GB83WEST12345698765432'],
    ['iban', 'IR82WEST12345698765432'],
    ['accountNumber', '000'],
    ['accountNumber', '12'],
    ['accountNumber', 12345],
    ['iban', 'x'.repeat(121)],
  ] as const)('rejects invalid %s', (kind, value) => {
    expect(() => normalizeBankIdentifier(kind, value)).toThrow();
  });
  it('rejects malformed identifiers and non-numeric/stale version bounds', () => {
    expect(() => bankUuid('bad')).toThrow();
    for (const value of [0, -1, 1.2, '1', 2147483647])
      expect(() => bankVersion(value)).toThrow();
  });
  it('uses fresh authenticated encryption bound to account context and separate keyed fingerprints', () => {
    const crypto = bankTestCrypto(),
      values = {
        accountNumber: '00012345',
        cardNumber: '4111111111111111',
        iban: null,
      };
    const first = crypto.seal(values, 'branch:bank:one'),
      second = crypto.seal(values, 'branch:bank:one');
    expect(first.nonce).not.toBe(second.nonce);
    expect(JSON.stringify(first)).not.toContain(values.cardNumber);
    expect(crypto.open(first, 'branch:bank:one')).toEqual(values);
    expect(() => crypto.open(first, 'branch:bank:two')).toThrow();
    expect(() =>
      crypto.open(
        { ...first, tag: Buffer.alloc(16).toString('base64') },
        'branch:bank:one',
      ),
    ).toThrow();
    expect(crypto.fingerprint('accountNumber', '00012345')).not.toBe(
      crypto.fingerprint('cardNumber', '00012345'),
    );
    expect(crypto.fingerprint('iban', null)).toBeNull();
    expect(
      () =>
        new BankAccountCrypto(
          new ConfigService({ MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: 'invalid' }),
        ),
    ).toThrow();
  });
});

describe('company bank account owner commands', () => {
  const branchId = randomUUID(),
    bankId = randomUUID();
  const actor: AuthenticatedActor = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: ['master_data.read', 'finance.read', 'finance.account.manage'],
  };
  let rows: Map<string, Record<string, unknown>>,
    tx: Record<string, unknown>,
    service: BankAccountService;
  let audit: ReturnType<typeof vi.fn>;
  const input = () => ({
    requestId: randomUUID(),
    branchId,
    title: 'Synthetic account',
    currencyCode: 'IRR',
    isActive: true,
    accountNumber: '00012345',
    cardNumber: '4111111111111111',
    iban: 'GB82WEST12345698765432',
  });
  beforeEach(() => {
    rows = new Map();
    audit = vi.fn().mockResolvedValue({});
    const accounts = {
      findMany: vi
        .fn()
        .mockImplementation(async () =>
          [...rows.values()].filter((row) => !row.deletedAt),
        ),
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }) => ({
        ...rows.get(where.id),
        _count: rows.get(where.id)?._count ?? {
          bankAccountAudits: 1,
          supplierPayments: 0,
        },
      })),
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }) => rows.get(where.id) ?? null),
      findFirst: vi.fn().mockImplementation(async ({ where }) => {
        const row = rows.get(where.id);
        return row &&
          !row.deletedAt &&
          row.bankId === where.bankId &&
          where.branchId.in.includes(row.branchId)
          ? row
          : null;
      }),
      create: vi.fn().mockImplementation(async ({ data }) => {
        const row = { version: 1, createdAt: new Date(), ...data };
        rows.set(data.id, row);
        return row;
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        const row = rows.get(where.id);
        if (!row || row.version !== where.version) return { count: 0 };
        rows.set(where.id, {
          ...row,
          ...data,
          version: Number(row.version) + 1,
        });
        return { count: 1 };
      }),
    };
    tx = {
      financeSettlementAccount: accounts,
      financeBankAccountAudit: { create: audit },
      $queryRaw: vi.fn(),
    };
    service = new BankAccountService(
      {
        client: {
          ...tx,
          $transaction: async (fn: (db: unknown) => unknown) => fn(tx),
        },
      } as never,
      {
        assertBank: vi.fn(),
        assertCurrency: vi.fn(),
        branches: async () => [{ id: branchId, name: 'Synthetic' }],
        currencies: async () => [{ code: 'IRR', name: 'Rial' }],
      } as never,
      bankTestCrypto(),
    );
  });
  it('creates multiple accounts with masked ordinary output and secret-free audit, and replays once', async () => {
    const first = input();
    const row = await service.save(bankId, null, first, actor);
    expect(row.accountNumber).toBe('••••2345');
    expect(JSON.stringify(row)).not.toContain(first.cardNumber);
    expect(JSON.stringify(audit.mock.calls)).not.toContain(first.iban);
    expect(rows.get(row.id)?.bankIdentifiers).toBeTruthy();
    expect(await service.save(bankId, null, first, actor)).toEqual(row);
    expect(audit).toHaveBeenCalledTimes(1);
    await service.save(
      bankId,
      null,
      {
        ...input(),
        title: 'Second',
        accountNumber: '9876543',
        cardNumber: null,
        iban: null,
      },
      actor,
    );
    expect((await service.list(bankId, '1', actor)).items).toHaveLength(2);
    await expect(
      service.save(bankId, null, { ...first, title: 'Changed' }, actor),
    ).rejects.toThrow();
  });
  it('removes only an unused scoped account, preserves audit and prevents later reveal', async () => {
    const row = await service.save(bankId, null, input(), actor);
    await service.remove(
      bankId,
      row.id,
      { expectedVersion: row.version },
      actor,
    );
    expect(rows.get(row.id)?.deletedAt).toBeInstanceOf(Date);
    expect((await service.list(bankId, '1', actor)).items).toEqual([]);
    await expect(service.details(bankId, row.id, actor)).rejects.toThrow();
    expect(audit.mock.calls.at(-1)?.[0].data.action).toBe('DELETE');
  });
  it('rejects referenced, stale, unauthorized and cross-branch deletions', async () => {
    const row = await service.save(bankId, null, input(), actor);
    await expect(
      service.remove(bankId, row.id, { expectedVersion: 2 }, actor),
    ).rejects.toThrow();
    await expect(
      service.remove(
        bankId,
        row.id,
        { expectedVersion: 1 },
        { ...actor, permissions: ['finance.read', 'master_data.read'] },
      ),
    ).rejects.toThrow();
    await expect(
      service.remove(
        bankId,
        row.id,
        { expectedVersion: 1 },
        { ...actor, branchIds: [] },
      ),
    ).rejects.toThrow();
    rows.set(row.id, {
      ...rows.get(row.id),
      _count: { bankAccountAudits: 2, salesDestinationPayments: 1 },
    });
    await expect(
      service.remove(bankId, row.id, { expectedVersion: 1 }, actor),
    ).rejects.toThrow('استفاده');
    expect(rows.get(row.id)?.deletedAt).toBeUndefined();
  });
  it('audits explicit details and preserves omitted identifiers but clears explicit null', async () => {
    const row = await service.save(bankId, null, input(), actor);
    expect((await service.details(bankId, row.id, actor)).cardNumber).toBe(
      '4111111111111111',
    );
    const edited = await service.save(
      bankId,
      row.id,
      {
        title: 'Edited',
        currencyCode: 'IRR',
        isActive: false,
        expectedVersion: 1,
        cardNumber: null,
      },
      actor,
    );
    expect(edited).toMatchObject({
      version: 2,
      isActive: false,
      cardNumber: null,
      accountNumber: '••••2345',
    });
    await expect(
      service.save(
        bankId,
        row.id,
        {
          title: 'Stale',
          currencyCode: 'IRR',
          isActive: true,
          expectedVersion: 1,
        },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.save(
        bankId,
        row.id,
        {
          title: 'Wrong currency',
          currencyCode: 'USD',
          isActive: false,
          expectedVersion: 2,
        },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('enforces native permissions, manual bank access and branch isolation before revealing or writing', async () => {
    const row = await service.save(bankId, null, input(), actor);
    for (const bad of [
      { ...actor, branchIds: [] },
      { ...actor, permissions: ['finance.read', 'master_data.read'] },
      { ...actor, permissions: ['finance.account.manage'] },
    ]) {
      await expect(
        service.details(bankId, row.id, bad as AuthenticatedActor),
      ).rejects.toThrow();
      await expect(
        service.save(bankId, null, input(), bad as AuthenticatedActor),
      ).rejects.toThrow();
    }
    await expect(
      service.details(randomUUID(), row.id, actor),
    ).rejects.toThrow();
    const deny = {
      ...actor,
      permissions: [
        ...actor.permissions,
        denyPermission('master-data.resource.banks'),
      ],
    } as AuthenticatedActor;
    await expect(service.list(bankId, '1', deny)).rejects.toThrow();
    await expect(service.details(bankId, row.id, deny)).rejects.toThrow();
    await expect(service.list(bankId, '1e100', actor)).rejects.toThrow();
    await expect(
      service.list(bankId, '1', { ...actor, permissions: [] }),
    ).rejects.toThrow();
  });
  it('rejects extra fields, all-empty identifiers and fails closed when audit cannot be written', async () => {
    await expect(
      service.save(
        bankId,
        null,
        { ...input(), accountNumber: '', cardNumber: '', iban: '' },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.save(
        bankId,
        null,
        { ...input(), createdByUserId: randomUUID() },
        actor,
      ),
    ).rejects.toThrow();
    const row = await service.save(bankId, null, input(), actor);
    audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.details(bankId, row.id, actor)).rejects.toThrow(
      'audit unavailable',
    );
  });
});
