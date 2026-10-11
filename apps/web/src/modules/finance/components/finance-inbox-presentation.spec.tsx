import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FinanceInboxLiveWorkspace } from './finance-inbox-live-workspace';

it('keeps contract search and compact filters without removed controls', () => {
  const html = renderToStaticMarkup(<FinanceInboxLiveWorkspace />);
  expect(html).toContain('جست‌وجوی قرارداد، طرف‌حساب، شرح یا شماره درخواست');
  expect(html).toContain('فیلتر واحد ارسال‌کننده');
  expect(html).toContain('فیلتر وضعیت درخواست');
  expect(html).toContain('از تاریخ ثبت درخواست');
  expect(html).toContain('تا تاریخ ثبت درخواست');
  for (const removed of [
    'شناسه شعبه',
    'درخواست‌کننده / ذی‌نفع',
    'سررسید از',
    'سررسید تا',
    'نمای ذخیره‌شده',
    'نام نمای جدید',
    'مشاهده تاریخچه دریافت و پرداخت',
  ]) {
    expect(html).not.toContain(removed);
  }
  expect(html).toContain('<details');
});
