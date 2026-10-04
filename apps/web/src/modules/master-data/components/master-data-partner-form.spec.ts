import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

// SSR exercises the real fields; only browser-mounted dialog portals are replaced.
vi.mock('@/components/ui/overlays', () => {
  const contents = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: contents,
    DialogContent: contents,
    DialogTitle: contents,
    DialogDescription: contents,
    DialogClose: contents,
  };
});
import { getMasterDataDefinition } from '../model/catalog';
import {
  MasterDataLiveForm,
  partnerPersistValues,
} from './master-data-live-form';

function render(
  resource: 'suppliers' | 'brokers' | 'organizations' | 'insurers',
  mode: 'create' | 'edit' | 'view' = 'create',
  lockedFields: readonly string[] = [],
) {
  const record: MasterDataRecord = {
    id: 'partner-test',
    resource,
    code: 'PARTNER_TEST',
    name: 'آزمون',
    version: 2,
    status: 'active',
    createdAt: '2026-08-31T00:00:00Z',
    updatedAt: '2026-08-31T00:00:00Z',
    attributes: {
      englishName: 'Test Partner',
      organizationId: 'test-org',
      personType: 'LEGAL',
      serviceCodes: 'HOTEL,FLIGHT',
      primaryContactId: 'test-contact',
    },
  };
  return renderToStaticMarkup(
    createElement(MasterDataLiveForm, {
      definition: getMasterDataDefinition(resource),
      mode,
      open: true,
      lockedFields,
      ...(mode !== 'create' ? { record } : {}),
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}

describe('real partner form fields', () => {
  it('removes insurer organization controls while retaining legacy profile context', () => {
    expect(render('insurers')).not.toContain(
      'id="live-insurers-organizationId"',
    );
    expect(render('insurers', 'edit')).not.toContain(
      'id="live-insurers-organizationId"',
    );
    expect(render('insurers', 'view')).toContain('سازمان بیمه‌گر');
  });

  it.each(['suppliers', 'brokers'] as const)(
    'renders partner identity, multi-service selection and scoped contact for %s',
    (resource) => {
      const html = render(resource);
      if (resource === 'suppliers') {
        expect(html).toContain('id="live-suppliers-name"');
        expect(html).not.toContain('id="live-suppliers-englishName"');
        expect(html).not.toContain('id="live-suppliers-countryId"');
        expect(html).not.toContain('id="live-suppliers-cityId"');
      } else {
        expect(html).toContain('id="live-brokers-englishName"');
        expect(html).toContain('Board');
        expect(html).toContain('شهرهای فعالیت');
        expect(html).toContain('افزودن تورلیدر');
        expect(html).not.toContain('خدمات قابل ارائه');
        expect(html).not.toContain('سازمان کارگزار');
        expect(html.match(/<form\b/g)).toHaveLength(1);
        return;
      }
      expect(html).toContain('خدمات قابل ارائه');
      expect(html).toContain('aria-multiselectable="true"');
      if (resource === 'suppliers') {
        expect(html).not.toContain('سازمان تأمین‌کننده');
        expect(html).toContain('تماس اصلی');
        expect(html).not.toContain('ثبت سازمان جدید');
        expect(html).toContain('افزودن خدمت');
      } else {
        expect(html).not.toContain('تماس اصلی');
        expect(html).not.toContain('ابتدا سازمان را انتخاب کنید.');
        expect(html).not.toContain('id="live-brokers-organizationId"');
        expect(html).not.toContain('افزودن خدمت');
      }
      expect(html).toContain(`id="live-${resource}-serviceCodes"`);
      expect(html.match(/<form\b/g)).toHaveLength(1);
    },
  );
  it.each(['suppliers', 'brokers'] as const)(
    'keeps saved English name and enables contact popup only after organization selection for %s',
    (resource) => {
      const html = render(resource, 'edit');
      if (resource === 'suppliers') {
        expect(html).not.toContain('value="Test Partner"');
        expect(html).not.toContain('افزودن مخاطب');
      } else {
        expect(html).toContain('value="Test Partner"');
        expect(html).not.toContain('id="live-brokers-primaryContactId"');
        expect(html).not.toContain('ابتدا سازمان را انتخاب کنید.');
        expect(html).toContain('شماره کارگزار');
        return;
      }
      expect(html).toContain('پاک‌کردن خدمات قابل ارائه');
      expect(html).not.toContain('type="tel"');
      expect(html).not.toContain('purchaseLimit');
    },
  );
  it('keeps the identity selector on the shared organization editor', () => {
    const html = render('organizations', 'edit');
    expect(html).toContain('نوع شخصیت');
    expect(html).toContain('id="live-organizations-personType"');
    expect(html).toContain('پاک‌کردن نوع شخصیت');
  });
  it('shows primary contact only for a legacy organization-linked broker edit', () => {
    expect(render('brokers', 'edit')).toContain(
      'id="live-brokers-primaryContactId"',
    );
    const independent = renderToStaticMarkup(
      createElement(MasterDataLiveForm, {
        definition: getMasterDataDefinition('brokers'),
        mode: 'edit',
        open: true,
        record: {
          id: 'independent',
          resource: 'brokers',
          code: 'BROKER_INDEPENDENT',
          name: 'مستقل',
          version: 1,
          status: 'active',
          createdAt: '2026-10-04T00:00:00Z',
          updatedAt: '2026-10-04T00:00:00Z',
          attributes: { primaryContactId: 'stale-contact' },
        },
        onOpenChange: () => undefined,
        onPersist: async () => undefined,
      }),
    );
    expect(independent).not.toContain('id="live-brokers-primaryContactId"');
  });

  it('omits hidden organization context and disallowed new contact values from mutations', () => {
    const legacyRecord = {
      id: 'legacy',
      resource: 'brokers' as const,
      code: 'BROKER_LEGACY',
      name: 'قدیمی',
      version: 1,
      status: 'active' as const,
      createdAt: '2026-10-04T00:00:00Z',
      updatedAt: '2026-10-04T00:00:00Z',
      attributes: { organizationId: 'legacy-org' },
    };
    expect(
      partnerPersistValues('brokers', 'edit', legacyRecord, {
        name: 'قدیمی',
        organizationId: 'legacy-org',
        primaryContactId: 'contact',
      }),
    ).toEqual({ name: 'قدیمی', primaryContactId: 'contact' });
    expect(
      partnerPersistValues('brokers', 'create', undefined, {
        name: 'جدید',
        organizationId: 'stale-org',
        primaryContactId: 'stale-contact',
      }),
    ).toEqual({ name: 'جدید' });
    expect(
      partnerPersistValues('insurers', 'edit', legacyRecord, {
        name: 'بیمه',
        organizationId: 'legacy-org',
      }),
    ).toEqual({ name: 'بیمه' });
  });
  it.each(['suppliers', 'brokers'] as const)(
    'does not expose editor controls in read-only %s profiles',
    (resource) => {
      const html = render(resource, 'view');
      expect(html).toContain('آزمون');
      expect(html).toContain('<dl');
      expect(html).not.toContain('<input');
      expect(html).not.toContain('افزودن سازمان');
      expect(html).not.toContain('افزودن مخاطب');
      expect(html).not.toContain('افزودن خدمت');
    },
  );
  it('does not expose supplier service creation when the field is locked', () => {
    const html = render('suppliers', 'create', ['serviceCodes']);
    expect(html).not.toContain('افزودن خدمت');
  });
});
