import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import {
  blankCooperationDraft,
  cooperationIssue,
  CooperationSaveError,
  saveCooperation,
} from './cooperation-draft';
afterEach(() => vi.restoreAllMocks());
const draft = {
  ...blankCooperationDraft,
  legalName: 'سازمان آزمون',
  code: 'B2B-TEST-01',
};
describe('cooperation wizard writes', () => {
  it('denies missing permissions before touching the owner API', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    await expect(saveCooperation(draft, [])).rejects.toThrow('مجوز');
    expect(create).not.toHaveBeenCalled();
  });
  it('adds a cooperation role without replacing supplier roles or losing the version', async () => {
    const existing = {
      id: 'identity',
      version: 7,
      attributes: { roleCodes: 'SUPPLIER' },
    } as unknown as MasterDataRecord;
    const update = vi
      .spyOn(masterDataApi, 'update')
      .mockResolvedValue({ data: existing });
    await saveCooperation(
      draft,
      ['master_data.read', 'master_data.update'],
      existing,
    );
    expect(update).toHaveBeenCalledWith('organizations', 'identity', {
      version: 7,
      values: { roleCodes: 'SUPPLIER,AGENCY' },
    });
  });
  it('reports the persisted organization after a later contact failure', async () => {
    const existing = {
      id: 'identity',
      version: 2,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const contact = vi
      .spyOn(agencyClient, 'saveContact')
      .mockRejectedValue(new Error('contact failed'));
    let failure: unknown;
    try {
      await saveCooperation(
        { ...draft, fullName: 'نماینده آزمون' },
        ['master_data.read', 'master_data.create'],
        existing,
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CooperationSaveError);
    expect((failure as CooperationSaveError).organization?.id).toBe('identity');
    expect(contact).toHaveBeenCalledTimes(1);
  });
  it('does not accept impossible dates or a partial address', () => {
    expect(
      cooperationIssue(
        {
          ...draft,
          withAgreement: true,
          branchId: 'branch',
          agreementTitle: 'قرارداد آزمون',
          startsAt: '2026-02-30',
        },
        3,
      ),
    ).toBeTruthy();
    expect(
      cooperationIssue({ ...draft, countryId: 'country' }, 2),
    ).toBeTruthy();
  });
});
