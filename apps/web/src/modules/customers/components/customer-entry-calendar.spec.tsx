import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CustomerEntrySheet,
  type CustomerEntryRow,
} from './customer-entry-sheet';
import { CustomerDateField } from './customer-date-field';

const row: CustomerEntryRow = {
  key: 'one',
  label: 'مسافر اول',
  role: 'مسافر',
  values: {
    firstName: '',
    lastName: '',
    nationalId: '',
    birthDate: '2000-03-20',
    passportNumber: '',
    passportExpiryDate: '2030-03-20',
    phone: '',
    email: '',
  },
  onChange: vi.fn(),
};

describe('Direct table calendar', () => {
  it('places independently labelled birthday and expiry triggers in their cells without a modal', () => {
    const html = renderToStaticMarkup(
      <CustomerEntrySheet
        rows={[row]}
        showPassportExpiry
        calendarMode="gregorian"
        onCalendarModeChange={vi.fn()}
      />,
    );
    expect(html).toContain('id="one-birth-date"');
    expect(html).toContain('id="one-passport-expiry"');
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(html).not.toContain('aria-modal="true"');
    expect(html).not.toContain('تاریخ را از تقویم');
    expect(html).not.toContain('نوع تقویم Customers');
    expect(html).toContain('2000');
    expect(html).toContain('2030');
  });
  it('uses a non-modal top-layer calendar with switching inside the opened field', () => {
    const html = renderToStaticMarkup(
      <CustomerDateField
        compact
        initialOpen
        id="date"
        label="تاریخ تولد"
        mode="persian"
        onModeChange={vi.fn()}
        onChange={vi.fn()}
        value=""
      />,
    );
    expect(html).toContain('popover="manual"');
    expect(html).toContain('aria-modal="false"');
    expect(html).toContain('aria-controls="date-calendar"');
    expect(html).toContain('نوع تقویم Customers');
    expect(html).toContain('overflow-y-auto');
  });
  it('cannot expose a calendar while a row is disabled, including initially open fields', () => {
    const html = renderToStaticMarkup(
      <CustomerDateField
        compact
        initialOpen
        disabled
        id="date"
        label="تاریخ تولد"
        mode="persian"
        onModeChange={vi.fn()}
        onChange={vi.fn()}
        value=""
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });
});
