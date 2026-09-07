import type { MasterDataNotification } from '../api/client';
import {
  getMasterDataDefinition,
  masterDataResourceKeys,
  type MasterDataResourceKey,
} from './catalog';
import {
  getMasterDataSectionForResource,
  type MasterDataSectionSlug,
} from './sections';

const changeLabels = {
  created: 'ایجاد شد',
  updated: 'ویرایش شد',
  activated: 'فعال شد',
  deactivated: 'غیرفعال شد',
  deleted: 'حذف شد',
  approved: 'تأیید شد',
  rejected: 'رد شد',
} as const;

const specialResources: Record<
  string,
  { label: string; singularLabel: string; slug: MasterDataSectionSlug }
> = {
  'organization-addresses': {
    label: 'آدرس‌های سازمان',
    singularLabel: 'آدرس سازمان',
    slug: 'organizations-suppliers',
  },
  'hotel-imports': {
    label: 'ورود گروهی هتل',
    singularLabel: 'ورود گروهی هتل',
    slug: 'accommodation',
  },
};

const unlistedOwners: Partial<
  Record<MasterDataResourceKey, MasterDataSectionSlug>
> = {
  'meal-services': 'accommodation',
  facilities: 'accommodation',
  'cip-services': 'tours-travel-services',
  'lead-sources': 'sales-references',
  'customer-types': 'sales-references',
  'campaign-types': 'sales-references',
  'lost-reasons': 'sales-references',
  tags: 'sales-references',
};

function isMasterDataResource(
  resource: string,
): resource is MasterDataResourceKey {
  return (masterDataResourceKeys as readonly string[]).includes(resource);
}

export function getMasterDataNotificationPresentation(
  notification: MasterDataNotification,
) {
  const special = specialResources[notification.resource];
  const definition = isMasterDataResource(notification.resource)
    ? getMasterDataDefinition(notification.resource)
    : null;
  const slug = definition
    ? (getMasterDataSectionForResource(definition.key)?.slug ??
      unlistedOwners[definition.key])
    : special?.slug;
  const subject =
    special?.singularLabel ?? definition?.singularLabel ?? 'رکورد';
  const record = notification.recordLabel
    ? ` «${notification.recordLabel}»`
    : '';
  return {
    href: slug
      ? `/master-data/${slug}?resource=${encodeURIComponent(notification.resource)}`
      : '/master-data',
    sectionLabel: special?.label ?? definition?.label ?? 'اطلاعات پایه',
    title: `${subject}${record} ${changeLabels[notification.changeKind]}`,
  };
}
