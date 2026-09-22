import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { documentsApi } from '@/modules/documents/api/client';
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
  it.each([
    ['09120000000', '', 'PHONE'],
    ['', 'qa@example.com', 'EMAIL'],
    ['', '', 'OTHER'],
  ])(
    'supplies the required contact channel for phone=%s email=%s',
    async (phone, email, preferredChannel) => {
      const existing = {
        id: 'identity',
        version: 1,
        attributes: { roleCodes: 'AGENCY' },
      } as unknown as MasterDataRecord;
      const contact = vi
        .spyOn(agencyClient, 'saveContact')
        .mockResolvedValue({ data: existing });
      await saveCooperation(
        { ...draft, fullName: 'نماینده آزمایشی', phone, email },
        ['master_data.read', 'master_data.create'],
        existing,
      );
      expect(contact).toHaveBeenCalledWith(
        'identity',
        expect.objectContaining({ preferredChannel, phone, email }),
      );
    },
  );
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
  it('accepts an empty change reason and uploads staged contract and guarantee files before saving a new agency agreement', async () => {
    const organization = {
      id: 'organization-new',
      resource: 'organizations',
      code: 'ORG_NEW',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 1, total: 0 },
    });
    vi.spyOn(masterDataApi, 'create').mockResolvedValue({ data: organization });
    vi.spyOn(documentsApi, 'options').mockResolvedValue({
      data: {
        currentUserId: 'owner',
        branches: [{ id: 'branch', code: 'B1', name: 'دفتر مرکزی' }],
        owners: [{ id: 'owner', displayName: 'کاربر آزمون' }],
        categories: [{ id: 'category', code: 'ORG', name: 'سازمان' }],
        documentTypes: [
          {
            id: 'type',
            code: 'AGREEMENT',
            name: 'قرارداد',
            domain: 'ORGANIZATION',
            defaultConfidentiality: 'CONFIDENTIAL',
            requiresExpiry: false,
            maxFileSizeBytes: 1_000_000,
            allowedMimeTypes: ['application/pdf'],
          },
        ],
        uploadPolicy: {
          maxFileSizeBytes: 1_000_000,
          allowedMimeTypes: ['application/pdf'],
          antivirusAvailable: true,
        },
      },
    });
    const upload = vi
      .spyOn(documentsApi, 'upload')
      .mockResolvedValueOnce({ data: { id: 'contract-document' } } as never)
      .mockResolvedValueOnce({ data: { id: 'guarantee-document' } } as never);
    const save = vi
      .spyOn(agencyClient, 'saveAgreementTerms')
      .mockResolvedValue({} as never);
    const staged = (title: string) => ({
      input: {
        title,
        branchId: 'branch',
        documentTypeId: 'type',
        categoryId: 'category',
        validUntil: '',
        requiresStepUpVerification: false,
      },
      file: new File(['%PDF-test'], `${title}.pdf`, {
        type: 'application/pdf',
      }),
    });
    const agreementTerms = {
      ...blankAgreementTerms(),
      title: 'قرارداد آژانس جدید',
      startsAt: '2026-09-12',
      currencyCodes: ['IRR'],
      paymentMethodId: '11111111-1111-4111-8111-111111111111',
      changeReason: '',
      guarantees: [
        {
          kind: 'BANK_GUARANTEE' as const,
          reference: 'BG-001',
          amount: '1000000',
          currencyCode: 'IRR',
          issuer: 'بانک آزمون',
          receivedAt: '2026-09-12',
          expiresAt: null,
          status: 'RECEIVED' as const,
          documentId: null,
        },
      ],
    };
    const inputDraft = {
      ...draft,
      withAgreement: true,
      branchId: 'branch',
      agreementTerms,
      pendingAgreementDocument: staged('سند قرارداد'),
      pendingGuaranteeDocuments: [staged('سند تضمین')],
    };
    expect(cooperationIssue(inputDraft, 3)).toBeUndefined();
    await saveCooperation(inputDraft, [
      'master_data.read',
      'master_data.create',
      'b2b.agreement.read',
      'b2b.agreement.manage',
      'b2b.credit.read',
      'b2b.credit.manage',
      'documents.upload',
      'documents.list',
      'documents.organization.read',
    ]);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(
      'organization-new',
      expect.objectContaining({
        terms: expect.objectContaining({
          changeReason: '',
          documentId: 'contract-document',
          guarantees: [
            expect.objectContaining({ documentId: 'guarantee-document' }),
          ],
        }),
      }),
    );
    expect(upload.mock.invocationCallOrder[1]).toBeLessThan(
      save.mock.invocationCallOrder[0]!,
    );
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
