import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import {
  organizationByName,
  validateOrganizationRows,
} from './organization-import';

export interface CooperationDraft {
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
    if (draft.role !== 'AGENCY')
      return 'قرارداد عملیاتی مشتری سازمانی هنوز متصل نیست.';
    if (!draft.branchId || draft.agreementTitle.trim().length < 2)
      return 'شعبه و عنوان قرارداد لازم است.';
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.startsAt) ||
      Number.isNaN(Date.parse(draft.startsAt)) ||
      new Date(draft.startsAt).toISOString().slice(0, 10) !== draft.startsAt
    )
      return 'تاریخ شروع معتبر لازم است.';
    if (
      draft.endsAt &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(draft.endsAt) ||
        Number.isNaN(Date.parse(draft.endsAt)) ||
        new Date(draft.endsAt).toISOString().slice(0, 10) !== draft.endsAt ||
        draft.endsAt < draft.startsAt)
    )
      return 'تاریخ پایان باید معتبر و پس از شروع باشد.';
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
      'b2b.agency.read',
      'b2b.agreement.read',
      'b2b.credit.read',
      'b2b.rate.read',
      'b2b.agency.manage',
      'b2b.agreement.manage',
    ] as const)
      require(permission);
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
      const workspace = await agencyClient.workspace(
        organization.id,
        draft.branchId,
      );
      if (!workspace.data.profile)
        await agencyClient.upsertProfile(organization.id, {
          branchId: draft.branchId,
          status: 'UNDER_REVIEW',
          displayOrder: 0,
        });
      await agencyClient.createAgreement(organization.id, {
        branchId: draft.branchId,
        title: draft.agreementTitle.trim(),
        startsAt: draft.startsAt,
        endsAt: draft.endsAt || null,
        status: 'DRAFT',
        notes: draft.notes.trim() || null,
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
