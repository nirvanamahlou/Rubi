import {
  b2bAgreementTermsIssue,
  normalizeIranianMobile,
} from '@nora/contracts';
import type {
  B2bAgreementTermsV1,
  IamPermissionCode,
  MasterDataRecord,
} from '@nora/contracts';
import { blankAgreementTerms } from './agreement-terms';
import { masterDataApi } from '@/modules/master-data/api/client';
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
  role: 'AGENCY' | 'CORPORATE_CUSTOMER';
  countryId: string;
  cityId: string;
  addressLine: string;
  fullName: string;
  jobTitle: string;
  phone: string;
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
  role: 'AGENCY',
  countryId: '',
  cityId: '',
  addressLine: '',
  fullName: '',
  jobTitle: '',
  phone: '',
  email: '',
  withAgreement: false,
  branchId: '',
  pendingAgreementDocument: null,
  pendingGuaranteeDocuments: [],
};
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
      (draft.jobTitle || draft.phone || draft.email) &&
      draft.fullName.trim().length < 2
    )
      return 'نام نماینده را وارد کنید.';
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
      return 'ایمیل نماینده معتبر نیست.';
    if (draft.phone && !normalizeIranianMobile(draft.phone))
      return 'شماره همراه را به‌شکل 09xxxxxxxxx یا معادل +98/0098 آن وارد کنید.';
  }
  if (step === 3 && draft.phone) {
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
  ) {
    super(message);
  }
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
) {
  for (const step of [1, 2, 3, 4]) {
    const issue = cooperationIssue(draft, step);
    if (issue) throw new Error(issue);
  }
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
  if (!existing || draft.fullName) require('master_data.create');
  if ((existing && needsRole) || draft.addressLine)
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
      [
        draft.pendingAgreementDocument,
        ...draft.pendingGuaranteeDocuments,
      ].some((document) => document?.input.confidentialAccessCode)
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
  try {
    roles.add(draft.role);
    if (existing)
      organization = needsRole
        ? (
            await masterDataApi.update('organizations', existing.id, {
              version: existing.version,
              values: { roleCodes: [...roles].join(',') },
            })
          ).data
        : existing;
    else {
      if (await organizationByName(draft.legalName.trim()))
        throw new Error(
          'سازمانی با این نام قبلاً ثبت شده است؛ سازمان موجود را انتخاب کنید.',
        );
      organization = (
        await masterDataApi.create('organizations', {
          values: {
            legalName: draft.legalName.trim(),
            personType: draft.personType,
            nationalId: draft.nationalId.trim() || null,
            roleCodes: draft.role,
          },
        })
      ).data;
    }
    if (draft.fullName.trim()) {
      if (draft.phone.trim())
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
        });
      else
        await agencyClient.saveContact(organization.id, {
          fullName: draft.fullName.trim(),
          jobTitle: draft.jobTitle.trim(),
          phone: '',
          email: draft.email.trim(),
          preferredChannel: draft.email.trim() ? 'EMAIL' : 'OTHER',
        });
    }
    if (draft.addressLine.trim())
      await masterDataApi.createOrganizationAddress(organization.id, {
        ...(draft.countryId && draft.cityId
          ? { countryId: draft.countryId, cityId: draft.cityId }
          : {}),
        addressLine: draft.addressLine.trim(),
        label: 'نشانی همکاری',
        isPrimary: false,
      });
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
        requestId: draft.agreementRequestId ?? crypto.randomUUID(),
        terms: agreementTerms,
        ...(referenceGrants.length ? { referenceGrants } : {}),
      });
    }
    return organization;
  } catch (caught) {
    throw new CooperationSaveError(
      caught instanceof Error ? caught.message : 'ذخیره پرونده ناموفق بود.',
      organization,
    );
  }
}
