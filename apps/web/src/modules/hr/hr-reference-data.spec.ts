import { describe, expect, it } from 'vitest';
import type { HrBootstrapDto, HrRecordDto } from '@nora/contracts';
import { mergeHrReferenceRecords } from './hr-reference-data';
import { hrReferenceOptions } from './hr-form-model';

const record = (
  id: string,
  tab: string,
  value: string,
  branchId = 'branch-1',
): HrRecordDto =>
  ({
    id,
    branchId,
    section: 'organization',
    tab,
    columns: tab === 'positions' ? ['عنوان سمت', 'عنوان شغل'] : ['نام واحد'],
    values: [value, ...(tab === 'positions' ? [`شغل ${value}`] : [])],
    status: 'فعال',
    data: {},
    deletedAt: null,
  }) as HrRecordDto;

describe('HR inline references', () => {
  it('keeps a just-created reference and other paged records when bootstrap is truncated', () => {
    const loaded = [record('old-unit', 'units', 'واحد پیشین')];
    const remembered = [record('new-unit', 'units', 'واحد تازه')];
    const merged = mergeHrReferenceRecords(loaded, remembered);
    const data = {
      records: merged,
      employees: [],
      branches: [{ id: 'branch-1', name: 'شعبه اصلی' }],
    } as unknown as HrBootstrapDto;

    expect(merged.map((item) => item.id)).toEqual(['old-unit', 'new-unit']);
    expect(
      hrReferenceOptions(data, 'lifecycle', 'onboarding', 'branch-1')['واحد'],
    ).toEqual(['واحد پیشین', 'واحد تازه']);
  });

  it('uses the latest saved value without exposing another branch in dropdowns', () => {
    const merged = mergeHrReferenceRecords(
      [
        record('position', 'positions', 'سمت قدیمی'),
        record('other', 'positions', 'سمت شعبه دیگر', 'branch-2'),
      ],
      [record('position', 'positions', 'سمت تازه')],
    );
    const data = {
      records: merged,
      employees: [],
      branches: [{ id: 'branch-1', name: 'شعبه اصلی' }],
    } as unknown as HrBootstrapDto;

    expect(
      hrReferenceOptions(data, 'employee', 'create', 'branch-1')['سمت'],
    ).toEqual(['سمت تازه']);
  });
});
