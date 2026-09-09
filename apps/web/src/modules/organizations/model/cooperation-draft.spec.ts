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
import { blankAgreementTerms, editableAgreementTerms } from './agreement-terms';
afterEach(() => vi.restoreAllMocks());
const draft = {
  ...blankCooperationDraft,
  legalName: 'سازمان آزمون',
  code: 'B2B-TEST-01',
};
describe('cooperation wizard writes', () => {
  it('accepts an optional company ID and rejects a personal or malformed identifier', () => {
    expect(
      cooperationIssue({ ...draft, nationalId: '۱۲۳۴۵۶۷۸۹۰۱' }, 1),
    ).toBeUndefined();
    expect(
      cooperationIssue({ ...draft, nationalId: '1234567890' }, 1),
    ).toContain('۱۱ رقم');
    expect(
      cooperationIssue(
        { ...draft, personType: 'NATURAL', nationalId: '12345678901' },
        1,
      ),
    ).toContain('حقوقی');
  });
  it('saves corporate contract terms and independent currency limits without requiring agency/rate permissions', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'CORPORATE_CUSTOMER' },
    } as unknown as MasterDataRecord;
    const terms = {
      ...blankAgreementTerms(),
      title: 'قرارداد سازمانی',
      currencyCodes: ['IRR', 'USD'],
      paymentMethod: 'CREDIT' as const,
      paymentMethodId: '11111111-1111-4111-8111-111111111111',
      creditPolicies: [
        {
          currencyCode: 'IRR',
          creditLimit: '9007199254740993.25',
          limitType: 'HARD' as const,
          dueDays: 10,
          overdueAction: 'BLOCK' as const,
          effectiveFrom: '2026-09-01',
          expiresAt: null,
        },
      ],
      startsAt: '2026-09-01',
    };
    const save = vi
      .spyOn(agencyClient, 'saveAgreementTerms')
      .mockResolvedValue({} as never);
    const profile = vi.spyOn(agencyClient, 'upsertProfile');
    await saveCooperation(
      {
        ...draft,
        role: 'CORPORATE_CUSTOMER',
        withAgreement: true,
        branchId: 'branch',
        agreementTerms: terms,
        agreementRequestId: 'same-request',
      },
      [
        'master_data.read',
        'b2b.agreement.read',
        'b2b.agreement.manage',
        'b2b.credit.read',
        'b2b.credit.manage',
      ],
      existing,
    );
    expect(save).toHaveBeenCalledWith('identity', {
      branchId: 'branch',
      role: 'CORPORATE_CUSTOMER',
      requestId: 'same-request',
      terms,
    });
    expect(profile).not.toHaveBeenCalled();
  });
  it('removes review metadata from editable terms and preserves pinned document versions', () => {
    const terms = {
      ...blankAgreementTerms(),
      documentVersionId: 'version',
      id: 'review-id',
      status: 'APPROVED',
      createdByUserId: 'actor',
    };
    const editable = editableAgreementTerms(terms);
    expect(editable).not.toHaveProperty('status');
    expect(editable).not.toHaveProperty('createdByUserId');
    expect(editable.documentVersionId).toBe('version');
  });
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
        { ...draft, withAgreement: true, branchId: 'branch' },
        3,
      ),
    ).toContain('روش پرداخت');
    expect(
      cooperationIssue(
        {
          ...draft,
          withAgreement: true,
          branchId: 'branch',
          agreementTerms: {
            ...blankAgreementTerms(),
            title: 'قرارداد آزمون',
            currencyCodes: ['IRR'],
            startsAt: '2026-02-30',
            paymentMethodId: '11111111-1111-4111-8111-111111111111',
          },
        },
        3,
      ),
    ).toBeTruthy();
    expect(
      cooperationIssue({ ...draft, countryId: 'country' }, 2),
    ).toBeTruthy();
  });
});
