import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
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
import { MasterDataLiveForm } from './master-data-live-form';

function render(resource: 'suppliers' | 'brokers' | 'organizations', mode: 'create' | 'edit' | 'view' = 'create') {
  const record: MasterDataRecord = {
    id: 'partner-test', resource, code: 'PARTNER_TEST', name: 'آزمون',
    version: 2, status: 'active', createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z',
    attributes: { englishName: 'Test Partner', organizationId: 'test-org', personType: 'LEGAL', serviceCodes: 'HOTEL,FLIGHT' },
  };
  return renderToStaticMarkup(createElement(MasterDataLiveForm, {
    definition: getMasterDataDefinition(resource), mode, open: true,
    ...(mode !== 'create' ? { record } : {}),
    onOpenChange: () => undefined, onPersist: async () => undefined,
  }));
}

describe('real partner form fields', () => {
  it.each(['suppliers', 'brokers'] as const)('renders English name, multi-service selection and scoped contact for %s', (resource) => {
    const html = render(resource);
    expect(html).toContain(`id="live-${resource}-englishName"`);
    expect(html).toContain('خدمات قابل ارائه');
    expect(html).toContain('aria-multiselectable="true"');
    expect(html).toContain('تماس اصلی');
    expect(html).toContain('ابتدا سازمان را انتخاب کنید.');
    expect(html).toContain('افزودن سازمان');
    expect(html).toContain('افزودن خدمت');
    expect(html.match(/<form\b/g)).toHaveLength(1);
  });
  it.each(['suppliers', 'brokers'] as const)('keeps saved English name and enables contact popup only after organization selection for %s', (resource) => {
    const html = render(resource, 'edit');
    expect(html).toContain('value="Test Partner"');
    expect(html).toContain('افزودن مخاطب');
    expect(html).not.toContain('ابتدا سازمان را انتخاب کنید.');
    expect(html).toContain('پاک‌کردن خدمات قابل ارائه');
    expect(html).not.toContain('type="tel"');
    expect(html).not.toContain('purchaseLimit');
  });
  it('keeps the identity selector on the shared organization editor', () => {
    const html = render('organizations', 'edit');
    expect(html).toContain('نوع شخصیت');
    expect(html).toContain('id="live-organizations-personType"');
    expect(html).toContain('پاک‌کردن نوع شخصیت');
  });
  it('does not expose editor controls in read-only profiles', () => {
    const html = render('brokers', 'view');
    expect(html).toContain('value="Test Partner"');
    expect(html).not.toContain('افزودن سازمان');
    expect(html).not.toContain('افزودن مخاطب');
    expect(html).not.toContain('افزودن خدمت');
  });
});
