import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IntegrationRegistryV1 } from '@nora/contracts';
import { matchesNativeSite } from './site-connections-model';
import {
  SiteConnectionsWorkspace,
  SelectedSiteConnection,
} from './components/site-connections-workspace';
import { GhestirooConnection } from './components/ghestiroo-connection';
import { NiyayeshData } from './components/niyayesh-data';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://nora.example/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
const ids = ['jahan', 'niyayesh', 'ghestiroo', 'academy'];
const registry = {
  contract: 'integrations.registry.v1',
  schemaVersion: 1,
  branchId: 'branch',
  version: 1,
  brands: ids.map((id) => ({
    id,
    code: id === 'ghestiroo' ? 'ghesti-roo' : id,
    name: id,
    lifecycle: 'ENABLED',
  })),
  systems: ids.map((id) => ({
    id,
    brandId: id,
    code: id === 'ghestiroo' ? 'ghesti-roo-primary' : id,
    name: id,
    kind: 'Website',
    businessDomain: id === 'academy' ? 'EDUCATION' : 'TRAVEL',
    lifecycle: 'ENABLED',
    capabilityCodes: [],
  })),
  capabilities: [],
  initialized: true,
  canManage: true,
  connectionState: 'NOT_CONFIGURED',
  counts: { brands: 4, systems: 4, awaitingConnection: 3 },
  lastChange: null,
} as IntegrationRegistryV1;

describe('Selected-site Connections presentation', () => {
  it('offers all four sites in one top selector and only one active panel', () => {
    const html = renderToStaticMarkup(
      <SiteConnectionsWorkspace registry={registry} userId="user" />,
    );
    expect(html).toContain('aria-label="انتخاب سایت در اتصال‌ها"');
    expect(html.match(/<option\b/g)).toHaveLength(4);
    expect(html.match(/<details\b/g)).toHaveLength(1);
    expect(html).not.toContain('راهنمای اتصال سامانه‌های دیگر');
    expect(html).not.toContain('داده‌های نیایش سیر');
  });
  it.each(registry.systems)(
    'uses the same closed API / separate chart / service layout for $id',
    (system) => {
      const html = renderToStaticMarkup(
        <SelectedSiteConnection
          registry={registry}
          system={system}
          userId="user"
        />,
      );
      const disclosure = html.match(/<details\b[^>]*>/)?.[0];
      expect(disclosure).toBeDefined();
      expect(disclosure).not.toMatch(/\bopen(?:=|\s|>)/);
      expect(html).toContain(`aria-label="تنظیمات API ${system.name}"`);
      expect(html).toContain(`aria-label="نمودار حضور زنده ${system.name}"`);
      expect(html).toContain(`aria-label="مدیریت خدمات ${system.name}"`);
      const end = html.indexOf('</details>');
      expect(html.indexOf('aria-label="نمودار حضور زنده')).toBeGreaterThan(end);
      expect(html.indexOf('aria-label="مدیریت خدمات')).toBeGreaterThan(end);
      for (const other of registry.systems.filter(
        (row) => row.id !== system.id,
      ))
        expect(html).not.toContain(`aria-label="مدیریت خدمات ${other.name}"`);
    },
  );
  it('keeps the API component free of native services and charts', () => {
    const html = renderToStaticMarkup(
      <GhestirooConnection branchId="branch" userId="user" />,
    );
    expect(html).toContain('اتصال قسطی‌رو به نورا');
    expect(html).not.toContain('مدیریت خدمات قسطی‌رو');
    expect(html).not.toContain('حضور زنده');
  });
  it('does not repeat primary-site API headings in the embedded services view', () => {
    const html = renderToStaticMarkup(
      <NiyayeshData branchId="branch" expectedSystemId="jahan" servicesOnly />,
    );
    expect(html).not.toContain('داده‌های نیایش سیر');
    expect(html).not.toContain('ورود شخصی نیازمند مجوز');
  });
  it('requires an explicit selected-site binding before native primary-connection data may be used', () => {
    expect(matchesNativeSite(null, 'jahan')).toBe(false);
    expect(matchesNativeSite({}, 'jahan')).toBe(false);
    expect(matchesNativeSite({ registrySystemId: 'niyayesh' }, 'jahan')).toBe(
      false,
    );
    expect(
      matchesNativeSite({ registrySystemId: 'niyayesh' }, 'niyayesh'),
    ).toBe(true);
    expect(matchesNativeSite({ registrySystemId: 'niyayesh' })).toBe(true);
  });
});
