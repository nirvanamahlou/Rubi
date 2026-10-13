import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AssigneePicker } from './assignee-picker';

describe('Customer Affairs assignee picker', () => {
  it('renders one searchable control with the canonical form field', () => {
    const html = renderToStaticMarkup(
      <AssigneePicker name="customerOwnerUserId" />,
    );
    expect(html.match(/role="combobox"/g)).toHaveLength(1);
    expect(html.match(/<input/g)).toHaveLength(2);
    expect(html).toContain('name="customerOwnerUserId"');
    expect(html).toContain('نام، کد پرسنلی یا واحد کارمند');
    expect(html).not.toContain('بدون کارشناس مشخص / صف واحد');
  });

  it('retains the assigned user ID when editing a record', () => {
    const html = renderToStaticMarkup(
      <AssigneePicker name="assigneeUserId" initial="user-1" />,
    );
    expect(html).toContain('name="assigneeUserId" value="user-1"');
    expect(html).toContain('مسئول انتخاب‌شده فعلی');
  });
});
