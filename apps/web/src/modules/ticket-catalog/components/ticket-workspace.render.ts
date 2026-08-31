import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogState, TicketWorkspace } from './ticket-workspace';
import { TicketForm } from './ticket-form';
import { emptyInput, previewSamples } from '../model/preview';

describe('Rendered ticket UI', () => {
  it('starts without synthetic products and exposes no operational save', () => {
    const html = renderToStaticMarkup(createElement(TicketWorkspace));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('فهرست عملیاتی هنوز در دسترس نیست');
    expect(html).toContain('شروع پیش‌نمایش مستقل');
    expect(html).not.toContain('DEMO-1');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>خروجی فهرست/);
    expect(html).not.toContain('ثبت موفق');
  });
  it('renders segmented real form, missing references and no Hold editor', () => {
    const html = renderToStaticMarkup(
      createElement(TicketForm, {
        initial: emptyInput(),
        references: [],
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toContain('ظرفیت متعلق به شرکت است');
    expect(html).toContain('منتظر API اطلاعات پایه');
    expect(html).toContain('اعمال فقط در پیش‌نمایش');
    expect(html).toContain('ذخیره واقعی — منتظر API و مجوز');
    expect(html).not.toMatch(/name="(held|confirmed)"/);
    expect(html).not.toContain('type="datetime-local"');
    expect(html).not.toContain('id="ticket-sale"');
    expect(html).toContain('قیمت فروش داینامیک است');
    expect(html).toContain('کشور مبدأ');
    expect(html).toContain('شهر مقصد');
    expect(html).toContain('انتخاب و جست‌وجوی ایرلاین');
  });
  it('renders view mode disabled without a submit operation', () => {
    const initial = previewSamples('2026-08-31T00:00:00.000Z')[0]!.definition;
    const html = renderToStaticMarkup(
      createElement(TicketForm, {
        initial,
        references: [],
        onSave: () => {},
        onCancel: () => {},
        readOnly: true,
      }),
    );
    expect(html).toContain('<fieldset disabled');
    expect(html).not.toContain('type="submit"');
  });
  it.each([
    'loading',
    'empty',
    'error',
    'unauthorized',
    'forbidden',
    'conflict',
    'success',
  ] as const)('renders an explicit %s state', (state) => {
    const html = renderToStaticMarkup(createElement(CatalogState, { state }));
    expect(html).toMatch(/role="(status|alert)"/);
    if (state === 'success') expect(html).toContain('ذخیره واقعی انجام نشده');
  });
});
