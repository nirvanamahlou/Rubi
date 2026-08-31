import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) => children,
}));
import { MasterDataLiveForm } from './master-data-live-form';
import { getMasterDataDefinition } from '../model/catalog';
const record: MasterDataRecord = {
  id: 'meal-test',
  resource: 'meal-services',
  code: 'BB',
  name: 'اتاق و صبحانه',
  status: 'inactive',
  version: 2,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:00Z',
  attributes: {
    englishName: 'Bed & Breakfast',
    category: 'MEAL_PLAN',
    includedMealsJson: '["صبحانه","وعده قدیمی"]',
    isUnderReview: true,
    hotelCount: 7,
  },
};
function render(mode: 'create' | 'edit' | 'view') {
  return renderToStaticMarkup(
    createElement(MasterDataLiveForm, {
      definition: getMasterDataDefinition('meal-services'),
      open: true,
      mode,
      ...(mode !== 'create' ? { record } : {}),
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}
describe('meal/service popup through the shared form entry point', () => {
  it('renders every requested field and standard-code suggestions', () => {
    const html = render('edit');
    for (const label of [
      'کد سرویس',
      'عنوان فارسی',
      'عنوان انگلیسی',
      'دسته',
      'وعده‌های شامل‌شده',
      'تعداد هتل مرتبط',
      'وضعیت',
    ])
      expect(html).toContain(label);
    for (const code of ['RO', 'BB', 'HB', 'FB', 'ALL', 'UALL', 'BRN'])
      expect(html).toContain(`value="${code}"`);
  });
  it('renders native accessible multiple checkboxes and preserves selected legacy values', () => {
    const html = render('edit');
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(10);
    expect((html.match(/checked=""/g) ?? []).length).toBe(2);
    expect(html).toContain('وعده قدیمی');
  });
  it('provides clearing for category, lifecycle and all selected meals', () => {
    const html = render('edit');
    for (const label of ['دسته', 'وضعیت', 'وعده‌های شامل‌شده'])
      expect(html).toContain(`aria-label="پاک‌کردن ${label}"`);
  });
  it('makes real related-hotel count read-only', () => {
    expect(render('edit')).toMatch(
      /id="meal-hotelCount"[^>]*readOnly=""[^>]*value="۷"/i,
    );
    expect(render('create')).toContain('پس از ثبت محاسبه می‌شود');
  });
  it('disables all profile mutations and clearing in view mode', () => {
    const html = render('view');
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain('aria-label="پاک‌کردن');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
  });
});
