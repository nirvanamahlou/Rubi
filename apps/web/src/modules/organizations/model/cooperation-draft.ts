import { b2bAgreementTermsIssue } from '@rubi/contracts';
import type {
  B2bAgreementTermsV1,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';
import { blankAgreementTerms } from './agreement-terms';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import {
  organizationByName,
  validateOrganizationRows,
} from './organization-import';

export interface CooperationDraft {
  agreementTerms: B2bAgreementTermsV1;
  agreementRequestId?: string;
  legalName: string;
  code: string;
  personType: string;
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
  agreementTitle: string;
  startsAt: string;
  endsAt: string;
  notes: string;
}
export const blankCooperationDraft: CooperationDraft = {
  agreementTerms: blankAgreementTerms(),
  legalName: '',
  code: '',
  personType: 'LEGAL',
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
  agreementTitle: '',
  startsAt: '',
  endsAt: '',
  notes: '',
};
export function cooperationIssue(
  draft: CooperationDraft,
  step: number,
): string | undefined {
  if (step === 1)
    return validateOrganizationRows([
      {
        code: draft.code,
        legalName: draft.legalName,
        personType: draft.personType,
        roleCodes: draft.role,
      },
    ])[0]?.issue;
  if (step === 2) {
    if (
      (draft.countryId || draft.cityId || draft.addressLine) &&
      (!draft.countryId || !draft.cityId || draft.addressLine.trim().length < 2)
    )
      return 'برای ثبت نشانی، کشور، شهر و نشانی کامل را وارد کنید.';
    if (
      (draft.jobTitle || draft.phone || draft.email) &&
      draft.fullName.trim().length < 2
    )
      return 'نام نماینده را وارد کنید.';
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
      return 'ایمیل نماینده معتبر نیست.';
  }
  if (step === 3 && draft.withAgreement) {
    if (!draft.branchId) return 'شعبه قرارداد را انتخاب کنید.';
    if (
      (draft.role === 'AGENCY' &&
        draft.agreementTerms.agreementType === 'CORPORATE') ||
      (draft.role === 'CORPORATE_CUSTOMER' &&
        draft.agreementTerms.agreementType === 'AGENCY')
    )
      return 'نوع قرارداد را با نقش همکاری هماهنگ کنید.';
    return b2bAgreementTermsIssue(draft.agreementTerms);
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
export async function saveCooperation(
  draft: CooperationDraft,
  permissions: readonly IamPermissionCode[],
  existing?: MasterDataRecord,
) {
  for (const step of [1, 2, 3]) {
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
            roleCodes: draft.role,
          },
        })
      ).data;
    }
    if (draft.fullName.trim())
      await agencyClient.saveContact(organization.id, {
        fullName: draft.fullName.trim(),
        jobTitle: draft.jobTitle.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
      });
    if (draft.addressLine.trim())
      await masterDataApi.createOrganizationAddress(organization.id, {
        countryId: draft.countryId,
        cityId: draft.cityId,
        addressLine: draft.addressLine.trim(),
        label: 'نشانی همکاری',
        isPrimary: false,
      });
    if (draft.withAgreement) {
      await agencyClient.saveAgreementTerms(organization.id, {
        branchId: draft.branchId,
        role: draft.role,
        requestId: draft.agreementRequestId ?? crypto.randomUUID(),
        terms: draft.agreementTerms,
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
