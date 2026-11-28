import { describe, expect, it } from 'vitest';
import type { AccountingLineV1, AccountingSnapshotV1 } from '@nora/contracts';
import {
  copiedVoucherLines,
  defaultVoucherType,
  journalCurrencyBalances,
} from './accounting-voucher-display';
const row: AccountingLineV1 = {
  id: 'saved-row',
  accountId: 'ledger',
  detail4Id: null,
  detail5Id: null,
  detail6Id: null,
  detail9Id: 'detail',
  description: 'line',
  debit: '4.68',
  credit: '0',
  currency: 'USD',
  rate: '2',
  foreignAmount: '2.34',
  fxSnapshotId: 'approved',
  attributes: { trackingNumber: 'ref', taxStatus: 'previous' },
};
describe('voucher articles', () => {
  it('uses the active default voucher type configured for the current ledger', () => {
    const types = [
      { id: 'general', title: 'عمومی', active: true, attributes: {} },
      {
        id: 'inactive',
        title: 'OLD',
        active: false,
        attributes: { isDefault: true },
      },
      {
        id: 'chosen',
        title: 'custom',
        active: true,
        attributes: { isDefault: 'true' },
      },
    ].map((row) => ({ ...row, kind: 'voucher-types' }));
    const book = { configurations: types } as unknown as AccountingSnapshotV1;
    expect(defaultVoucherType(book)?.id).toBe('chosen');
    expect(defaultVoucherType(book, true)).toBeUndefined();
  });
  it('copies entered values and independent detail levels without copying persisted identities', () => {
    const [copy] = copiedVoucherLines([
      { ...row, journalId: 'source', position: 4 } as AccountingLineV1,
    ]);
    expect(copy).toMatchObject({
      detail9Id: 'detail',
      fxSnapshotId: 'approved',
      attributes: { trackingNumber: 'ref' },
    });
    for (const key of ['id', 'journalId', 'position'])
      expect(copy).not.toHaveProperty(key);
    expect(copy?.attributes).not.toHaveProperty('taxStatus');
    expect(row.attributes.taxStatus).toBe('previous');
  });
  it('totals foreign amounts exactly by currency and the booked side', () => {
    const balances = journalCurrencyBalances(
      [
        row,
        { ...row, debit: '0', credit: '0.02', foreignAmount: '0.01' },
        {
          ...row,
          currency: null,
          foreignAmount: null,
          debit: '0',
          credit: '9',
        },
      ],
      'IRR',
    );
    expect(balances).toMatchObject([
      { currency: 'USD', debit: '2.34', credit: '0.01', difference: '2.33' },
      { currency: 'IRR', credit: '9' },
    ]);
    expect(
      journalCurrencyBalances([{ ...row, foreignAmount: null }], 'IRR'),
    ).toBeNull();
    expect(
      journalCurrencyBalances([{ ...row, credit: '1' }], 'IRR'),
    ).toBeNull();
  });
});
