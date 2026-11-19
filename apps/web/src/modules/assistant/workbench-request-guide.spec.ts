import { describe, expect, it } from 'vitest';
import type { WorkbenchRequestItemV1 } from '@nora/contracts';
import {
  asksWorkbenchRequestStatus,
  describeWorkbenchRequest,
} from './workbench-request-guide';

const request = (overrides: Partial<WorkbenchRequestItemV1> = {}) =>
  ({
    id: 'leave-1',
    trackingNumber: 'WB-101',
    subject: 'مرخصی ساعتی',
    direction: 'outgoing',
    status: 'NEW',
    recipientName: 'مدیر نمونه',
    destinationUnit: 'فروش',
    leave: { mode: 'ساعتی' },
    progress: { managerApproved: false, hrApproved: false, completed: false },
    ...overrides,
  }) as WorkbenchRequestItemV1;

describe('Workbench request guidance', () => {
  it.each([
    'درخواستم الان دست کیه؟',
    'وضعیت درخواست من چیه؟',
    'مرخصی من تأیید شد؟',
  ])('routes %s to the native reader', (question) => {
    expect(asksWorkbenchRequestStatus(question, false)).toBe(true);
  });
  it.each([
    'چطور وضعیت درخواست من را ببینم؟',
    'درخواست کال سنتر دست کیه؟',
    'قرارداد من کجاست؟',
  ])('keeps %s out of the workbench reader', (question) => {
    expect(asksWorkbenchRequestStatus(question, true)).toBe(false);
  });
  it('uses the returned assignee and explicit approval progress for each stage', () => {
    expect(
      describeWorkbenchRequest('درخواستم دست کیه', [request()]).text,
    ).toContain('مدیر نمونه');
    const hr = request({
      recipientName: 'مسئول نمونه',
      destinationUnit: 'منابع انسانی',
      progress: { managerApproved: true, hrApproved: false, completed: false },
    });
    const pending = describeWorkbenchRequest('درخواست من کجاست', [hr]).text;
    expect(pending).toContain('تأیید مدیر واحد: ثبت شده');
    expect(pending).toContain('تأیید منابع انسانی: در کارتابل ثبت نشده');
    for (const status of ['APPROVED', 'REJECTED', 'CLOSED'])
      expect(
        describeWorkbenchRequest('درخواستم دست کیه', [{ ...hr, status }]).text,
      ).toContain('گیرندهٔ ثبت‌شده');
  });
  it('asks for a code when ambiguous and resolves only authorized codes or selections', () => {
    const rows = [
      request(),
      request({
        id: 'leave-2',
        trackingNumber: 'WB-102',
        recipientName: null,
        destinationUnit: null,
      }),
    ];
    expect(describeWorkbenchRequest('درخواستم کجاست', rows).text).toContain(
      'چند درخواست',
    );
    expect(
      describeWorkbenchRequest('وضعیت درخواست کد پیگیری WB-۱۰۲', rows).text,
    ).toContain('در کارتابل مشخص نشده');
    expect(
      describeWorkbenchRequest('وضعیت درخواست کد پیگیری WB-999', rows).text,
    ).toContain('پیدا نشد');
    expect(
      describeWorkbenchRequest('درخواستم کجاست', rows, 'leave-2').href,
    ).toContain('request=leave-2');
    expect(
      describeWorkbenchRequest('درخواستم کجاست', [
        request({ direction: 'incoming' }),
      ]).text,
    ).toContain('پیدا نشد');
  });
});
