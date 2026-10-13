import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { jsx } from '@/i18n/jsx-runtime';
import { accountingOperationLabel } from './accounting-operation-label';

describe('Accounting operation captions through app localization', () => {
  it('keeps source operation identity in Persian and localized JSX wrappers', () => {
    const captions = [
      'جدید',
      'ذخیره',
      'ذخیره و جدید',
      'ذخیره و بستن',
      'حذف و بستن',
      'حذف و جدید',
      'بارگذاری مجدد',
      'خروجی اکسل',
      'خروجی پی دی اف',
    ];
    for (const caption of captions) {
      const element = jsx('button', { children: caption });
      expect(
        accountingOperationLabel(
          (element.props as { children: ReactNode }).children,
        ),
      ).toBe(caption);
    }
  });
  it('reads mixed wrapped captions but does not treat arbitrary UI elements as actions', () => {
    const element = jsx('button', { children: ['ذخیره', ' و جدید'] });
    expect(
      accountingOperationLabel(
        (element.props as { children: ReactNode }).children,
      ),
    ).toBe('ذخیره و جدید');
    expect(accountingOperationLabel(jsx('span', { children: 'ذخیره' }))).toBe(
      '',
    );
  });
});
