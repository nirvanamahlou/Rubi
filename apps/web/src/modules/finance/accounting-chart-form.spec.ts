import { describe, expect, it } from 'vitest';
import type { AccountingAccountV1 } from '@nora/contracts';
import {
  accountToDraft,
  chartPayload,
  descriptionRows,
} from './accounting-chart-form';

const account: AccountingAccountV1 = {
  id: 'account',
  bookId: 'book',
  code: '111001',
  title: 'Example',
  titleEn: 'English',
  parentId: 'parent',
  level: 'SUBSIDIARY',
  nature: 'DEBIT',
  permanent: true,
  active: true,
  version: 3,
  attributes: {
    description: 'Preserve me',
    natureControl: 'WARN',
    detail4TypeId: 'type-a',
    counterpartId: 'counterpart',
    multiCurrency: true,
    revaluable: true,
    defaultDescriptions: '[{"text":"A","textEn":"B"}]',
  },
};
describe('chart editor persistence', () => {
  it('keeps existing description, warning policy, references and hidden-tab data on save', () => {
    const payload = chartPayload(accountToDraft(account), account.id);
    expect(payload.description).toBe('Preserve me');
    expect(payload.attributes).toMatchObject(account.attributes);
    expect(payload.attributes.natureControlScope).toBe('ACCOUNT');
    expect(payload.parentId).toBe('parent');
    expect(descriptionRows(payload.attributes)).toEqual([
      { text: 'A', textEn: 'B' },
    ]);
  });
  it('preserves an actual temporary account instead of resetting its type', () => {
    const draft = accountToDraft({ ...account, permanent: false });
    expect(draft.attributes.accountType).toBe('TEMPORARY');
    expect(chartPayload(draft).permanent).toBe(false);
  });
  it('migrates an edited type selection without a stale single-type constraint', () => {
    const draft = accountToDraft(account);
    draft.attributes.detail4TypeIds = ['type-b'];
    draft.attributes.detail4NatureTypeIds = ['type-a', 'type-b'];
    const payload = chartPayload(draft);
    expect(payload.attributes.detail4TypeId).toBeUndefined();
    expect(payload.attributes.detail4NatureTypeIds).toEqual(['type-b']);
    expect(account.attributes.detail4TypeId).toBe('type-a');
  });
  it('clears revaluation when currency is disabled and supports neutral nature', () => {
    const draft = accountToDraft(account);
    draft.nature = 'ANY';
    draft.attributes.multiCurrency = false;
    expect(chartPayload(draft)).toMatchObject({
      nature: 'ANY',
      attributes: { revaluable: false },
    });
  });
});
