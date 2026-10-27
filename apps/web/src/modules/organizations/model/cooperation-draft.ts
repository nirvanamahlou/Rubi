import {
  b2bAgreementTermsIssue,
  normalizeIranianMobile,
} from '@nora/contracts';
import type {
  B2bAgreementTermsV1,
  IamPermissionCode,
  MasterDataRecord,
  MasterOrganizationAddressV1,
} from '@nora/contracts';
import { blankAgreementTerms } from './agreement-terms';
import {
  masterDataApi,
  MasterDataApiError,
} from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import { documentsApi } from '@/modules/documents/api/client';
import {
  organizationDocumentForm,
  type StagedOrganizationDocument,
} from './organization-documents';
import {
  organizationByName,
  validateOrganizationRows,
} from './organization-import';
import { browserRandomUuid } from '@/lib/browser-random-uuid';

export interface CooperationDraft {
  registrationId: string;
  phoneVerificationGrant?: string | undefined;
  phoneVerificationExpiresAt?: string | undefined;
  agreementTerms: B2bAgreementTermsV1;
  agreementRequestId?: string;
  legalName: string;
  code: string;
  personType: string;
  nationalId: string;
  registrationNumber: string;
  economicCode: string;
  tourismLicenseNumber: string;
  role: 'AGENCY' | 'CORPORATE_CUSTOMER';
  countryId: string;
  cityId: string;
  addressLine: string;
  fullName: string;
  chiefExecutiveNationalId: string;
  jobTitle: string;
  phone: string;
  officePhone: string;
  email: string;
  withAgreement: boolean;
  branchId: string;
  pendingAgreementDocument: StagedOrganizationDocument | null;
  pendingGuaranteeDocuments: (StagedOrganizationDocument | null)[];
}
export const blankCooperationDraft: CooperationDraft = {
  registrationId: '',
  agreementTerms: blankAgreementTerms(),
  legalName: '',
  code: '',
  personType: 'LEGAL',
  nationalId: '',
  registrationNumber: '',
  economicCode: '',
  tourismLicenseNumber: '',
  role: 'AGENCY',
  countryId: '',
  cityId: '',
  addressLine: '',
  fullName: '',
  chiefExecutiveNationalId: '',
  jobTitle: '',
  phone: '',
  officePhone: '',
  email: '',
  withAgreement: false,
  branchId: '',
  pendingAgreementDocument: null,
  pendingGuaranteeDocuments: [],
};
/** Registration is identity/contact intake, never a contract/credit mutation. */
export function registrationCooperationDraft(
  draft: CooperationDraft,
  editing = false,
): CooperationDraft {
  if (draft.role !== 'AGENCY') return draft;
  return {
    ...draft,
    ...(!editing
      ? {
          nationalId: '',
          registrationNumber: '',
          economicCode: '',
          chiefExecutiveNationalId: '',
          jobTitle: '',
        }
      : {}),
    withAgreement: false,
    pendingAgreementDocument: null,
    pendingGuaranteeDocuments: [],
  };
}

export function cooperationIssue(
  draft: CooperationDraft,
  step: number,
): string | undefined {
  if (step === 1) {
    if (
      draft.nationalId.trim() &&
      (draft.personType !== 'LEGAL' ||
        !/^[0-9۰-۹٠-٩]{11}$/.test(draft.nationalId.trim()))
    )
      return 'شناسه ملی شرکت باید ۱۱ رقم و مربوط به شخصیت حقوقی باشد.';
    const identityIssue = validateOrganizationRows([
      {
        code: draft.code,
        legalName: draft.legalName,
        personType: draft.personType,
        nationalId: draft.nationalId,
        roleCodes: draft.role,
      },
    ])[0]?.issue;
    if (identityIssue) return identityIssue;
    if (Boolean(draft.countryId) !== Boolean(draft.cityId))
      return 'کشور و شهر نشانی باید با هم ثبت شوند.';
    if (draft.addressLine && draft.addressLine.trim().length < 2)
      return 'نشانی را کامل وارد کنید.';
    return undefined;
  }
  if (step === 2) {
    if (
      ((draft.role !== 'AGENCY' && draft.jobTitle) ||
        draft.phone ||
        draft.email) &&
      draft.fullName.trim().length < 2
    )
      return 'نام نماینده را وارد کنید.';
    if (
      draft.chiefExecutiveNationalId &&
      !/^[0-9۰-۹٠-٩\s]{10,20}$/.test(draft.chiefExecutiveNationalId)
    )
      return 'کد ملی مدیرعامل باید ۱۰ رقم باشد.';
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
      return 'ایمیل نماینده معتبر نیست.';
    if (draft.phone && !normalizeIranianMobile(draft.phone))
      return 'شماره همراه را به‌شکل 09xxxxxxxxx یا معادل +98/0098 آن وارد کنید.';
    if (
      draft.officePhone &&
      !/^\+?\d{7,20}$/.test(normalizeOfficePhone(draft.officePhone))
    )
      return 'تلفن ثابت معتبر نیست.';
    if (
      draft.role === 'AGENCY' &&
      draft.phone &&
      draft.officePhone &&
      normalizeIranianMobile(draft.phone) ===
        normalizeIranianMobile(draft.officePhone)
    )
      return 'شماره تلفن ثابت و همراه باید متفاوت باشند.';
  }
  if (step === 3 && draft.phone && draft.role !== 'AGENCY') {
    if (!draft.registrationId) return 'شناسه پیش‌نویس ثبت همکاری معتبر نیست.';
    if (!draft.branchId) return 'شعبه ثبت شماره را انتخاب کنید.';
    if (!draft.phoneVerificationGrant)
      return 'شماره همراه را با کد یک‌بارمصرف تأیید کنید.';
    const verificationExpiresAt = Date.parse(
      draft.phoneVerificationExpiresAt ?? '',
    );
    if (
      !Number.isFinite(verificationExpiresAt) ||
      Date.now() >= verificationExpiresAt
    )
      return 'مهلت تأیید شماره تمام شده است؛ کد جدید دریافت کنید.';
  }
  if (step === 4 && draft.withAgreement) {
    if (!draft.branchId) return 'شعبه قرارداد را انتخاب کنید.';
    if (!draft.agreementTerms.paymentMethodId)
      return 'روش پرداخت قرارداد را از اطلاعات پایه انتخاب کنید.';
    if (
      (draft.role === 'AGENCY' &&
        draft.agreementTerms.agreementType === 'CORPORATE') ||
      (draft.role === 'CORPORATE_CUSTOMER' &&
        draft.agreementTerms.agreementType === 'AGENCY')
    )
      return 'نوع قرارداد را با نقش همکاری هماهنگ کنید.';
    const termsForValidation = {
      ...draft.agreementTerms,
      guarantees: draft.agreementTerms.guarantees.map((guarantee, index) =>
        draft.pendingGuaranteeDocuments[index]
          ? {
              ...guarantee,
              documentId:
                guarantee.documentId ?? 'pending-document-selected-for-upload',
            }
          : guarantee,
      ),
    };
    return b2bAgreementTermsIssue(termsForValidation);
  }
}
export class CooperationSaveError extends Error {
  constructor(
    message: string,
    readonly organization?: MasterDataRecord,
    readonly creationMayHaveSucceeded = false,
  ) {
    super(message);
  }
}
export interface CooperationEditContext {
  contact?: MasterDataRecord;
  officeContact?: MasterDataRecord;
  officePhoneAvailable?: boolean;
  officePhoneEdited?: boolean;
  address?: MasterOrganizationAddressV1;
  preserveSensitiveContactFields?: boolean;
  editedSensitiveFields?: readonly (
    'phone' | 'email' | 'chiefExecutiveNationalId'
  )[];
}
export function normalizeOfficePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\s().-]/g, '');
}
export function cooperationContacts(contacts: readonly MasterDataRecord[]) {
  const officeContact = contacts.find(
    (contact) => contact.attributes.jobTitle === 'تلفن ثابت',
  );
  const candidates = contacts.filter((contact) => contact !== officeContact);
  const contact =
    candidates.find((item) => String(item.attributes.isPrimary) === 'true') ??
    candidates[0];
  return { contact, officeContact };
}
export function cooperationContactPhones(
  phone: string,
  agency: boolean,
  separateOffice: boolean,
) {
  const officeOnly = agency && Boolean(phone) && !normalizeIranianMobile(phone);
  return {
    phone: officeOnly ? '' : phone,
    ...(!separateOffice && officeOnly ? { officePhone: phone } : {}),
  };
}
export function normalizeOtpCode(value: string) {
  return value
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/\D/g, '')
    .slice(0, 6);
}
export async function saveCooperation(
  draft: CooperationDraft,
  permissions: readonly IamPermissionCode[],
  existing?: MasterDataRecord,
  editContext?: CooperationEditContext,
) {
  draft = { ...draft, officePhone: normalizeOfficePhone(draft.officePhone) };
  for (const step of [1, 2, 3, 4]) {
    if (step === 3 && editContext) continue;
    const issue = cooperationIssue(draft, step);
    if (issue) throw new Error(issue);
  }
  if (
    draft.role === 'AGENCY' &&
    draft.fullName.trim() &&
    !editContext?.contact &&
    !draft.phone.trim() &&
    !draft.officePhone &&
    !draft.email.trim()
  )
    throw new Error('حداقل تلفن یا ایمیل مخاطب الزامی است.');
  const saveOfficeContact =
    draft.role === 'AGENCY' &&
    (editContext?.officeContact ||
      (draft.officePhone &&
        (draft.phone.trim() ||
          !draft.fullName.trim() ||
          editContext?.preserveSensitiveContactFields))) &&
    (!editContext?.officeContact ||
      editContext.officePhoneAvailable ||
      editContext.officePhoneEdited);
  const roles = new Set(
    String(existing?.attributes.roleCodes ?? '')
      .split(',')
      .filter(Boolean),
  );
  const needsRole = !roles.has(draft.role);
  const require = (permission: IamPermissionCode) => {
    if (!permissions.includes(permission))
      throw new Error('مجوز لازم برای ذخیره این اطلاعات وجود ندارد.');
  };
  require('master_data.read');
  if (
    !existing ||
    (draft.fullName && !editContext?.contact) ||
    (saveOfficeContact && !editContext?.officeContact)
  )
    require('master_data.create');
  if (editContext || (existing && needsRole) || draft.addressLine)
    require('master_data.update');
  if (draft.withAgreement)
    for (const permission of [
      'b2b.agreement.read',
      'b2b.credit.read',
      'b2b.agreement.manage',
    ] as const)
      require(permission);
  if (
    draft.withAgreement &&
    (draft.pendingAgreementDocument ||
      draft.pendingGuaranteeDocuments.some(Boolean))
  ) {
    require('documents.upload');
    require('documents.list');
    require('documents.organization.read');
    require('documents.metadata.read');
    if (
      [draft.pendingAgreementDocument, ...draft.pendingGuaranteeDocuments].some(
        (document) => document?.input.confidentialAccessCode,
      )
    )
      require('documents.file.read');
  }
  if (
    draft.withAgreement &&
    (draft.agreementTerms.creditPolicies.length ||
      draft.agreementTerms.guarantees.length)
  )
    require('b2b.credit.manage');
  let organization: MasterDataRecord | undefined;
  let creationAttempted = false;
  try {
    roles.add(draft.role);
    if (existing) {
      organization = editContext
        ? (
            await masterDataApi.update('organizations', existing.id, {
              version: existing.version,
              values: {
                legalName: draft.legalName.trim(),
                personType: draft.personType,
                nationalId: draft.nationalId.trim() || null,
                registrationNumber: draft.registrationNumber.trim() || null,
                economicCode: draft.economicCode.trim() || null,
                tourismLicenseNumber: draft.tourismLicenseNumber.trim() || null,
                roleCodes: [...roles].join(','),
              },
            })
          ).data
        : needsRole
          ? (
              await masterDataApi.update('organizations', existing.id, {
                version: existing.version,
                values: { roleCodes: [...roles].join(',') },
              })
            ).data
          : existing;
    } else {
      if (await organizationByName(draft.legalName.trim()))
        throw new Error(
          'سازمانی با این نام قبلاً ثبت شده است؛ سازمان موجود را انتخاب کنید.',
        );
      creationAttempted = true;
      organization = (
        await masterDataApi.create('organizations', {
          values: {
            legalName: draft.legalName.trim(),
            personType: draft.personType,
            nationalId: draft.nationalId.trim() || null,
            registrationNumber: draft.registrationNumber.trim() || null,
            economicCode: draft.economicCode.trim() || null,
            tourismLicenseNumber: draft.tourismLicenseNumber.trim() || null,
            roleCodes: draft.role,
          },
        })
      ).data;
    }
    if (draft.fullName.trim()) {
      if (editContext)
        await agencyClient.saveContact(
          organization.id,
          {
            fullName: draft.fullName.trim(),
            ...(draft.role !== 'AGENCY'
              ? { jobTitle: draft.jobTitle.trim() }
              : {}),
            ...(!editContext.preserveSensitiveContactFields ||
            editContext.editedSensitiveFields?.includes('phone')
              ? {
                  phone:
                    draft.phone.trim() ||
                    (!editContext.officeContact ? draft.officePhone : ''),
                }
              : {}),
            ...(!editContext.preserveSensitiveContactFields ||
            editContext.editedSensitiveFields?.includes('email')
              ? { email: draft.email.trim() }
              : {}),
            ...(!editContext.preserveSensitiveContactFields ||
            editContext.editedSensitiveFields?.includes(
              'chiefExecutiveNationalId',
            )
              ? { nationalId: draft.chiefExecutiveNationalId.trim() }
              : {}),
            ...(!editContext.contact ||
            !editContext.preserveSensitiveContactFields
              ? {
                  preferredChannel: draft.phone.trim()
                    ? 'PHONE'
                    : draft.email.trim()
                      ? 'EMAIL'
                      : 'OTHER',
                }
              : {}),
          },
          editContext.contact,
        );
      else if (draft.phone.trim() && draft.role !== 'AGENCY')
        await agencyClient.saveVerifiedContact({
          registrationId: draft.registrationId,
          branchId: draft.branchId,
          role: draft.role,
          organizationId: organization.id,
          phone: draft.phone,
          grant: draft.phoneVerificationGrant ?? '',
          fullName: draft.fullName.trim(),
          jobTitle: draft.jobTitle.trim(),
          ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
          ...(draft.chiefExecutiveNationalId.trim()
            ? { nationalId: draft.chiefExecutiveNationalId.trim() }
            : {}),
        });
      else
        await agencyClient.saveContact(organization.id, {
          fullName: draft.fullName.trim(),
          jobTitle: draft.role === 'AGENCY' ? '' : draft.jobTitle.trim(),
          phone: draft.phone.trim() || draft.officePhone,
          email: draft.email.trim(),
          nationalId: draft.chiefExecutiveNationalId.trim(),
          preferredChannel:
            draft.phone.trim() || draft.officePhone
              ? 'PHONE'
              : draft.email.trim()
                ? 'EMAIL'
                : 'OTHER',
          ...(draft.role === 'AGENCY'
            ? { isPrimary: 'true', hasWhatsapp: 'false' }
            : {}),
        });
    }
    if (saveOfficeContact) {
      await agencyClient.saveContact(
        organization.id,
        {
          fullName: 'دفتر آژانس',
          jobTitle: 'تلفن ثابت',
          phone: draft.officePhone.trim(),
          preferredChannel: 'PHONE',
          hasWhatsapp: 'false',
          isPrimary: 'false',
        },
        editContext?.officeContact,
      );
    }
    if (draft.addressLine.trim()) {
      const location =
        draft.countryId && draft.cityId
          ? { countryId: draft.countryId, cityId: draft.cityId }
          : editContext
            ? { countryId: null, cityId: null }
            : {};
      if (editContext?.address)
        await masterDataApi.updateOrganizationAddress(
          organization.id,
          editContext.address.id,
          {
            ...location,
            addressLine: draft.addressLine.trim(),
            label: editContext.address.label,
            postalCode: editContext.address.postalCode,
            isPrimary: editContext.address.isPrimary,
            isActive: editContext.address.isActive,
            displayOrder: editContext.address.displayOrder,
            version: editContext.address.version,
          },
        );
      else
        await masterDataApi.createOrganizationAddress(organization.id, {
          ...location,
          addressLine: draft.addressLine.trim(),
          label: 'نشانی همکاری',
          isPrimary: Boolean(editContext),
        });
    }
    if (editContext && existing?.attributes.importReviewFields) {
      const unresolved = String(existing.attributes.importReviewFields)
        .split(',')
        .filter((field) => {
          if (field === 'nationalId')
            return !/^\d{11}$/.test(draft.nationalId.trim());
          if (field === 'chiefExecutiveNationalId')
            return !/^\d{10}$/.test(draft.chiefExecutiveNationalId.trim());
          if (field === 'officePhone')
            return !/^\+?\d{7,20}$/.test(draft.officePhone);
          if (field === 'chiefExecutiveMobile')
            return (
              !draft.fullName.trim() || !normalizeIranianMobile(draft.phone)
            );
          if (field === 'email')
            return (
              !draft.fullName.trim() ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
            );
          if (field === 'addressLine')
            return draft.addressLine.trim().length < 5;
          return true;
        });
      if (
        unresolved.join(',') !== String(existing.attributes.importReviewFields)
      )
        organization = (
          await masterDataApi.update('organizations', organization.id, {
            version: organization.version,
            values: { importReviewFields: unresolved.join(',') || null },
          })
        ).data;
    }
    if (draft.withAgreement) {
      const savedOrganization = organization;
      if (!savedOrganization)
        throw new Error('هویت سازمان پیش از ثبت قرارداد ایجاد نشده است.');
      let agreementTerms = draft.agreementTerms;
      const referenceGrants: { documentId: string; token: string }[] = [];
      if (
        draft.pendingAgreementDocument ||
        draft.pendingGuaranteeDocuments.some(Boolean)
      ) {
        const options = (await documentsApi.options()).data;
        const upload = async (pending: StagedOrganizationDocument) => {
          const type = options.documentTypes.find(
            (item) => item.id === pending.input.documentTypeId,
          );
          if (!type || type.domain !== 'ORGANIZATION')
            throw new Error('نوع سند سازمان برای بارگذاری معتبر نیست.');
          const form = organizationDocumentForm(
            savedOrganization,
            { ...pending.input, branchId: draft.branchId },
            pending.file,
            options,
            permissions,
          );
          const uploaded = await documentsApi.upload(form);
          if (type.defaultConfidentiality === 'CONFIDENTIAL') {
            const grant = await documentsApi.createAccessGrant(
              uploaded.data.id,
              {
                code: pending.input.confidentialAccessCode ?? '',
                purpose: 'CONFIDENTIAL_VIEW',
              },
            );
            referenceGrants.push({
              documentId: uploaded.data.id,
              token: grant.data.token,
            });
          }
          return uploaded.data.id;
        };
        const documentId = draft.pendingAgreementDocument
          ? await upload(draft.pendingAgreementDocument)
          : agreementTerms.documentId;
        const guarantees = [];
        for (const [index, guarantee] of agreementTerms.guarantees.entries()) {
          const pending = draft.pendingGuaranteeDocuments[index];
          guarantees.push(
            pending
              ? {
                  ...guarantee,
                  documentId: await upload(pending),
                  documentVersionId: null,
                }
              : guarantee,
          );
        }
        agreementTerms = {
          ...agreementTerms,
          documentId,
          ...(draft.pendingAgreementDocument
            ? { documentVersionId: null }
            : agreementTerms.documentVersionId !== undefined
              ? { documentVersionId: agreementTerms.documentVersionId }
              : {}),
          guarantees,
        };
      }
      await agencyClient.saveAgreementTerms(organization.id, {
        branchId: draft.branchId,
        role: draft.role,
        requestId: draft.agreementRequestId ?? browserRandomUuid(),
        terms: agreementTerms,
        ...(referenceGrants.length ? { referenceGrants } : {}),
      });
    }
    return organization;
  } catch (caught) {
    throw new CooperationSaveError(
      caught instanceof Error ? caught.message : 'ذخیره پرونده ناموفق بود.',
      organization,
      creationAttempted &&
        !organization &&
        !(
          caught instanceof MasterDataApiError &&
          caught.status >= 400 &&
          caught.status < 500
        ),
    );
  }
}
