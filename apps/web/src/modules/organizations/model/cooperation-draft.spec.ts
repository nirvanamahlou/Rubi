import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { MasterDataApiError } from '@/modules/master-data/api/client';
import { documentsApi } from '@/modules/documents/api/client';
import { agencyClient } from '../api/agency-client';
import {
  blankCooperationDraft,
  cooperationIssue,
  CooperationSaveError,
  normalizeOtpCode,
  saveCooperation,
  registrationCooperationDraft,
  cooperationContacts,
  cooperationContactPhones,
} from './cooperation-draft';
import { blankAgreementTerms, editableAgreementTerms } from './agreement-terms';
afterEach(() => vi.restoreAllMocks());
const draft = {
  ...blankCooperationDraft,
  registrationId: '22222222-2222-4222-8222-222222222222',
  legalName: 'سازمان آزمون',
  code: 'B2B-TEST-01',
};
describe('cooperation wizard writes', () => {
  it('rejects canonically duplicate mobile/office contacts before any organization write', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    await expect(
      saveCooperation(
        {
          ...draft,
          fullName: 'مدیر نمونه',
          phone: '09121234567',
          officePhone: '+98 912 1234567',
        },
        ['master_data.read', 'master_data.create'],
      ),
    ).rejects.toThrow('متفاوت');
    expect(create).not.toHaveBeenCalled();
  });
  it('checks the native minimum contact requirement before creating an agency', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    await expect(
      saveCooperation({ ...draft, fullName: 'مدیر نمونه' }, [
        'master_data.read',
        'master_data.create',
      ]),
    ).rejects.toThrow('حداقل تلفن یا ایمیل');
    expect(create).not.toHaveBeenCalled();
  });
  it('hydrates a legacy Excel landline into the landline input without treating it as a mobile', () => {
    expect(cooperationContactPhones('02112345678', true, false)).toEqual({
      phone: '',
      officePhone: '02112345678',
    });
    expect(cooperationContactPhones('09121234567', true, true)).toEqual({
      phone: '09121234567',
    });
    expect(cooperationContactPhones('02112345678', false, false)).toEqual({
      phone: '02112345678',
    });
  });
  it('stores a standalone office phone without inventing a representative', async () => {
    const organization = {
      id: 'agency',
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const save = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: organization });
    await saveCooperation(
      { ...draft, officePhone: '(021) 1234-5678' },
      ['master_data.read', 'master_data.create'],
      organization,
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      'agency',
      expect.objectContaining({ fullName: 'دفتر آژانس', phone: '02112345678' }),
      undefined,
    );
  });
  it('persists agency mobile, office phone, email, license and address through native dossier writers without OTP', async () => {
    const organization = {
      id: 'agency',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as never);
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValue({ data: organization });
    const contacts = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: organization });
    const verified = vi.spyOn(agencyClient, 'saveVerifiedContact');
    const address = vi
      .spyOn(masterDataApi, 'createOrganizationAddress')
      .mockResolvedValue({ data: {} } as never);
    const saved = await saveCooperation(
      {
        ...draft,
        fullName: 'مدیر نمونه',
        phone: '09121234567',
        officePhone: '۰۲۱ ۱۲۳۴-۵۶۷۸',
        email: 'office@example.com',
        tourismLicenseNumber: 'LIC-EXAMPLE',
        countryId: 'country',
        cityId: 'city',
        addressLine: 'نشانی آزمایشی',
      },
      ['master_data.read', 'master_data.create', 'master_data.update'],
    );
    expect(saved).toBe(organization);
    expect(create).toHaveBeenCalledWith(
      'organizations',
      expect.objectContaining({
        values: expect.objectContaining({
          tourismLicenseNumber: 'LIC-EXAMPLE',
        }),
      }),
    );
    expect(contacts).toHaveBeenNthCalledWith(
      1,
      'agency',
      expect.objectContaining({
        fullName: 'مدیر نمونه',
        phone: '09121234567',
        email: 'office@example.com',
        isPrimary: 'true',
      }),
    );
    expect(contacts).toHaveBeenNthCalledWith(
      2,
      'agency',
      expect.objectContaining({
        fullName: 'دفتر آژانس',
        jobTitle: 'تلفن ثابت',
        phone: '02112345678',
        isPrimary: 'false',
      }),
      undefined,
    );
    expect(address).toHaveBeenCalledWith(
      'agency',
      expect.objectContaining({
        countryId: 'country',
        cityId: 'city',
        addressLine: 'نشانی آزمایشی',
      }),
    );
    expect(verified).not.toHaveBeenCalled();
  });
  it('selects the primary representative independently of alphabetical contact order', () => {
    const office = {
      id: 'office',
      attributes: { jobTitle: 'تلفن ثابت', isPrimary: 'false' },
    } as unknown as MasterDataRecord;
    const other = {
      id: 'other',
      attributes: {},
    } as unknown as MasterDataRecord;
    const primary = {
      id: 'primary',
      attributes: { isPrimary: 'true' },
    } as unknown as MasterDataRecord;
    expect(cooperationContacts([office, other, primary])).toEqual({
      contact: primary,
      officeContact: office,
    });
  });
  it('edits an Excel office contact in place while preserving undisclosed executive fields and job title', async () => {
    const organization = {
      id: 'agency',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const contact = {
      id: 'executive',
      attributes: { organizationId: 'agency' },
    } as unknown as MasterDataRecord;
    const officeContact = {
      id: 'office',
      attributes: { organizationId: 'agency', jobTitle: 'تلفن ثابت' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({ data: organization });
    const save = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: contact });
    await saveCooperation(
      { ...draft, fullName: 'مدیر نمونه', officePhone: '02112345678' },
      ['master_data.read', 'master_data.update'],
      organization,
      {
        contact,
        officeContact,
        preserveSensitiveContactFields: true,
        officePhoneEdited: true,
      },
    );
    expect(save).toHaveBeenNthCalledWith(
      1,
      'agency',
      { fullName: 'مدیر نمونه' },
      contact,
    );
    expect(save).toHaveBeenNthCalledWith(
      2,
      'agency',
      expect.objectContaining({ phone: '02112345678' }),
      officeContact,
    );
  });
  it('does not clear an office phone when disclosure was denied', async () => {
    const organization = {
      id: 'agency',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const contact = {
      id: 'executive',
      attributes: { organizationId: 'agency' },
    } as unknown as MasterDataRecord;
    const officeContact = {
      id: 'office',
      attributes: { jobTitle: 'تلفن ثابت' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({ data: organization });
    const save = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: contact });
    await saveCooperation(
      { ...draft, fullName: 'مدیر نمونه' },
      ['master_data.read', 'master_data.update'],
      organization,
      { contact, officeContact, preserveSensitiveContactFields: true },
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      'agency',
      { fullName: 'مدیر نمونه' },
      contact,
    );
  });
  it('rejects malformed office phones before writing the organization', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    await expect(
      saveCooperation(
        { ...draft, fullName: 'مدیر نمونه', officePhone: 'invalid' },
        ['master_data.read', 'master_data.create'],
      ),
    ).rejects.toThrow('تلفن ثابت');
    expect(create).not.toHaveBeenCalled();
  });
  it('projects initial registration without deferred identity or contract mutations but retains dossier edit values', () => {
    const full = {
      ...draft,
      nationalId: '12345678901',
      registrationNumber: 'REG',
      economicCode: 'ECON',
      chiefExecutiveNationalId: '1234567890',
      jobTitle: 'Director',
      withAgreement: true,
    };
    const registration = registrationCooperationDraft(full);
    expect(registration).toMatchObject({
      nationalId: '',
      registrationNumber: '',
      economicCode: '',
      chiefExecutiveNationalId: '',
      jobTitle: '',
      withAgreement: false,
      pendingAgreementDocument: null,
      pendingGuaranteeDocuments: [],
    });
    expect(registrationCooperationDraft(full, true)).toMatchObject({
      nationalId: full.nationalId,
      registrationNumber: 'REG',
      economicCode: 'ECON',
      chiefExecutiveNationalId: full.chiefExecutiveNationalId,
      jobTitle: 'Director',
      withAgreement: false,
    });
    expect(full.withAgreement).toBe(true);
    expect(full.nationalId).toBe('12345678901');
    const corporate = { ...full, role: 'CORPORATE_CUSTOMER' as const };
    expect(registrationCooperationDraft(corporate)).toBe(corporate);
  });
  it('saves a new agency without an unverified phone and returns its dossier', async () => {
    const organization = {
      id: 'new-agency',
      name: draft.legalName,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as never);
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValue({ data: organization });

    const agreement = vi
      .spyOn(agencyClient, 'saveAgreementTerms')
      .mockResolvedValue({} as never);
    const saved = await saveCooperation(
      registrationCooperationDraft({
        ...draft,
        fullName: '',
        phone: '',
        nationalId: 'deferred',
        registrationNumber: 'deferred',
        economicCode: 'deferred',
        chiefExecutiveNationalId: 'deferred',
        jobTitle: 'deferred',
        withAgreement: true,
      }),
      ['master_data.read', 'master_data.create'],
    );

    expect(saved).toBe(organization);
    expect(agreement).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith('organizations', {
      values: {
        legalName: draft.legalName,
        personType: 'LEGAL',
        nationalId: null,
        registrationNumber: null,
        economicCode: null,
        tourismLicenseNumber: null,
        roleCodes: 'AGENCY',
      },
    });
  });
  it('does not clear deferred fields when registration attaches to an existing agency', async () => {
    const existing = {
      id: 'existing',
      name: draft.legalName,
      version: 3,
      attributes: {
        roleCodes: 'AGENCY',
        nationalId: '12345678901',
        registrationNumber: 'REG',
        economicCode: 'ECON',
      },
    } as unknown as MasterDataRecord;
    const update = vi
      .spyOn(masterDataApi, 'update')
      .mockResolvedValue({ data: existing });
    expect(
      await saveCooperation(
        registrationCooperationDraft(draft),
        ['master_data.read'],
        existing,
      ),
    ).toBe(existing);
    expect(update).not.toHaveBeenCalled();
    expect(existing.attributes.registrationNumber).toBe('REG');
  });
  it.each([['qa@example.com', 'EMAIL']])(
    'keeps the no-phone contact flow for email=%s',
    async (email, preferredChannel) => {
      const existing = {
        id: 'identity',
        version: 1,
        attributes: { roleCodes: 'AGENCY' },
      } as unknown as MasterDataRecord;
      const contact = vi
        .spyOn(agencyClient, 'saveContact')
        .mockResolvedValue({ data: existing });
      await saveCooperation(
        { ...draft, fullName: 'نماینده آزمایشی', email },
        ['master_data.read', 'master_data.create'],
        existing,
      );
      expect(contact).toHaveBeenCalledWith(
        'identity',
        expect.objectContaining({ preferredChannel, phone: '', email }),
      );
    },
  );

  it('keeps corporate phones on the verified-contact command', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'CORPORATE_CUSTOMER' },
    } as unknown as MasterDataRecord;
    const generic = vi.spyOn(agencyClient, 'saveContact');
    const verified = vi
      .spyOn(agencyClient, 'saveVerifiedContact')
      .mockResolvedValue({ data: existing });
    await saveCooperation(
      {
        ...draft,
        branchId: '11111111-1111-4111-8111-111111111111',
        fullName: 'نماینده آزمایشی',
        phone: '۰۹۱۲ ۱۲۳ ۴۵۶۷',
        phoneVerificationGrant: 'grant',
        role: 'CORPORATE_CUSTOMER',
        phoneVerificationExpiresAt: '2999-01-01T00:00:00.000Z',
      },
      ['master_data.read', 'master_data.create'],
      existing,
    );
    expect(generic).not.toHaveBeenCalled();
    expect(verified).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'identity',
        phone: '۰۹۱۲ ۱۲۳ ۴۵۶۷',
        grant: 'grant',
        registrationId: draft.registrationId,
      }),
    );
    expect(verified.mock.calls[0]?.[0]).not.toHaveProperty('email');
  });

  it('blocks corporate phones before organization persistence until they have a grant', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    await expect(
      saveCooperation(
        {
          ...draft,
          branchId: '11111111-1111-4111-8111-111111111111',
          fullName: 'نماینده آزمایشی',
          phone: '09121234567',
          role: 'CORPORATE_CUSTOMER',
        },
        ['master_data.read', 'master_data.create'],
      ),
    ).rejects.toThrow('تأیید');
    expect(create).not.toHaveBeenCalled();
  });

  it('expires a local grant before organization persistence and accepts localized OTP digits', async () => {
    const create = vi.spyOn(masterDataApi, 'create');
    expect(normalizeOtpCode('۱۲٣-۴۵۶')).toBe('123456');
    await expect(
      saveCooperation(
        {
          ...draft,
          branchId: '11111111-1111-4111-8111-111111111111',
          fullName: 'نماینده آزمایشی',
          phone: '09121234567',
          phoneVerificationGrant: 'expired-grant',
          role: 'CORPORATE_CUSTOMER',
          phoneVerificationExpiresAt: '2000-01-01T00:00:00.000Z',
        },
        ['master_data.read', 'master_data.create'],
      ),
    ).rejects.toThrow('مهلت');
    await expect(
      saveCooperation(
        {
          ...draft,
          branchId: '11111111-1111-4111-8111-111111111111',
          fullName: 'نماینده آزمایشی',
          phone: '09121234567',
          phoneVerificationGrant: 'malformed-expiry-grant',
          role: 'CORPORATE_CUSTOMER',
          phoneVerificationExpiresAt: 'not-a-date',
        },
        ['master_data.read', 'master_data.create'],
      ),
    ).rejects.toThrow('مهلت');
    expect(create).not.toHaveBeenCalled();
  });
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
  it('uploads staged confidential contract and guarantee files, then supplies their fresh grants when saving a new agency agreement', async () => {
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
    const grant = vi
      .spyOn(documentsApi, 'createAccessGrant')
      .mockResolvedValueOnce({ data: { token: 'contract-grant' } } as never)
      .mockResolvedValueOnce({ data: { token: 'guarantee-grant' } } as never);
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
        confidentialAccessCode: '573921',
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
    expect(cooperationIssue(inputDraft, 4)).toBeUndefined();
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
      'documents.metadata.read',
      'documents.file.read',
    ]);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(grant).toHaveBeenNthCalledWith(1, 'contract-document', {
      code: '573921',
      purpose: 'CONFIDENTIAL_VIEW',
    });
    expect(grant).toHaveBeenNthCalledWith(2, 'guarantee-document', {
      code: '573921',
      purpose: 'CONFIDENTIAL_VIEW',
    });
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
        referenceGrants: [
          { documentId: 'contract-document', token: 'contract-grant' },
          { documentId: 'guarantee-document', token: 'guarantee-grant' },
        ],
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
  it('updates the selected dossier, representative and primary address without creating duplicates', async () => {
    const existing = {
      id: 'identity',
      version: 7,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const saved = { ...existing, version: 8 } as MasterDataRecord;
    const contact = {
      id: 'contact',
      version: 3,
      attributes: { organizationId: 'identity' },
    } as unknown as MasterDataRecord;
    const address = {
      id: 'address',
      organizationId: 'identity',
      countryId: 'country',
      countryName: 'ایران',
      cityId: 'city',
      cityName: 'تهران',
      label: 'دفتر مرکزی',
      postalCode: '1234567890',
      addressLine: 'نشانی قبلی',
      isPrimary: true,
      displayOrder: 0,
      isActive: true,
      version: 4,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const update = vi
      .spyOn(masterDataApi, 'update')
      .mockResolvedValue({ data: saved });
    const saveContact = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: contact });
    const updateAddress = vi
      .spyOn(masterDataApi, 'updateOrganizationAddress')
      .mockResolvedValue({ data: address });
    const create = vi.spyOn(masterDataApi, 'create');
    const createAddress = vi.spyOn(masterDataApi, 'createOrganizationAddress');

    const result = await saveCooperation(
      {
        ...draft,
        legalName: 'نام ویرایش‌شده',
        registrationNumber: 'REG-2',
        economicCode: 'ECO-2',
        tourismLicenseNumber: 'LIC-2',
        fullName: 'نماینده ویرایش‌شده',
        jobTitle: 'مدیرعامل',
        phone: '09121234567',
        email: 'edited@example.com',
        chiefExecutiveNationalId: '1234567890',
        countryId: 'country',
        cityId: 'city',
        addressLine: 'نشانی جدید',
      },
      ['master_data.read', 'master_data.update'],
      existing,
      { contact, address },
    );

    expect(result).toBe(saved);
    expect(update).toHaveBeenCalledWith(
      'organizations',
      'identity',
      expect.objectContaining({
        version: 7,
        values: expect.objectContaining({
          legalName: 'نام ویرایش‌شده',
          registrationNumber: 'REG-2',
          economicCode: 'ECO-2',
          tourismLicenseNumber: 'LIC-2',
          roleCodes: 'AGENCY',
        }),
      }),
    );
    expect(saveContact).toHaveBeenCalledWith(
      'identity',
      expect.objectContaining({
        fullName: 'نماینده ویرایش‌شده',
        phone: '09121234567',
        email: 'edited@example.com',
      }),
      contact,
    );
    expect(updateAddress).toHaveBeenCalledWith(
      'identity',
      'address',
      expect.objectContaining({
        addressLine: 'نشانی جدید',
        version: 4,
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(createAddress).not.toHaveBeenCalled();
  });
  it('preserves protected representative fields when disclosure is unavailable', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const contact = {
      id: 'contact',
      version: 2,
      attributes: { organizationId: 'identity' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({ data: existing });
    const saveContact = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: contact });

    await saveCooperation(
      { ...draft, fullName: 'نماینده', jobTitle: 'مدیر' },
      ['master_data.read', 'master_data.update'],
      existing,
      { contact, preserveSensitiveContactFields: true },
    );

    expect(saveContact).toHaveBeenCalledWith(
      'identity',
      { fullName: 'نماینده' },
      contact,
    );
  });
  it('fills an empty protected email without clearing undisclosed phone and national ID', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const contact = {
      id: 'contact',
      version: 2,
      attributes: { organizationId: 'identity' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({ data: existing });
    const saveContact = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: contact });

    await saveCooperation(
      { ...draft, fullName: 'نماینده', email: 'new@example.com' },
      ['master_data.read', 'master_data.update'],
      existing,
      {
        contact,
        preserveSensitiveContactFields: true,
        editedSensitiveFields: ['email'],
      },
    );

    expect(saveContact).toHaveBeenCalledWith(
      'identity',
      { fullName: 'نماینده', email: 'new@example.com' },
      contact,
    );
  });
  it('creates a missing representative with a newly entered phone during dossier editing', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({ data: existing });
    const saveContact = vi
      .spyOn(agencyClient, 'saveContact')
      .mockResolvedValue({ data: {} as MasterDataRecord });
    const saveVerifiedContact = vi.spyOn(agencyClient, 'saveVerifiedContact');

    await saveCooperation(
      { ...draft, fullName: 'نماینده جدید', phone: '09121234567' },
      ['master_data.read', 'master_data.create', 'master_data.update'],
      existing,
      {},
    );

    expect(saveContact).toHaveBeenCalledWith(
      'identity',
      expect.objectContaining({
        fullName: 'نماینده جدید',
        phone: '09121234567',
      }),
      undefined,
    );
    expect(saveVerifiedContact).not.toHaveBeenCalled();
  });
  it('clears only corrected import review fields after their contact update succeeds', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: {
        roleCodes: 'AGENCY',
        importReviewFields: 'officePhone,addressLine',
      },
    } as unknown as MasterDataRecord;
    const updated = { ...existing, version: 2 } as MasterDataRecord;
    const update = vi
      .spyOn(masterDataApi, 'update')
      .mockResolvedValueOnce({ data: updated })
      .mockResolvedValueOnce({ data: { ...updated, version: 3 } });
    const contact = {
      id: 'contact',
      version: 1,
      attributes: { organizationId: 'identity' },
    } as unknown as MasterDataRecord;
    vi.spyOn(agencyClient, 'saveContact').mockResolvedValue({ data: contact });

    await saveCooperation(
      {
        ...draft,
        fullName: 'نماینده',
        officePhone: '02112345678',
        addressLine: '',
      },
      ['master_data.read', 'master_data.update', 'master_data.create'],
      existing,
      { contact },
    );
    expect(update).toHaveBeenNthCalledWith(2, 'organizations', 'identity', {
      version: 2,
      values: { importReviewFields: 'addressLine' },
    });
  });
  it('persists a typed address without inventing country or city identifiers', async () => {
    const existing = {
      id: 'identity',
      version: 1,
      attributes: { roleCodes: 'AGENCY' },
    } as unknown as MasterDataRecord;
    const createAddress = vi
      .spyOn(masterDataApi, 'createOrganizationAddress')
      .mockResolvedValue({ data: {} as never });

    await saveCooperation(
      { ...draft, addressLine: '  تهران، خیابان نمونه  ' },
      ['master_data.read', 'master_data.update'],
      existing,
    );

    expect(createAddress).toHaveBeenCalledWith('identity', {
      addressLine: 'تهران، خیابان نمونه',
      label: 'نشانی همکاری',
      isPrimary: false,
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
        { ...draft, fullName: 'نماینده آزمون', email: 'contact@example.com' },
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
  it('allows correction after a duplicate name is rejected before creation', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [{ name: draft.legalName }],
      meta: { total: 1 },
    } as never);
    const create = vi.spyOn(masterDataApi, 'create');
    let failure: unknown;
    try {
      await saveCooperation(draft, ['master_data.read', 'master_data.create']);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CooperationSaveError);
    expect((failure as CooperationSaveError).creationMayHaveSucceeded).toBe(
      false,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('does not offer an unsafe retry when organization creation has an unknown result', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as never);
    vi.spyOn(masterDataApi, 'create').mockRejectedValue(new Error('timeout'));
    let failure: unknown;
    try {
      await saveCooperation(draft, ['master_data.read', 'master_data.create']);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CooperationSaveError);
    expect((failure as CooperationSaveError).creationMayHaveSucceeded).toBe(
      true,
    );
    expect((failure as CooperationSaveError).organization).toBeUndefined();
  });
  it('allows correction after a definite create rejection', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as never);
    vi.spyOn(masterDataApi, 'create').mockRejectedValue(
      new MasterDataApiError('شناسه ملی نامعتبر است.', 400),
    );

    await expect(
      saveCooperation(draft, ['master_data.read', 'master_data.create']),
    ).rejects.toMatchObject({ creationMayHaveSucceeded: false });
  });
  it('does not accept impossible dates or a partial address', () => {
    expect(
      cooperationIssue(
        { ...draft, withAgreement: true, branchId: 'branch' },
        4,
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
        4,
      ),
    ).toBeTruthy();
    expect(
      cooperationIssue({ ...draft, countryId: 'country' }, 1),
    ).toBeTruthy();
  });
});
