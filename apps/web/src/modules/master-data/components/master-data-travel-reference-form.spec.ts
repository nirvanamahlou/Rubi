import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) => children,
}));
import { MasterDataTravelReferenceForm } from './master-data-travel-reference-form';

function render(
  resource: 'transfer-types' | 'visa-services',
  attributes: MasterDataRecord['attributes'] = {},
) {
  const record: MasterDataRecord = {
    id: 'test-record',
    resource,
    code: 'TEST_REFERENCE',
    name: 'عنوان آزمون',
    status: 'inactive',
    version: 2,
    createdAt: '2026-08-31T00:00:00Z',
    updatedAt: '2026-08-31T00:00:00Z',
    attributes,
  };
  return renderToStaticMarkup(
    createElement(MasterDataTravelReferenceForm, {
      resource,
      record,
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}
describe('travel reference form fields', () => {
  it('renders every transfer field with status and readonly code/usage', () => {
    const html = render('transfer-types', {
      vehicleType: 'ون',
      serviceMode: 'PRIVATE',
      suggestedCapacityMin: 4,
      suggestedCapacity: 8,
    });
    for (const label of [
      'کد',
      'عنوان فارسی',
      'وسیله',
      'شیوه سرویس',
      'حداقل ظرفیت پیشنهادی',
      'حداکثر ظرفیت پیشنهادی',
      'شرح',
      'استفاده',
      'وضعیت',
    ])
      expect(html).toContain(label);
    expect(html).toMatch(/id="transfer-types-code"[^>]*readOnly=""/i);
    expect(html).toMatch(/id="transfer-usage"[^>]*readOnly=""/i);
    expect(html).toContain('در انتظار اتصال رزرو');
  });
  it('renders every visa field and meaningful guide-reference labeling', () => {
    const html = render('visa-services', { referenceValidityDays: 90 });
    for (const label of [
      'کد',
      'عنوان فارسی',
      'کشور مقصد',
      'نوع ویزا',
      'مدت اعتبار مرجع',
      'مدارک راهنما',
      'وضعیت',
    ])
      expect(html).toContain(label);
    expect(html).toContain('visa-services-referenceValidityDays');
    expect(html).toContain('value="90"');
    expect(html).toContain('id="visa-services-guidanceFileReference-help"');
    expect(html).toContain(
      'aria-describedby="visa-services-guidanceFileReference-help"',
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('passportNumber');
  });
  it('hides fixed days for passport-expiry policy and preserves clear controls', () => {
    const html = render('visa-services', {
      referenceValidityMode: 'PASSPORT_EXPIRY',
      referenceValidityDays: null,
    });
    expect(html).not.toContain('id="visa-services-referenceValidityDays"');
    expect(html).toContain('aria-label="پاک‌کردن نوع اعتبار مرجع"');
    expect(html).toContain('aria-label="پاک‌کردن وضعیت"');
  });
});
