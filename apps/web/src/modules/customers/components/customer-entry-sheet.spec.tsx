import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CustomerEntrySheet,
  type CustomerEntryRow,
} from './customer-entry-sheet';
import { validateCustomerEntryRows } from '../model/customer-entry';

const row: CustomerEntryRow = {
  key: 'customer',
  label: 'مشتری اصلی',
  role: 'مشتری',
  values: {
    firstName: 'آزمایشی',
    lastName: 'نمونه',
    nationalId: '0012345678',
    birthDate: '',
    passportNumber: '',
    phone: '',
    email: '',
  },
  onChange: vi.fn(),
};
const render = (rows: CustomerEntryRow[], disabled = false) =>
  renderToStaticMarkup(
    <CustomerEntrySheet
      rows={rows}
      calendarMode="persian"
      onCalendarModeChange={vi.fn()}
      disabled={disabled}
    />,
  );

describe('Customer entry spreadsheet', () => {
  it('renders a real labelled table with independent stable rows and essential columns', () => {
    const html = render([
      row,
      { ...row, key: 'companion-2', label: 'مسافر ۱', role: 'مسافر' },
    ]);
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('scope="row"');
    expect(html).toContain('customer-first-name');
    expect(html).toContain('companion-2-first-name');
    expect(html).toContain('companion-2-national-id');
    expect(html).toContain('companion-2-email');
    expect(html).toContain('overflow-x-auto');
    expect(html).not.toContain('type="submit"');
  });
  it('keeps national IDs ten digits and optional passport/contact fields separate', () => {
    const html = render([row]);
    expect(html).toContain('maxLength="10"');
    expect(html).toContain('minLength="10"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('customer-passport-number');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="tel"');
  });
  it('renders reuse rows without editable copies and blocks editing during save', () => {
    expect(
      render([{ ...row, readOnly: true }]).match(/disabled=""/g),
    ).toHaveLength(7);
    expect(render([row], true).match(/disabled=""/g)).toHaveLength(7);
  });
  it('rejects whitespace names before starting a batch', () => {
    expect(
      validateCustomerEntryRows([
        {
          label: 'مسافر ۲',
          firstName: ' ',
          lastName: 'نمونه',
          nationalId: '0012345678',
        },
      ]),
    ).toContain('مسافر ۲');
  });
  it('rejects duplicate national IDs even with Persian digits and leading zeroes', () => {
    expect(
      validateCustomerEntryRows([
        { label: 'مشتری اصلی', ...row.values },
        { label: 'مسافر ۱', ...row.values, nationalId: '۰۰۱۲۳۴۵۶۷۸' },
      ]),
    ).toContain('یکسان است');
  });
  it('accepts distinct complete rows', () => {
    expect(
      validateCustomerEntryRows([
        { label: 'مشتری اصلی', ...row.values },
        { label: 'مسافر ۱', ...row.values, nationalId: '0098765432' },
      ]),
    ).toBeNull();
  });
});
