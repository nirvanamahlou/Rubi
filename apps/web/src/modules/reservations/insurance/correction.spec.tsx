import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  canCorrectInsurance,
  insuranceCorrectionHref,
  InsuranceCorrection,
  InsuranceRequirements,
} from './correction';

it('targets precisely the selected passenger without allowing query injection', () => {
  const url = new URL(
    insuranceCorrectionHref('passenger&customerId=another'),
    'https://example.invalid',
  );
  expect(url.pathname).toBe('/customers');
  expect([...url.searchParams]).toEqual([
    ['customerId', 'passenger&customerId=another'],
  ]);
});

it.each(['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'])(
  'allows correction of %s',
  (status) => {
    expect(canCorrectInsurance(status)).toBe(true);
  },
);

it.each(['ISSUED', 'CANCELLED', 'SUBMITTED', 'UNKNOWN'])(
  'does not offer local correction of %s',
  (status) => {
    expect(canCorrectInsurance(status)).toBe(false);
  },
);

it('renders the identity, passport, contact and journey requirements without claiming live coverage', () => {
  const html = renderToStaticMarkup(<InsuranceRequirements />);
  for (const text of [
    'لاتین',
    'تاریخ تولد',
    'جنسیت',
    'تابعیت',
    'شماره گذرنامه',
    'کد ملی',
    'صفر ابتدایی',
    'تلفن همراه',
    'ایمیل',
    'کشور مقصد',
    'مدت سفر',
    'آزمایشی',
  ])
    expect(html).toContain(text);
});

it('offers an enabled correction trigger and respects the caller permission/status guard', () => {
  const props = {
    customerId: '10000000-0000-4000-8000-000000000001',
    passengerName: 'SYNTHETIC TEST',
  };
  const enabled = renderToStaticMarkup(<InsuranceCorrection {...props} />);
  expect(enabled).toContain('اصلاح بیمه');
  expect(enabled).not.toContain('disabled=""');
  expect(
    renderToStaticMarkup(<InsuranceCorrection {...props} disabled />),
  ).toContain('disabled=""');
});
