import { describe, expect, it, vi, afterEach } from 'vitest';
import { NiyayeshSsoService } from './niyayesh-sso.service';
import type { IamService } from '../iam/iam.service';
import type { NiyayeshService } from './niyayesh.service';
import { MANUAL_ACCESS_VERSION, screenPermission } from '@nora/contracts';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [
    MANUAL_ACCESS_VERSION,
    ...[
      'integrations.home',
      'integrations.section.connections',
      'integrations.niyayesh.login',
    ].map(screenPermission),
  ],
};
afterEach(() => vi.restoreAllMocks());
function service() {
  const iam = {
    authenticateSessionReferenceV1: vi.fn().mockResolvedValue(actor),
  };
  const site = {
    canEdit: () => false,
    binding: vi.fn().mockResolvedValue({
      user: { subject: actor.userId, resources: ['countries'] },
    }),
  };
  const service = new NiyayeshSsoService(
    iam as unknown as IamService,
    site as unknown as NiyayeshService,
  );
  vi.spyOn(service, 'policy').mockResolvedValue({
    enabled: true,
    launchUrl: 'https://site.example/oidc/start',
    serviceSecret: 'test-'.repeat(10),
    organization: 'org',
    system: 'site',
    permissions: ['catalog', 'owner'],
    grants: [
      'panel.login',
      'countries.read',
      'users.create',
      'customer-orders.read',
    ],
  });
  return { service, iam, site };
}
describe('Nora current-session SSO authority', () => {
  it('projects native import grants only when the independent Nora checkbox is enabled', async () => {
    const { service: s, site } = service();
    site.binding.mockResolvedValue({
      user: { subject: actor.userId, resources: ['hotels'] },
    });
    Object.assign(site, {
      importTarget: () => 'hotels',
      canImport: (a: typeof actor) =>
        a.permissions.includes(
          screenPermission('integrations.niyayesh.import.hotels'),
        ),
    });
    vi.spyOn(s, 'policy').mockResolvedValue({
      enabled: true,
      launchUrl: 'https://site.example/oidc/start',
      serviceSecret: 'test-'.repeat(10),
      organization: 'org',
      system: 'site',
      permissions: ['hotels', 'excel'],
      grants: [
        'panel.login',
        'hotels.read',
        'hotels.update',
        'hotel-imports.read',
        'hotel-imports.create',
        'hotel-imports.bulk',
      ],
    });
    expect((await s.claims(actor, actor.branchIds[0]!)).nora_grants).toEqual([
      'panel.login',
      'hotels.read',
    ]);
    const permitted = {
      ...actor,
      permissions: [
        ...actor.permissions,
        screenPermission('integrations.niyayesh.import.hotels'),
      ],
    };
    const claims = await s.claims(permitted, actor.branchIds[0]!);
    expect(claims.nora_grants).toContain('hotel-imports.bulk');
    expect(claims.nora_permissions).toEqual(['hotels', 'excel']);
  });
  it('requires a separate login grant and does not imply provisioning', async () => {
    const { service: s } = service();
    const claims = await s.claims(actor, actor.branchIds[0]!);
    expect(claims.nora_provision).toBe(false);
    expect(claims.nora_permissions).toEqual(['catalog']);
    expect(claims.nora_grants).toEqual(['panel.login', 'countries.read']);
    await expect(
      s.claims(
        {
          ...actor,
          permissions: actor.permissions.filter(
            (p) => p !== screenPermission('integrations.niyayesh.login'),
          ),
        },
        actor.branchIds[0]!,
      ),
    ).rejects.toThrow();
  });
  it('authenticates the private service before resolving session references', async () => {
    const { service: s, iam } = service();
    await expect(s.inspect('Bearer invalid', {})).rejects.toThrow();
    expect(iam.authenticateSessionReferenceV1).not.toHaveBeenCalled();
  });
  it('rejects revoked sessions and reevaluates grants on every request', async () => {
    const { service: s, iam } = service();
    const input = {
      userId: actor.userId,
      sessionId: actor.sessionId,
      branchId: actor.branchIds[0],
    };
    expect(
      (await s.inspect('Bearer ' + 'test-'.repeat(10), input)).active,
    ).toBe(true);
    iam.authenticateSessionReferenceV1.mockRejectedValueOnce(Error('revoked'));
    expect(await s.inspect('Bearer ' + 'test-'.repeat(10), input)).toEqual({
      active: false,
    });
  });
});
