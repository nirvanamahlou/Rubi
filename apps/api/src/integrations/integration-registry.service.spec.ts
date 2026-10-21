import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  IntegrationCatalogueConfigV1,
  SystemSettingV1,
} from '@nora/contracts';
import { IntegrationRegistryService } from './integration-registry.service';
import {
  integrationPublicUrl,
  validateIntegrationCatalogue,
} from './integration-registry.validation';

const branchId = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  branchIds: [branchId],
  permissions: ['ui.administrator', 'system.settings.manage'],
};
function fixture() {
  let persisted: SystemSettingV1 | null = null;
  const settings = {
    resolveSetting: vi.fn(async () => persisted),
    writeSetting: vi.fn(async (input) => {
      // Emulate the existing owner's under-lock version check, not a database proof.
      if (persisted && persisted.version !== input.expectedVersion)
        throw new ConflictException();
      persisted = {
        contract: 'system.setting.v1',
        id: persisted?.id ?? randomUUID(),
        namespace: input.namespace,
        key: input.key,
        valueType: input.valueType,
        value: input.value,
        scope: input.scope,
        scopeId: input.scopeId,
        version: (persisted?.version ?? 0) + 1,
        status: input.status,
        reason: input.reason,
        updatedAt: '2026-10-14T12:00:00.000Z',
        updatedByUserId: actor.userId,
      };
      return persisted;
    }),
  };
  return {
    settings,
    service: new IntegrationRegistryService(settings as never),
    get persisted() {
      return persisted;
    },
  };
}
const command = (
  snapshot: IntegrationCatalogueConfigV1 & { version: number },
  overrides = {},
) => ({
  schemaVersion: snapshot.schemaVersion,
  brands: snapshot.brands,
  systems: snapshot.systems,
  capabilities: snapshot.capabilities,
  expectedVersion: snapshot.version,
  reason: 'تغییر عنوان سامانه',
  ...overrides,
});

describe('Integration configuration boundary', () => {
  it('redacts setup and audit independently for readers and preserves both in storage', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    await service.write(
      actor,
      branchId,
      command(first, {
        systems: first.systems.map((system, index) =>
          index
            ? system
            : {
                ...system,
                setup: {
                  websiteUrl: 'https://example.com',
                  environment: 'SANDBOX',
                  protocol: 'REST',
                  authentication: 'OAUTH2',
                },
              },
        ),
      }),
    );
    const reader = (section: string): AuthenticatedActor => ({
      ...actor,
      permissions: manualSnapshotCodes({
        permissionCodes: [],
        screenIds: ['integrations.home', `integrations.section.${section}`],
        allowedControlIds: [],
      }) as AuthenticatedActor['permissions'],
    });
    const brands = await service.read(reader('brands'), branchId, 'brands');
    expect(brands.systems[0]?.setup).toBeUndefined();
    expect(brands.lastChange).toBeNull();
    expect(brands.canManage).toBe(false);
    const connection = await service.read(
      reader('connections'),
      branchId,
      'connections',
    );
    expect(connection.systems[0]?.setup?.websiteUrl).toBe(
      'https://example.com',
    );
    expect(connection.lastChange).toBeNull();
    const logs = await service.read(reader('logs'), branchId, 'logs');
    expect(logs.lastChange).not.toBeNull();
    expect(logs.systems[0]?.setup).toBeUndefined();
    expect(
      (await service.read(actor, branchId)).systems[0]?.setup,
    ).toBeDefined();
    await expect(
      service.read(reader('brands'), randomUUID(), 'brands'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.read(reader('brands'), branchId, 'connections'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each([
    'http://example.com',
    'https://127.0.0.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://[::1]',
    'https://host.local',
    'https://host.internal',
    'https://localhost',
    'https://user:pass@example.com',
    'https://example.com?token=value',
    'https://example.com?',
    'https://example.com#value',
    'https://example.com#',
    'https://example.com:8443',
    'https://example.com/private/token/value',
  ])('rejects unsafe or credential-bearing setup URL %s', (value) => {
    expect(() => integrationPublicUrl(value)).toThrow(BadRequestException);
  });
  it('normalizes public URL identity and preserves setup when an older client omits it', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    const setup = {
      websiteUrl: 'https://SITE.example.com:443/',
      environment: 'SANDBOX',
      protocol: 'REST',
      authentication: 'API_KEY',
    };
    const next = await service.write(
      actor,
      branchId,
      command(first, {
        systems: first.systems.map((row, index) =>
          index === 0 ? { ...row, setup } : row,
        ),
      }),
    );
    expect(next.systems[0]!.setup?.websiteUrl).toBe('https://site.example.com');
    const legacySystems = next.systems.map((row) => {
      const legacy = { ...row };
      delete legacy.setup;
      return legacy;
    });
    const saved = await service.write(
      actor,
      branchId,
      command(next, { systems: legacySystems }),
    );
    expect(saved.systems[0]!.setup).toEqual(next.systems[0]!.setup);
    const cleared = await service.write(
      actor,
      branchId,
      command(saved, {
        systems: saved.systems.map((row, index) =>
          index === 0
            ? {
                ...row,
                setup: {
                  environment: 'SANDBOX',
                  protocol: 'UNDECIDED',
                  authentication: 'UNDECIDED',
                },
              }
            : row,
        ),
      }),
    );
    expect(cleared.systems[0]!.setup).not.toHaveProperty('websiteUrl');
  });
  it('rejects duplicate normalized sites and unknown credential fields', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    const setup = {
      websiteUrl: 'https://site.example.com/',
      environment: 'SANDBOX',
      protocol: 'REST',
      authentication: 'API_KEY',
    };
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          systems: first.systems.map((row) => ({ ...row, setup })),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          systems: first.systems.map((row, index) =>
            index === 0
              ? { ...row, setup: { ...setup, credential: 'never-store-this' } }
              : row,
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('checks duplicate sites after preserving metadata omitted by a legacy client', async () => {
    const { service, settings } = fixture();
    const initial = await service.initialize(actor, branchId);
    const setup = {
      websiteUrl: 'https://site.example.com',
      environment: 'SANDBOX',
      protocol: 'UNDECIDED',
      authentication: 'UNDECIDED',
    };
    const saved = await service.write(
      actor,
      branchId,
      command(initial, {
        systems: initial.systems.map((row, index) =>
          index === 0 ? { ...row, setup } : row,
        ),
      }),
    );
    settings.writeSetting.mockClear();
    await expect(
      service.write(
        actor,
        branchId,
        command(saved, {
          systems: saved.systems.map((row, index) => {
            if (index === 1) return { ...row, setup };
            const legacy = { ...row };
            delete legacy.setup;
            return legacy;
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(settings.writeSetting).not.toHaveBeenCalled();
    expect((await service.read(actor, branchId)).version).toBe(saved.version);
  });
  it('does not create records or invent zero measurements on GET', async () => {
    const { service, settings } = fixture();
    expect(await service.read(actor, branchId)).toMatchObject({
      initialized: false,
      version: 0,
      counts: null,
      lastChange: null,
      connectionState: 'NOT_CONFIGURED',
    });
    expect(settings.writeSetting).not.toHaveBeenCalled();
  });
  it('creates configurable presets once and keeps education separate', async () => {
    const { service, settings } = fixture();
    const first = await service.initialize(actor, branchId, 'request-fixture');
    const second = await service.initialize(actor, branchId);
    expect(second.systems).toEqual(first.systems);
    expect(first.brands.map((brand) => brand.name)).toEqual([
      'جهان باستان',
      'نیایش سیر',
      'قسطی روو',
      'جهان آکادمی',
    ]);
    expect(
      first.systems.find((system) => system.code.startsWith('jahan-academy'))
        ?.businessDomain,
    ).toBe('EDUCATION');
    expect(first.counts).toEqual({
      brands: 4,
      systems: 4,
      awaitingConnection: 4,
    });
    expect(settings.writeSetting).toHaveBeenCalledTimes(1);
    expect(settings.writeSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'integrations',
        key: 'registry',
        scope: 'BRANCH',
        scopeId: branchId,
      }),
      actor,
      { requestId: 'request-fixture' },
    );
  });
  it('reconciles concurrent initialization without replacing winning identities', async () => {
    const { service, settings } = fixture();
    const [left, right] = await Promise.all([
      service.initialize(actor, branchId),
      service.initialize(actor, branchId),
    ]);
    expect(left.brands).toEqual(right.brands);
    expect(left.systems).toEqual(right.systems);
    expect(
      settings.writeSetting.mock.results.filter(
        (result) => result.type === 'return',
      ),
    ).toHaveLength(2);
  });
  it.each(['read', 'initialize'] as const)(
    'rejects cross-branch %s even for administrators before reading configuration',
    async (action) => {
      const { service, settings } = fixture();
      await expect(service[action](actor, randomUUID())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(settings.resolveSetting).not.toHaveBeenCalled();
    },
  );
  it('rejects missing screen access and never exposes a global fallback', async () => {
    const { service, settings } = fixture();
    await expect(
      service.read(
        { ...actor, permissions: ['system.settings.read'] },
        branchId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    settings.resolveSetting.mockResolvedValueOnce({ scope: 'GLOBAL' } as never);
    expect((await service.read(actor, branchId)).initialized).toBe(false);
  });
  it('requires the native write permission plus module and field controls', async () => {
    const { service } = fixture();
    const profile = {
      ...actor,
      permissions: [
        'ui.profile',
        'ui.screen.integrations.home',
      ] as AuthenticatedActor['permissions'],
    };
    expect(service.canManage(profile)).toBe(false);
    const denied = {
      ...actor,
      permissions: [
        'ui.profile',
        'ui.screen.integrations.home',
        'system.settings.manage',
        'ui.deny.field.system-settings.integrations.registry',
      ] as AuthenticatedActor['permissions'],
    };
    expect(service.canManage(denied)).toBe(false);
    await expect(service.initialize(profile, branchId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('accepts selectable manual controls while preserving native operation and branch checks', async () => {
    const { service, settings } = fixture();
    const selection = {
      permissionCodes: ['system.settings.manage'],
      screenIds: ['integrations.home', 'system.module.integrations'],
      allowedControlIds: [
        'system.module.integrations',
        'field.system-settings.integrations.registry',
      ],
    };
    const manualActor = {
      ...actor,
      permissions: manualSnapshotCodes(
        selection,
      ) as AuthenticatedActor['permissions'],
    };
    expect(service.canManage(manualActor)).toBe(true);
    expect((await service.initialize(manualActor, branchId)).initialized).toBe(
      true,
    );
    for (const removed of [
      'system.settings.manage',
      'ui.screen.integrations.home',
      'ui.screen.system.module.integrations',
      'ui.allow.system.module.integrations',
      'ui.allow.field.system-settings.integrations.registry',
    ]) {
      const denied = {
        ...manualActor,
        permissions: manualActor.permissions.filter((p) => p !== removed),
      };
      expect(service.canManage(denied)).toBe(false);
      await expect(service.initialize(denied, branchId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    settings.writeSetting.mockClear();
    await expect(
      service.initialize(manualActor, randomUUID()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(settings.writeSetting).not.toHaveBeenCalled();
  });
  it('allows multiple systems per brand and configurable capability keys', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    const second = await service.write(
      actor,
      branchId,
      command(first, {
        capabilities: [
          {
            code: 'catalog.read',
            name: 'خواندن کاتالوگ',
            lifecycle: 'ENABLED',
          },
        ],
        systems: [
          ...first.systems,
          {
            ...first.systems[0]!,
            id: randomUUID(),
            code: 'additional-site',
            capabilityCodes: ['catalog.read'],
          },
        ],
      }),
    );
    expect(
      second.systems.filter((system) => system.brandId === first.brands[0]!.id),
    ).toHaveLength(2);
    expect(second.version).toBe(2);
  });
  it('rejects stale edits and retains the last valid version on owner failure', async () => {
    const { service, settings } = fixture();
    const first = await service.initialize(actor, branchId);
    await expect(
      service.write(actor, branchId, command(first, { expectedVersion: 0 })),
    ).rejects.toBeInstanceOf(ConflictException);
    settings.writeSetting.mockRejectedValueOnce(
      new Error('audit persistence unavailable'),
    );
    await expect(
      service.write(actor, branchId, command(first)),
    ).rejects.toThrow('audit persistence unavailable');
    expect((await service.read(actor, branchId)).version).toBe(first.version);
  });
  it('preserves archived identities and forbids removal or identity rewriting', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, { systems: first.systems.slice(1) }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          brands: first.brands.map((brand, index) =>
            index ? brand : { ...brand, code: 'rewritten-code' },
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const archived = await service.write(
      actor,
      branchId,
      command(first, {
        systems: first.systems.map((system, index) =>
          index ? system : { ...system, lifecycle: 'ARCHIVED' },
        ),
      }),
    );
    expect(archived.systems).toHaveLength(4);
    expect(archived.counts?.awaitingConnection).toBe(3);
  });
  it.each(['credential', 'token', 'url', 'externalId', 'payload'])(
    'rejects unsupported %s before persistence or any network access',
    async (key) => {
      const { service, settings } = fixture();
      const first = await service.initialize(actor, branchId);
      settings.writeSetting.mockClear();
      await expect(
        service.write(actor, branchId, {
          ...command(first),
          [key]: 'https://127.0.0.1/private',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(settings.writeSetting).not.toHaveBeenCalled();
    },
  );
  it('rejects orphan mappings, duplicate identities, invalid versions and secret-like labels', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    expect(() =>
      validateIntegrationCatalogue({
        ...command(first),
        expectedVersion: undefined,
      }),
    ).toThrow();
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          systems: [{ ...first.systems[0], brandId: randomUUID() }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, { brands: [...first.brands, first.brands[0]] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(actor, branchId, command(first, { expectedVersion: 1.5 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, { reason: 'token=fixture-value' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('reports installed owner adapters without any live-connection claim', () => {
    const { service } = fixture();
    expect(service.adapters(actor)).toHaveLength(2);
    expect(
      service
        .adapters(actor)
        .every((adapter) => adapter.verification === 'NOT_VERIFIED'),
    ).toBe(true);
    expect(JSON.stringify(service.adapters(actor))).not.toMatch(
      /credential|secret|https?:\/\//i,
    );
  });
  it('does not expose unsafe reasons authored through the shared settings API', async () => {
    const f = fixture();
    await f.service.initialize(actor, branchId);
    f.settings.resolveSetting.mockResolvedValueOnce({
      ...f.persisted!,
      reason: 'authorization:fixture-value',
    });
    const snapshot = await f.service.read(actor, branchId);
    expect(snapshot.lastChange?.reason).toBe('تغییر تنظیمات فهرست');
    expect(JSON.stringify(snapshot)).not.toContain('fixture-value');
  });
  it('rejects enum arrays and normalizes UUID case before duplicate checks', async () => {
    const { service } = fixture();
    const first = await service.initialize(actor, branchId);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          brands: first.brands.map((brand, index) =>
            index ? brand : { ...brand, lifecycle: ['ENABLED'] },
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          systems: first.systems.map((system, index) =>
            index ? system : { ...system, businessDomain: ['TRAVEL'] },
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.write(
        actor,
        branchId,
        command(first, {
          brands: [
            ...first.brands,
            {
              ...first.brands[0],
              id: first.brands[0]!.id.toUpperCase(),
              code: 'different-code',
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
import { manualSnapshotCodes } from '../iam/manual-access-policy';
