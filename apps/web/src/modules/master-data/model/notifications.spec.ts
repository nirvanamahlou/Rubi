import type { MasterDataNotification } from '../api/client';
import { describe, expect, it } from 'vitest';

import { getMasterDataNotificationPresentation } from './notifications';

function notification(
  values: Partial<MasterDataNotification>,
): MasterDataNotification {
  return {
    id: 'event-1',
    action: 'master_data.update',
    changeKind: 'updated',
    resource: 'hotels',
    entityId: 'hotel-1',
    entityVersion: 2,
    recordLabel: 'هتل اسپیناس پالاس',
    occurredAt: '2026-09-07T08:00:00.000Z',
    ...values,
  };
}

describe('Master Data notification presentation', () => {
  it('links a changed record to its owning section with a readable title', () => {
    expect(getMasterDataNotificationPresentation(notification({}))).toEqual({
      href: '/master-data/accommodation?resource=hotels',
      sectionLabel: 'هتل‌ها',
      title: 'هتل «هتل اسپیناس پالاس» ویرایش شد',
    });
  });

  it('routes unlisted catalog resources to their visible owner section', () => {
    expect(
      getMasterDataNotificationPresentation(
        notification({
          resource: 'meal-services',
          changeKind: 'created',
          recordLabel: 'BB',
        }),
      ),
    ).toMatchObject({
      href: '/master-data/accommodation?resource=meal-services',
      title: expect.stringContaining('ایجاد شد'),
    });
  });

  it('uses the organization section for address changes', () => {
    expect(
      getMasterDataNotificationPresentation(
        notification({
          resource: 'organization-addresses',
          changeKind: 'deactivated',
          recordLabel: 'دفتر مرکزی',
        }),
      ),
    ).toEqual({
      href: '/master-data/organizations-suppliers?resource=organization-addresses',
      sectionLabel: 'آدرس‌های سازمان',
      title: 'آدرس سازمان «دفتر مرکزی» غیرفعال شد',
    });
  });
});
