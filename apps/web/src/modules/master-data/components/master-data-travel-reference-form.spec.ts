import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) => children,
}));
import { MasterDataTravelReferenceForm } from './master-data-travel-reference-form';

function render(
  resource: 'transfer-types' | 'visa-services',
  attributes: MasterDataRecord['attributes'] = {},
  editing = true,
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
      ...(editing ? { record } : {}),
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}
describe('travel reference form fields', () => {
  it.each([
    ['create', false],
    ['edit', true],
  ] as const)(
    'hides minimum capacity in the transfer %s form while retaining the maximum',
    (_, editing) => {
      const html = render(
        'transfer-types',
        {
          vehicleType: 'ون',
          serviceMode: 'PRIVATE',
          suggestedCapacityMin: 4,
          suggestedCapacity: 8,
        },
        editing,
      );
      for (const label of [
        'کد',
        'عنوان فارسی',
        'وسیله',
        'شیوه سرویس',
        'حداکثر ظرفیت پیشنهادی',
        'شرح',
        'استفاده',
        'وضعیت',
      ])
        expect(html).toContain(label);
      expect(html).not.toContain('حداقل ظرفیت پیشنهادی');
      expect(html).not.toContain('transfer-types-suggestedCapacityMin');
      expect(html).toMatch(/id="transfer-types-code"[^>]*readOnly=""/i);
      expect(html).toMatch(/id="transfer-usage"[^>]*readOnly=""/i);
      expect(html).toContain('در انتظار اتصال رزرو');
    },
  );
  it.each([
    ['create', false],
    ['edit', true],
  ] as const)(
    'hides validity mode in the visa %s form while retaining fixed days',
    (_, editing) => {
      const html = render(
        'visa-services',
        { referenceValidityMode: 'DAYS', referenceValidityDays: 90 },
        editing,
      );
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
      if (editing) expect(html).toContain('value="90"');
      expect(html).toContain('id="visa-services-guidanceFileReference-help"');
      expect(html).toContain(
        'aria-describedby="visa-services-guidanceFileReference-help"',
      );
      expect(html).not.toContain('type="file"');
      expect(html).not.toContain('passportNumber');
      expect(html).not.toContain('نوع اعتبار مرجع');
      expect(html).not.toContain('visa-services-referenceValidityMode');
    },
  );
  it('keeps fixed days hidden for a legacy passport-expiry record', () => {
    const html = render('visa-services', {
      referenceValidityMode: 'PASSPORT_EXPIRY',
      referenceValidityDays: null,
    });
    expect(html).not.toContain('id="visa-services-referenceValidityDays"');
    expect(html).toContain('aria-label="پاک‌کردن وضعیت"');
  });
});
