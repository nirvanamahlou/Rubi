import { describe, expect, it, vi } from 'vitest';
import { taxValues } from './accounting-tax.validation';
import { AccountingTaxService } from './accounting-tax.service';
import type { DatabaseService } from '../../database/database.service';
import type { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import type { AuthenticatedActor } from '@nora/contracts';

const threshold = {
  txtTitle: 'حدنصاب آزمون',
  decSmallDealsQuorum_input: '9007199254740993',
  dpEffectiveDate_MaskedTextBox: '2026-10-11',
  decSmallDealsMergeRate_input: '5',
};
describe('tax reference validation', () => {
  it('calculates without losing units above safe integer precision', () => {
    expect(
      taxValues('thresholds', threshold).decSmallDealsMergeAmount_input,
    ).toBe('450359962737049.65');
  });
  it('ignores a client override of the calculated threshold', () => {
    expect(
      taxValues('thresholds', {
        ...threshold,
        decSmallDealsMergeAmount_input: '1',
      }).decSmallDealsMergeAmount_input,
    ).toBe('450359962737049.65');
  });
  it('rejects unknown fields, unsupported declarations, and invalid percentages', () => {
    expect(() =>
      taxValues('thresholds', { ...threshold, invented: 'x' }),
    ).toThrow();
    expect(() => taxValues('general', {})).toThrow();
    expect(() =>
      taxValues('thresholds', {
        ...threshold,
        decSmallDealsMergeRate_input: '101',
      }),
    ).toThrow();
  });
  it('rejects impossible date and inverted periods', () => {
    expect(() =>
      taxValues('thresholds', {
        ...threshold,
        dpEffectiveDate_MaskedTextBox: '2026-02-30',
      }),
    ).toThrow();
    expect(() =>
      taxValues('periods', {
        txtTitle: 'آزمون',
        dpkStartDate_MaskedTextBox: '2026-10-12',
        dpkEndDate_MaskedTextBox: '2026-10-11',
      }),
    ).toThrow();
  });
  it('requires an aggregation reference only for aggregated periods', () => {
    const input = {
      txtTitle: 'آزمون',
      dpkStartDate_MaskedTextBox: '2026-10-01',
      dpkEndDate_MaskedTextBox: '2026-12-31',
    };
    expect(taxValues('periods', input).sltMergePattern_Input).toBe('');
    expect(() =>
      taxValues('periods', {
        ...input,
        lkpGatheringType_ComboBox_Input: 'تجمیعی',
      }),
    ).toThrow();
  });
  it('rejects enabled children whose source parent is unchecked', () => {
    expect(() =>
      taxValues('aggregation', {
        txtTitle: 'آزمون',
        Buy_TaxPrayer_RealTaxPayerMergePattern_setting_ByCounterPartMerge: true,
      }),
    ).toThrow();
  });
});

const bookId = '11111111-1111-4111-8111-111111111111';
const actor = {
  userId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['own-branch'],
  permissions: [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
  ],
} as AuthenticatedActor;
describe('tax reference access boundaries', () => {
  it('refuses deleting a pattern referenced by a tax period', async () => {
    const tx = {
      accountingBook: {
        findFirst: vi.fn().mockResolvedValue({ branchId: 'own-branch' }),
      },
      accountingCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingConfiguration: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: bookId, version: 1 })
          .mockResolvedValueOnce({ id: 'dependent-period' }),
        deleteMany: vi.fn(),
      },
    };
    const service = new AccountingTaxService(
      {
        client: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
      } as unknown as DatabaseService,
      {} as IamFinanceDirectory,
    );
    await expect(
      service.remove(
        bookId,
        'aggregation',
        bookId,
        { version: 1, key: actor.userId },
        actor,
      ),
    ).rejects.toThrow('استفاده شده است');
    expect(tx.accountingConfiguration.deleteMany).not.toHaveBeenCalled();
  });
  it('replays a successful request without creating a second record', async () => {
    const createHash = await import('node:crypto').then(
      (module) => module.createHash,
    );
    const values = taxValues('thresholds', threshold);
    const canonical = (input: unknown): unknown =>
      input && typeof input === 'object'
        ? Object.fromEntries(
            Object.entries(input)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)]),
          )
        : input;
    const hash = createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            kind: 'thresholds',
            id: null,
            version: undefined,
            values,
            notes: undefined,
          }),
        ),
      )
      .digest('hex');
    const result = { id: bookId, kind: 'thresholds', values, version: 1 };
    const tx = {
      accountingBook: {
        findFirst: vi.fn().mockResolvedValue({ branchId: 'own-branch' }),
      },
      accountingCommand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ hash, actorId: actor.userId, result }),
      },
      accountingConfiguration: { create: vi.fn() },
    };
    const service = new AccountingTaxService(
      {
        client: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
      } as unknown as DatabaseService,
      {} as IamFinanceDirectory,
    );
    await expect(
      service.save(
        bookId,
        'thresholds',
        { key: actor.userId, values: threshold },
        actor,
      ),
    ).resolves.toEqual(result);
    expect(tx.accountingConfiguration.create).not.toHaveBeenCalled();
  });
  it('never lists rows when the book is outside the actor branch scope', async () => {
    const findFirst = vi.fn().mockResolvedValue(null),
      findMany = vi.fn();
    const service = new AccountingTaxService(
      {
        client: {
          accountingBook: { findFirst },
          accountingConfiguration: { findMany },
        },
      } as unknown as DatabaseService,
      {} as IamFinanceDirectory,
    );
    await expect(service.list(bookId, 'thresholds', actor)).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: bookId, branchId: { in: ['own-branch'] } },
    });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects reads without finance permission before database access', async () => {
    const service = new AccountingTaxService(
      { client: {} } as DatabaseService,
      {} as IamFinanceDirectory,
    );
    await expect(
      service.list(bookId, 'thresholds', { ...actor, permissions: [] }),
    ).rejects.toThrow();
  });
  it('rejects stale update versions without changing a record', async () => {
    const tx = {
      accountingBook: {
        findFirst: vi.fn().mockResolvedValue({ branchId: 'own-branch' }),
      },
      accountingCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingConfiguration: {
        findFirst: vi.fn().mockResolvedValue({ version: 2 }),
        updateMany: vi.fn(),
      },
    };
    const service = new AccountingTaxService(
      {
        client: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
      } as unknown as DatabaseService,
      {} as IamFinanceDirectory,
    );
    await expect(
      service.save(
        bookId,
        'thresholds',
        { id: bookId, version: 1, key: actor.userId, values: threshold },
        actor,
      ),
    ).rejects.toThrow('رکورد تغییر کرده');
    expect(tx.accountingConfiguration.updateMany).not.toHaveBeenCalled();
  });
});
