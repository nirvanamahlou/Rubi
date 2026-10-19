import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MasterDataStoredContact } from './master-data-stored-contact';

describe('saved partner contacts', () => {
  it.each([false, true])(
    'explains retained or explicitly cleared data, touched=%s',
    (touched) => {
      const html = renderToStaticMarkup(
        createElement(MasterDataStoredContact, {
          label: 'شماره همراه',
          masked: '***0123',
          touched,
          value: '',
          disabled: false,
          onClear: () => undefined,
        }),
      );
      expect(html).toContain('***0123');
      expect(html).toContain(
        touched ? 'پس از ذخیره پاک می‌شود.' : 'بدون تغییر باقی می‌ماند.',
      );
      expect(html).not.toContain('<input');
    },
  );
  it('does not invent a saved value for a new contact', () => {
    expect(
      renderToStaticMarkup(
        createElement(MasterDataStoredContact, {
          label: 'شماره همراه',
          masked: '',
          touched: false,
          value: '',
          disabled: false,
          onClear: () => undefined,
        }),
      ),
    ).toBe('');
  });
});
