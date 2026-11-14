import { describe, expect, it } from 'vitest';
import { activityActionLabel } from './activity-action-label';

describe('system history action labels', () => {
  it.each([
    ['POST /sales/people', 'افزودن'],
    ['PATCH /hr/employees/:id', 'ویرایش'],
    ['PUT /system-management/settings', 'ویرایش'],
    ['DELETE /sales/people/:id', 'حذف'],
    ['POST /iam/auth/login', 'ورود به سامانه'],
    ['POST /iam/auth/logout', 'خروج از سامانه'],
    ['POST /hr/requests/:id/approve', 'تأیید'],
    ['POST /sales/contracts/:id/cancel', 'لغو'],
    ['POST /customer-affairs/call-center/search', 'مشاهده اطلاعات'],
    ['POST /documents/upload', 'بارگذاری'],
    ['iam.user.details.update', 'ویرایش'],
    ['system.setting.write', 'ویرایش'],
    ['company.create', 'افزودن'],
    ['unknown.event', 'ثبت فعالیت'],
  ])('formats %s', (action, label) => {
    expect(activityActionLabel(action)).toBe(label);
  });
});
