import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

// Render the real form controls without the portal, which mounts only in a browser.
vi.mock('./master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) => children,
}));
import { MasterDataTourTypeForm } from './master-data-tour-type-form';

const record: MasterDataRecord = {
  id: 'tour-test',
  resource: 'tour-types',
  code: 'TOUR_TEST',
  name: 'تور آزمون',
  status: 'inactive',
  version: 3,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T01:00:00Z',
  attributes: {
    englishName: 'Test Tour',
    scope: 'BOTH',
    description: 'شرح آزمون',
    displayOrder: 4,
    updatedByUserId: 'test-user',
    usageCount: null,
    usageStatus: 'UNAVAILABLE',
  },
};
function render(existing?: MasterDataRecord) {
  return renderToStaticMarkup(
    createElement(MasterDataTourTypeForm, {
      ...(existing ? { record: existing } : {}),
      actorNames: { 'test-user': 'کاربر آزمون' },
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}
describe('tour type form fields', () => {
  it('renders every mockup field and the existing order field', () => {
    const html = render(record);
    for (const label of [
      'کد',
      'عنوان فارسی',
      'عنوان انگلیسی',
      'دامنه',
      'شرح',
      'استفاده',
      'آخرین تغییر',
      'وضعیت',
      'ترتیب نمایش',
    ])
      expect(html).toContain(label);
    expect(html).toContain('TOUR_TEST');
    expect(html).toContain('Test Tour');
    expect(html).toContain('شرح آزمون');
    expect(html).toContain('کاربر آزمون');
  });
  it('makes code, usage and audit metadata read-only, not editable fields', () => {
    const html = render(record);
    for (const id of ['tour-code', 'tour-usage', 'tour-updated']) {
      expect(html).toMatch(
        new RegExp(`<(?:input|textarea)[^>]*id="${id}"[^>]*readOnly=""`, 'i'),
      );
    }
    expect(html).toContain('در انتظار اتصال محصولات');
    expect(html).not.toContain('۲۸ محصول');
  });
  it('supports clearing scope and status with distinct accessible buttons', () => {
    const html = render(record);
    expect(html).toContain('aria-label="پاک‌کردن دامنه"');
    expect(html).toContain('aria-label="پاک‌کردن وضعیت"');
    expect(html).toMatch(
      /<textarea[^>]*id="tour-description"[^>]*maxLength="1000"/i,
    );
  });
  it('explains automatic metadata before creation without inventing a code or date', () => {
    const html = render();
    expect(html).toContain('پس از ثبت، خودکار تولید می‌شود');
    expect(html).toContain('پس از ثبت، خودکار درج می‌شود');
    expect(html).not.toContain('TOUR_TEST');
  });
});
