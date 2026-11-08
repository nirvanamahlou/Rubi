import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import {
  InsuranceInputGuide,
  InsurancePassengerFields,
} from './passenger-fields';
const passenger = {
  version: 1,
  firstName: 'Test',
  lastName: 'Passenger',
  firstNameLatin: 'TEST',
  lastNameLatin: 'PASSENGER',
  nationalityCode: 'IRN',
  nationalCode: '',
  passportNo: '',
  birthDate: '',
  gender: 'M' as const,
  mobile: '',
  email: '',
};
it('shows documented identity/contact/travel instructions and the official source', () => {
  const html = renderToStaticMarkup(createElement(InsuranceInputGuide));
  expect(html).toContain('sandboxapi.travis.ir/swagger/index.html');
  expect(html).toContain('09123456789');
  expect(html).toContain('۱۰ رقم');
  expect(html).toContain('روز رفت و برگشت');
});
it('requires Iranian identity, permits foreign national code omission, and converts Persian contact digits', () => {
  const onChange = vi.fn();
  const editor = InsurancePassengerFields({
    value: passenger,
    onChange,
    disabled: false,
  });
  const fields = editor.props.children[1].props.children[0];
  const national = fields.find(
    (field: { key: string }) => field.key === 'nationalCode',
  ).props.children[1];
  expect(national.props.required).toBe(true);
  const mobile = fields.find((field: { key: string }) => field.key === 'mobile')
    .props.children[1];
  mobile.props.onChange({ target: { value: '۰۹۱۲۳۴۵۶۷۸۹' } });
  expect(onChange).toHaveBeenCalledWith({
    ...passenger,
    mobile: '09123456789',
  });
  const foreign = renderToStaticMarkup(
    createElement(InsurancePassengerFields, {
      value: { ...passenger, nationalityCode: 'TUR' },
      onChange,
      disabled: false,
    }),
  );
  expect(foreign).toContain('TUR');
});
