import { describe, it, expect } from 'vitest';
import {
  accountListProjection,
  mappingChildren,
  mappingKey,
} from './accounting-accounts-model';
import type { AccountingSnapshotV1 } from '@nora/contracts';
const fixture = {
  configurations: [
    {
      id: 'a',
      kind: 'detail-types',
      title: 'Parent',
      attributes: { isSystem: true },
    },
    {
      id: 'b',
      kind: 'detail-types',
      title: 'Child',
      attributes: { parentTypeId: 'a', enforceParent: true },
    },
  ],
  details: [
    {
      id: 'p',
      code: '01',
      title: 'Parent detail',
      typeId: 'a',
      parentId: null,
      active: true,
      attributes: {},
    },
    {
      id: 'd',
      code: '02',
      title: 'Child detail',
      typeId: 'b',
      parentId: 'p',
      active: false,
      attributes: { classificationNumber: '00' },
    },
  ],
  detailConversions: [
    {
      id: 'c',
      userTypeId: 'b',
      entity: 'شخص/شرکت',
      date: '2026-10-11',
      state: 'REGISTERED',
    },
  ],
} as unknown as AccountingSnapshotV1;
describe('observed accounts list and mapping paths', () => {
  it('resolves type parents and system flags without extra columns', () => {
    const result = accountListProjection(fixture, 'detail-types');
    expect(result.fields.map((f) => f.label)).toEqual([
      'عنوان',
      'پیش فرض',
      'نوع تفصیل پدر',
      'کنترل رابطه پدر فرزندی',
    ]);
    expect(result.records[1]?.values).toMatchObject({
      parent: 'Parent',
      enforceParent: 'true',
      isSystem: 'false',
    });
  });
  it('resolves detail parent and retains zero classification text', () => {
    expect(
      accountListProjection(fixture, 'details').records[1]?.values,
    ).toMatchObject({
      parent: 'Parent detail',
      type: 'Child',
      classification: '00',
      active: 'false',
    });
  });
  it('projects real conversion status and user type', () => {
    expect(
      accountListProjection(fixture, 'detail-type-converters').records[0]
        ?.values,
    ).toMatchObject({ title: 'Child', state: 'ثبت شده', entity: 'شخص/شرکت' });
  });
  it('retains parent navigation when only a deep mapping is saved', () => {
    const rows = [
      {
        sourceAccountId: 'a',
        sourceDetail4Id: 'd4',
        sourceDetail5Id: 'd5',
        sourceDetail6Id: 'd6',
      },
      { sourceAccountId: 'b', sourceDetail4Id: 'other' },
    ];
    expect(mappingChildren(rows, 'a', [])).toEqual([
      {
        sourceAccountId: 'a',
        sourceDetail4Id: 'd4',
        sourceDetail5Id: null,
        sourceDetail6Id: null,
      },
    ]);
    expect(mappingChildren(rows, 'a', ['d4']).map(mappingKey)).toEqual([
      'a:d4:d5:',
    ]);
    expect(mappingChildren(rows, 'a', ['wrong'])).toEqual([]);
  });
  it('deduplicates shared path ancestors and distinguishes levels', () => {
    const root = { sourceAccountId: 'a', sourceDetail4Id: '4' };
    expect(
      mappingChildren([root, { ...root, sourceDetail5Id: '5' }], 'a', []),
    ).toHaveLength(1);
    expect(mappingKey(root)).not.toBe(
      mappingKey({ ...root, sourceDetail5Id: '5' }),
    );
  });
});
