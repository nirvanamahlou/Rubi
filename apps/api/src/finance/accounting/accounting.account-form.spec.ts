import { describe, expect, it } from 'vitest';
import {
  accountControlFilters,
  validateAccountForm,
} from './accounting.account-form';

describe('observed account form rules', () => {
  it('accepts legacy attributes and rejects inconsistent type/control choices', () => {
    expect(() => validateAccountForm({}, true)).not.toThrow();
    expect(() =>
      validateAccountForm({ accountType: 'TEMPORARY' }, true),
    ).toThrow();
    expect(() =>
      validateAccountForm(
        { natureControlScope: 'ALL_DETAILS', natureControl: 'NONE' },
        true,
      ),
    ).toThrow();
    expect(() =>
      validateAccountForm(
        {
          accountType: 'MEMORANDUM',
          natureControlScope: 'ACCOUNT',
          natureControl: 'BLOCK',
        },
        true,
      ),
    ).not.toThrow();
  });
  it('requires the conditional tax type and validates structured descriptions', () => {
    expect(() =>
      validateAccountForm({ taxAccountKind: 'TAX' }, true),
    ).toThrow();
    expect(() =>
      validateAccountForm({ defaultDescriptions: '[{"text":1}]' }, true),
    ).toThrow();
    expect(() =>
      validateAccountForm(
        {
          taxAccountKind: 'TAX',
          taxType: 'مالیات تکلیفی',
          defaultDescriptions: '[{"text":"شرح","textEn":"Description"}]',
        },
        true,
      ),
    ).not.toThrow();
  });
  it('does not allow a controlled detail type outside the selected types', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(() =>
      validateAccountForm(
        { detail4TypeIds: [], detail4NatureTypeIds: [id] },
        true,
      ),
    ).toThrow();
    expect(() =>
      validateAccountForm(
        { detail4TypeIds: [id], detail4NatureTypeIds: [id] },
        true,
      ),
    ).not.toThrow();
  });

  it('validates independent custom levels and rejects levels above the per-account and global limits', () => {
    const type = '00000000-0000-4000-8000-000000000001';
    const attrs = {
      detailLevels: ['7', '12'],
      detail7Required: true,
      detail7TypeIds: [type],
      detailLevelLimit: '12',
    };
    expect(() => validateAccountForm(attrs, true)).not.toThrow();
    expect(() =>
      validateAccountForm({ ...attrs, detailLevelLimit: '8' }, true),
    ).toThrow();
    expect(() =>
      validateAccountForm({ ...attrs, detailLevelLimit: '13' }, true),
    ).toThrow();
    expect(() =>
      validateAccountForm({ ...attrs, detail13Required: true }, true),
    ).toThrow();
    expect(
      accountControlFilters(
        { natureControlScope: 'ALL_DETAILS' },
        { detail4Id: null, detail5Id: null, detail6Id: null, detail7Id: type },
        {},
      ),
    ).toEqual([{}, { detail7Id: type }]);
  });
  it('checks each detail prefix without changing the account-wide check', () => {
    const row = { detail4Id: 'a', detail5Id: 'b', detail6Id: null };
    expect(
      accountControlFilters({ natureControlScope: 'ALL_DETAILS' }, row, {}),
    ).toEqual([{}, { detail4Id: 'a' }, { detail4Id: 'a', detail5Id: 'b' }]);
    expect(
      accountControlFilters(
        {
          natureControlScope: 'SELECTED_DETAIL',
          detail5NatureTypeIds: ['selected'],
        },
        row,
        { a: 'other', b: 'selected' },
      ),
    ).toEqual([{}, { detail4Id: 'a', detail5Id: 'b' }]);
    expect(accountControlFilters({ natureControl: 'BLOCK' }, row, {})).toEqual([
      {},
    ]);
  });
});
