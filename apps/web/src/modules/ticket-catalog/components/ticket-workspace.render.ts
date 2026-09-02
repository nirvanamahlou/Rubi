import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketWorkspace } from './ticket-workspace';
import { TicketForm } from './ticket-form';
import { TicketCatalogCard } from './ticket-catalog-card';
import { IssuedTicketsWorkspace } from './issued-tickets-workspace';
import { emptyInput, previewSamples } from '../model/preview';

describe('Rendered ticket UI', () => {
  it('exposes direct ticket management without preview controls', () => {
    const html = renderToStaticMarkup(createElement(TicketWorkspace));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('تعریف بلیت جدید');
    expect(html).not.toContain('افزودن نمونه‌ها');
    expect(html).toContain('هواپیما • قطار • اتوبوس');
    expect(html).toContain('تعریف بلیت قابل فروش');
    expect(html).toContain('مسیر، برنامه حرکت و ظرفیت');
    expect(html).toContain('بلیت‌های صادرشده مسافران');
    expect(html).toContain('گزارش صدور، PNR و قرارداد');
    expect(html).not.toContain('شروع پیش‌نمایش');
    expect(html).not.toContain('حالت شبیه‌سازی');
  });
  it('renders route filters, icon-only sale controls and issued filters', () => {
    const sample = previewSamples('2026-08-31T00:00:00.000Z')[0]!;
    const card = renderToStaticMarkup(
      createElement(TicketCatalogCard, {
        product: { ...sample, status: 'active' },
        referenceLabel: (_kind: string, _id: string, fallback: string) =>
          fallback,
        onView: () => {},
        onEdit: () => {},
        onRepeat: () => {},
        onDelete: () => {},
        onStatus: () => {},
      }),
    );
    const pausedCard = renderToStaticMarkup(
      createElement(TicketCatalogCard, {
        product: { ...sample, status: 'paused' },
        referenceLabel: (_kind: string, _id: string, fallback: string) =>
          fallback,
        onView: () => {},
        onEdit: () => {},
        onRepeat: () => {},
        onDelete: () => {},
        onStatus: () => {},
      }),
    );
    const draftCard = renderToStaticMarkup(
      createElement(TicketCatalogCard, {
        product: { ...sample, status: 'draft' },
        referenceLabel: (_kind: string, _id: string, fallback: string) =>
          fallback,
        onView: () => {},
        onEdit: () => {},
        onRepeat: () => {},
        onDelete: () => {},
        onStatus: () => {},
      }),
    );
    const cancelledCard = renderToStaticMarkup(
      createElement(TicketCatalogCard, {
        product: { ...sample, status: 'cancelled' },
        referenceLabel: (_kind: string, _id: string, fallback: string) =>
          fallback,
        onView: () => {},
        onEdit: () => {},
        onRepeat: () => {},
        onDelete: () => {},
        onStatus: () => {},
      }),
    );
    const issued = renderToStaticMarkup(
      createElement(IssuedTicketsWorkspace, {
        connected: false,
        tickets: [],
      }),
    );
    expect(card).toContain('aria-label="توقف فروش بلیت"');
    expect(card).not.toContain('disabled=""');
    expect(pausedCard).toContain('aria-label="فعال‌کردن دوباره فروش بلیت"');
    expect(pausedCard).not.toContain('disabled=""');
    expect(draftCard).toContain('aria-label="فعال‌کردن دوباره فروش بلیت"');
    expect(draftCard).not.toContain('disabled=""');
    expect(card).not.toContain('</svg>توقف فروش');
    expect(pausedCard).not.toContain('</svg>فعال‌کردن فروش');
    expect(cancelledCard).toContain('ویرایش');
    expect(cancelledCard).toContain('aria-label="فروش این بلیت متوقف است"');
    expect(cancelledCard).toContain('disabled=""');
    expect(issued).toContain('شماره قرارداد');
    expect(issued).toContain('شماره بلیت یا PNR');
    expect(issued).toContain('مبدأ');
    expect(issued).toContain('مقصد');
    expect(issued).toContain('در انتظار اتصال قرارداد عمومی رزرواسیون');
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
    expect(html).not.toContain('تاریخ و ساعت حرکت');
    expect(html).not.toContain('شروع اعتبار نرخ');
    expect(html).not.toContain('پایان اعتبار نرخ');
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
