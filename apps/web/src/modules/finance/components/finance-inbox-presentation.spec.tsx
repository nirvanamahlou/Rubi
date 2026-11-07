import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FinanceInboxLiveWorkspace } from './finance-inbox-live-workspace';

it('keeps contract search and compact filters without removed controls', () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <FinanceInboxLiveWorkspace />
    </QueryClientProvider>,
  );
  expect(html).toContain('جست‌وجوی قرارداد، طرف‌حساب، شرح یا شماره درخواست');
  expect(html).toContain('فیلتر واحد ارسال‌کننده');
  expect(html).toContain('فیلتر وضعیت درخواست');
  expect(html).toContain('فیلتر نوع درخواست');
  expect(html).toContain('درخواست‌های در انتظار');
  expect(html).toContain('درخواست‌های تأییدشده');
  expect(html).toMatch(/aria-pressed="true"[^>]*>درخواست‌های در انتظار/);
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
  expect(html).not.toContain('نمای کلی عملیات مالی');
  expect(html).not.toContain('برای ثبت دریافت و پرداخت');
  expect(html).not.toContain('مدیر پیگیری هر شعبه');
  expect(html.indexOf('فهرست درخواست‌ها')).toBeLessThan(
    html.indexOf('صفحه قبل'),
  );
});
