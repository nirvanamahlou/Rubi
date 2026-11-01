import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { GhestirooSetupForm } from './components/ghestiroo-connection';
import { SystemDetail } from './components/integrations-workspace';
import { isGhestirooSystem } from './system-connector';

const system: IntegrationSystemConfigV1 = {
  id: 'system',
  brandId: 'brand',
  code: 'ghesti-roo-primary',
  name: 'قسطی روو',
  kind: 'وب‌سایت',
  businessDomain: 'TRAVEL',
  lifecycle: 'ENABLED',
  capabilityCodes: [],
};
const registry: IntegrationRegistryV1 = {
  contract: 'integrations.registry.v1',
  schemaVersion: 1,
  branchId: 'branch',
  version: 1,
  brands: [
    { id: 'brand', code: 'ghesti-roo', name: 'قسطی روو', lifecycle: 'ENABLED' },
  ],
  systems: [system],
  capabilities: [],
  initialized: true,
  canManage: true,
  connectionState: 'NOT_CONFIGURED',
  counts: { brands: 1, systems: 1, awaitingConnection: 1 },
  lastChange: null,
};
const status = {
  configured: false,
  storageReady: false,
  canManage: true,
  version: 0,
};
const props = {
  status,
  busy: false,
  bundle: '{"contract":"ghestiroo.nora.v1"}',
  users: 'user',
  userId: 'user',
  onBundleChange: () => {},
  onUsersChange: () => {},
  onSubmit: () => {},
};

describe('Ghestiroo connection setup', () => {
  it('opens the Ghestiroo form from its own system card instead of the Niyayesh adapter', () => {
    const html = renderToStaticMarkup(
      <SystemDetail
        branchId="branch"
        userId="user"
        system={system}
        data={registry}
        allowedSections={['connections', 'settings']}
        onBack={() => {}}
        onEdit={() => {}}
        onSetup={() => {}}
      />,
    );
    expect(html).toContain('اتصال قسطی‌رو به نورا');
    expect(html).not.toContain('داده‌های نیایش سیر');
    expect(html).not.toContain(
      'مشخصات و دسترسی واقعی سامانه در مرحله بعد اضافه می‌شود.',
    );
  });
  it('keeps both draft fields editable without permitting persistence before server setup', () => {
    const html = renderToStaticMarkup(<GhestirooSetupForm {...props} />);
    const textareas = html.match(/<textarea\b[^>]*>/g) ?? [];
    expect(textareas).toHaveLength(2);
    expect(textareas.every((tag) => !tag.includes('disabled'))).toBe(true);
    expect(html.match(/<button\b[^>]*>/)?.[0]).toContain(' disabled=""');
    const ready = renderToStaticMarkup(
      <GhestirooSetupForm
        {...props}
        status={{ ...status, storageReady: true }}
      />,
    );
    expect(ready.match(/<button\b[^>]*>/)?.[0]).not.toContain(' disabled=""');
  });
  it('explains read-only account access without exposing a save action', () => {
    const html = renderToStaticMarkup(
      <GhestirooSetupForm
        {...props}
        status={{ ...status, canManage: false }}
      />,
    );
    expect(html).toContain('دسترسی تنظیم اتصال ندارید');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<textarea');
  });
  it('routes by stable identity or exact host and does not misroute renamed or deceptive sites', () => {
    expect(isGhestirooSystem({ ...system, name: 'نام جدید' }, registry)).toBe(
      true,
    );
    const unrelated = { ...system, brandId: 'other', code: 'site-other' };
    expect(isGhestirooSystem(unrelated, registry)).toBe(false);
    const setup = {
      environment: 'PRODUCTION' as const,
      protocol: 'REST' as const,
      authentication: 'API_KEY' as const,
    };
    expect(
      isGhestirooSystem(
        {
          ...unrelated,
          setup: { ...setup, websiteUrl: 'https://ghestiroo.ir/' },
        },
        registry,
      ),
    ).toBe(true);
    expect(
      isGhestirooSystem(
        {
          ...unrelated,
          setup: { ...setup, websiteUrl: 'https://ghestiroo.ir.evil.example/' },
        },
        registry,
      ),
    ).toBe(false);
    expect(
      isGhestirooSystem(
        { ...unrelated, setup: { ...setup, websiteUrl: 'invalid' } },
        registry,
      ),
    ).toBe(false);
  });
});
