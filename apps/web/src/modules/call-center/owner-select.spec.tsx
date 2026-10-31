import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { OwnerSelect } from './owner-select';
vi.mock('@/i18n/locale-context', () => ({
  useDisplayLanguage: () => 'fa',
  useUiTranslation: () => (text: string) => text,
}));
vi.mock('@/components/ui/search-combobox', () => ({
  SearchCombobox: ({
    options,
  }: {
    options: { value: string; label: ReactNode }[];
  }) => (
    <div>
      {options.map((option) => (
        <span key={option.value}>{option.label}</span>
      ))}
    </div>
  ),
}));
describe('request assignee labels', () => {
  it('shows full name and title for executive options and a truthful missing-title label', () => {
    const html = renderToStaticMarkup(
      <OwnerSelect
        value=""
        required
        operators={[
          {
            id: 'one',
            displayName: 'Full Name',
            position: 'Sales Agent',
            showPosition: true,
          },
          {
            id: 'two',
            displayName: 'Another Name',
            position: null,
            showPosition: true,
          },
        ]}
      />,
    );
    expect(html).toContain('Full Name — Sales Agent');
    expect(html).toContain('Another Name — سمت ثبت نشده');
    expect(html).toContain('انتخاب کارشناس مسئول');
    expect(html).not.toContain('بدون مسئول');
  });
  it('uses names only for ordinary/team options and preserves historical owners', () => {
    const html = renderToStaticMarkup(
      <OwnerSelect
        value="previous"
        operators={[{ id: 'one', displayName: 'Full Name' }]}
      />,
    );
    expect(html).toContain('Full Name');
    expect(html).toContain('مسئول قبلی');
    expect(html).not.toContain('سمت ثبت نشده');
  });
});
