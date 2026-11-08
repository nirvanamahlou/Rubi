import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { DependenciesScanner } from '@nestjs/core/scanner';

afterEach(() => vi.unstubAllEnvs());

describe('full application module graph', () => {
  it('resolves every module without starting providers or connecting to production services', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused');
    vi.stubEnv(
      'IAM_ACCESS_TOKEN_SECRET',
      'synthetic-bootstrap-secret-never-used',
    );
    for (const [index, key] of [
      'CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64',
      'CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64',
      'MASTER_DATA_IMPORT_TOKEN_KEY_BASE64',
      'DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64',
    ].entries())
      vi.stubEnv(key, Buffer.alloc(32, index + 1).toString('base64'));
    vi.stubEnv('CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION', '1');
    const { AppModule } = await import('../app.module');
    const config = new ApplicationConfig();
    const container = new NestContainer(config);
    const scanner = new DependenciesScanner(
      container,
      new MetadataScanner(),
      new GraphInspector(container),
      config,
    );
    await expect(scanner.scan(AppModule)).resolves.toBeUndefined();
    expect(container.getModules().size).toBeGreaterThan(20);
    const { CallCenterDashboardSource } =
      await import('../customer-affairs/call-center-dashboard.public');
    expect(
      [...container.getModules().values()].filter((module) =>
        module.providers.has(CallCenterDashboardSource),
      ),
    ).toHaveLength(1);
  }, 30000);
  it('defers the public call reader until a request and preserves its authorization query', async () => {
    const { DashboardOperationalSources } =
      await import('./reporting-dashboard-operational-sources');
    const { CallCenterDashboardSource } =
      await import('../customer-affairs/call-center-dashboard.public');
    const read = vi
      .fn()
      .mockResolvedValue({ source: 'calls', state: 'forbidden', metrics: {} });
    const get = vi.fn().mockReturnValue({ read });
    const sources = new DashboardOperationalSources(
      {} as never,
      { get } as never,
    );
    const reader = sources.readers.find(
      (r) => r.source === 'customer-affairs.dashboard.attributed-calls.v1',
    )!;
    expect(get).not.toHaveBeenCalled();
    const query = {
      actor: { userId: 'synthetic', branchIds: [], permissions: [] },
      from: new Date('2026-01-01'),
      to: new Date('2026-01-02'),
      filters: {},
      dateBasis: 'effective',
    };
    expect(await reader.read(query)).toMatchObject({ state: 'forbidden' });
    expect(get).toHaveBeenCalledWith(CallCenterDashboardSource, {
      strict: false,
    });
    expect(read).toHaveBeenCalledWith(query);
  });
});
