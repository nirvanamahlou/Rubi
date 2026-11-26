import { expect, it } from 'vitest';
import { isInsuranceSummary, formatInsuranceSummary } from './insurance-report';
import { resolveCustomerQuestion } from './customer-guides';

it.each([
  'کل بیمه‌نامه‌های مسافرتی ثبت‌شده چندتاست، چندتاش صادر شده و جمع مبلغ صادرشده‌ها چند ریاله؟',
  'الان تعداد بیمه‌نامه‌های نیازمند بررسی چنده؟',
])('routes the insurance summary for %s', (question) => {
  expect(isInsuranceSummary(question)).toBe(true);
  expect(resolveCustomerQuestion(question, false)).toBeUndefined();
});

it.each([
  'تعداد بیمه‌نامه‌های دیروز چنده؟',
  'تعداد بیمه‌نامه‌های ترکیه چنده؟',
  'چطور بیمه‌نامه ثبت کنم؟',
])('does not discard constraints in %s', (question) =>
  expect(isInsuranceSummary(question)).toBe(false),
);

it('keeps actual passenger questions in B2C', () => {
  expect(
    resolveCustomerQuestion('تعداد کل مسافران چنده؟', false),
  ).toMatchObject({ metric: 'passengers' });
});

it('uses full aggregates, retains currencies and excludes failed amounts', () => {
  const text = formatInsuranceSummary({
    data: [],
    count: 14,
    totals: [
      { status: 'ISSUED', currencyCode: 'IRR', count: 7, amount: '800000' },
      { status: 'ISSUED', currencyCode: 'USD', count: 3, amount: '90.50' },
      {
        status: 'PROVIDER_ERROR',
        currencyCode: 'USD',
        count: 4,
        amount: '1400',
      },
    ],
  });
  expect(text).toContain('صادرشده: ۱۰');
  expect(text).toContain('نیازمند بررسی: ۴');
  expect(text).toContain('800000 IRR، 90.50 USD');
  expect(text).not.toContain('1400');
});
