import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import {
  masterDataApi,
  type MasterDataLogoChange,
} from '@/modules/master-data/api/client';

export type OrganizationDeletionTarget =
  | { resource: 'organizations'; record: MasterDataRecord }
  | {
      resource: 'organization-contacts';
      record: MasterDataRecord;
      organizationId: string;
    };

export async function deleteOrganizationRecord(
  target: OrganizationDeletionTarget,
  permissions: readonly IamPermissionCode[],
) {
  if (!permissions.includes('master_data.delete'))
    throw new Error('مجوز حذف دائمی این رکورد را ندارید.');
  const { record, resource } = target;
  if (
    record.resource !== resource ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1
  )
    throw new Error('اطلاعات رکورد معتبر نیست؛ فهرست را تازه‌سازی کنید.');
  if (
    resource === 'organization-contacts' &&
    String(record.attributes.organizationId) !== target.organizationId
  )
    throw new Error('این مخاطب متعلق به سازمان انتخاب‌شده نیست.');
  const result = await masterDataApi.remove(
    resource,
    record.id,
    record.version,
  );
  if (
    result.data.id !== record.id ||
    result.data.resource !== resource ||
    result.data.deleted !== true
  )
    throw new Error(
      'نتیجه حذف تأیید نشد؛ پیش از اقدام مجدد فهرست را بررسی کنید.',
    );
}

export function saveOrganizationChanges({
  record,
  values,
  permissions,
  defaultRole,
  logoChange,
}: {
  record?: MasterDataRecord;
  values: Record<string, string>;
  permissions: readonly IamPermissionCode[];
  defaultRole: 'AGENCY' | 'CORPORATE_CUSTOMER';
  logoChange?: MasterDataLogoChange;
}) {
  if (
    !permissions.includes(record ? 'master_data.update' : 'master_data.create')
  )
    throw new Error('مجوز ذخیره اطلاعات سازمان را ندارید.');
  const roles = new Set(
    String(values.roleCodes ?? record?.attributes.roleCodes ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!roles.has('AGENCY') && !roles.has('CORPORATE_CUSTOMER'))
    roles.add(defaultRole);
  return masterDataApi.persistWithLogo({
    resource: 'organizations',
    values: { ...values, roleCodes: [...roles].join(',') },
    title: `لوگوی سازمان ${values.legalName ?? record?.name ?? ''}`.trim(),
    ...(record ? { existing: record } : {}),
    ...(logoChange ? { logoChange } : {}),
  });
}
