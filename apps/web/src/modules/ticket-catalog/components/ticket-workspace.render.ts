import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketWorkspace } from './ticket-workspace';
import { TicketForm } from './ticket-form';
import { emptyInput, previewSamples } from '../model/preview';

describe('Rendered ticket UI', () => {
  it('exposes direct ticket management without preview controls', () => {
    const html = renderToStaticMarkup(createElement(TicketWorkspace));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('تعریف بلیت جدید');
    expect(html).toContain('افزودن نمونه‌ها');
    expect(html).toContain('هواپیما • قطار • اتوبوس');
    expect(html).not.toContain('شروع پیش‌نمایش');
    expect(html).not.toContain('حالت شبیه‌سازی');
  });
  it('renders flight fields and browser-backed save without Hold editor', () => {
    const html = renderToStaticMarkup(
      createElement(TicketForm, {
        initial: emptyInput(),
        references: [],
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toContain('نوع وسیله سفر');
    expect(html).toContain('ظرفیت متعلق به شرکت است');
    expect(html).toContain('انتخاب و جست‌وجوی نوع هواپیما');
    expect(html).toContain('فرودگاه مبدأ');
    expect(html).toContain('ابتدا شهر را انتخاب کنید');
    expect(html).toContain('ذخیره بلیت');
    expect(html).not.toContain('پیش‌نمایش');
    expect(html).not.toMatch(/name="(held|confirmed)"/);
    expect(html).not.toContain('type="datetime-local"');
    expect(html).not.toContain('id="ticket-sale"');
    expect(html).toContain('قیمت فروش هنگام فروش تعیین می‌شود');
    expect(html).toContain('کشور مبدأ');
    expect(html).toContain('شهر مقصد');
    expect(html).toContain('انتخاب و جست‌وجوی ایرلاین');
  });
  it('renders train and bus fields from the same ticket form', () => {
    const train = renderToStaticMarkup(
      createElement(TicketForm, {
        initial: emptyInput('train'),
        references: [],
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    const bus = renderToStaticMarkup(
      createElement(TicketForm, {
        initial: emptyInput('bus'),
        references: [],
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(train).toContain('انتخاب و جست‌وجوی شرکت ریلی');
    expect(train).toContain('ایستگاه مبدأ');
    expect(bus).toContain('انتخاب و جست‌وجوی شرکت اتوبوس‌رانی');
    expect(bus).toContain('پایانه مقصد');
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
});
