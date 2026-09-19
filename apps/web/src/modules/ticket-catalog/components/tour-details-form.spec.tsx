import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TourDetailsForm } from './tour-details-form';

describe('complete tour definition form', () => {
  it('renders requested sections, ordered steps and themed selectors', () => {
    const html = renderToStaticMarkup(
      <TourDetailsForm
        value={{
          version: 1,
          itinerary: [{ title: 'Alpha' }, { title: 'Beta' }],
          basePrice: { amount: '123.50', currency: 'USD' },
        }}
        onChange={() => {}}
        currencies={[]}
        airlines={[]}
        airports={[]}
        branches={[]}
        branchId=""
      />,
    );
    for (const label of [
      'خلاصه تور',
      'معرفی و توضیحات کلی تور',
      'مدارک لازم تور',
      'شرایط اقساط',
      'قوانین استرداد تور',
      'برنامه سفر',
      'بارگذاری تصویر تور',
      'قیمت پایه پکیج',
      'ساعت شروع',
      'بالاتر',
      'پایین‌تر',
    ])
      expect(html).toContain(label);
    expect(html.indexOf('value="Alpha"')).toBeLessThan(
      html.indexOf('value="Beta"'),
    );
    expect(html).toContain('role="combobox"');
    for (const select of html.match(/<select[^>]*>/g) ?? [])
      expect(select).toContain('aria-hidden="true"');
    expect(html).not.toContain('type="date"');
    expect(html).toContain('123.50');
  });
  it('hides airline and separate flight price for train definitions', () => {
    const html = renderToStaticMarkup(
      <TourDetailsForm
        value={{ version: 1, transport: 'TRAIN' }}
        onChange={() => {}}
        currencies={[]}
        airlines={[]}
        airports={[]}
        branches={[]}
        branchId=""
      />,
    );
    expect(html).not.toContain('aria-label="ایرلاین"');
    expect(html).not.toContain('aria-label="هزینه جداگانه پرواز"');
  });
});
