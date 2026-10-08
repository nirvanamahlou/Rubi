import { describe, expect, it } from 'vitest';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { jsx } from './jsx-runtime';
import { DisplayLocaleContext } from './locale-context';
import { translateUiText, latinDigits } from './translate';
import { searchOptions } from '@/components/ui/search-combobox';
import { Input, Textarea } from '@/components/ui/form-controls';
import {
  formatCalendarValue,
  calendarMonthName,
} from '@/components/ui/date-picker.utils';

function render(language: 'en' | 'fa', child: ReturnType<typeof jsx>) {
  return renderToStaticMarkup(
    createElement(DisplayLocaleContext.Provider, { value: language }, child),
  );
}

describe('application English rendering', () => {
  it('localizes visible text, accessibility labels and placeholders together', () => {
    const tree = (
      <section>
        <h1>مدیریت کاربران</h1>
        <button aria-label="ذخیره">ذخیره</button>
        <input placeholder="نام کاربری" />
        <span>۱۲٬۳۴۵٫۶۷</span>
      </section>
    );
    const english = render('en', tree);
    expect(english).toContain('User management');
    expect(english).toContain('aria-label="Save"');
    expect(english).toContain('placeholder="Username"');
    expect(english).toContain('12,345.67');
    expect(english).not.toMatch(/[\u0600-\u06ff]/);
    expect(render('fa', tree)).toContain('مدیریت کاربران');
  });

  it('keeps submitted values, names, refs, classes and event handlers intact', () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = () => undefined;
    const props = {
      value: 'تأییدشده',
      name: 'status',
      className: 'button',
      ref,
      onClick,
      children: 'تأیید',
    };
    const tree = jsx('button', props);
    const english = render('en', tree);
    expect(english).toContain('value="تأییدشده"');
    expect(english).toContain('name="status"');
    expect(english).toContain('>Confirm</button>');
    expect(props.ref).toBe(ref);
    expect(props.onClick).toBe(onClick);
    expect(props.children).toBe('تأیید');
  });

  it('leaves editable text and scripts untouched', () => {
    const textarea = jsx('textarea', { defaultValue: 'یادداشت شخصی' });
    expect(render('en', textarea)).toContain('یادداشت شخصی');
    const script = jsx('script', { children: 'const text = "فارسی";' });
    expect(render('en', script)).toContain('const text = "فارسی";');
  });

  it('translates textarea guidance while preserving typed and default content', () => {
    const tree = jsx('textarea', {
      placeholder: 'نام کاربری',
      'aria-label': 'نام کاربری',
      defaultValue: 'یادداشت شخصی',
    });
    const english = render('en', tree);
    expect(english).toContain('placeholder="Username"');
    expect(english).toContain('aria-label="Username"');
    expect(english).toContain('یادداشت شخصی');
    expect(render('fa', tree)).toContain('placeholder="نام کاربری"');
  });

  it('translates real form-control examples without altering input values', () => {
    const tree = (
      <section>
        <Input placeholder="مثلاً 10,000,000" defaultValue="مقدار کاربر" />
        <Textarea placeholder="توضیحات لازم برای اجرای خدمات سفر" />
      </section>
    );
    const english = render('en', tree);
    expect(english).toContain('placeholder="For example, 10,000,000"');
    expect(english).toContain(
      'placeholder="Necessary explanations for the implementation of travel services"',
    );
    expect(english).toContain('value="مقدار کاربر"');
  });

  it('supports English option search without changing option identifiers', () => {
    const options = [
      { value: 'ACTIVE', label: 'فعال' },
      { value: 'INACTIVE', label: 'غیرفعال' },
    ];
    expect(
      searchOptions(options, 'Inactive', 5, 'en').map((item) => item.value),
    ).toEqual(['INACTIVE']);
    expect(options[1]?.label).toBe('غیرفعال');
  });

  it('uses readable English names and Latin digits for either calendar', () => {
    const date = '2026-10-07T13:45';
    for (const calendar of ['gregorian', 'persian'] as const) {
      expect(formatCalendarValue(date, calendar, true, true)).not.toMatch(
        /[\u0600-\u06ff]/,
      );
      expect(calendarMonthName(new Date(date), calendar, true)).not.toMatch(
        /[\u0600-\u06ff]/,
      );
    }
  });

  it('does not guess or truncate unknown record content', () => {
    expect(translateUiText('نام‌ناموجودآزمون', 'en')).toBe('نام‌ناموجودآزمون');
    expect(translateUiText('ABC-123 / $90.50', 'en')).toBe('ABC-123 / $90.50');
    expect(latinDigits('۱۲۳٫۴۵٪')).toBe('123.45%');
  });
});
