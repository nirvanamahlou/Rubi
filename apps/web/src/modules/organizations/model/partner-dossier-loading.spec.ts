import type { MasterDataRecord, LoginResponse } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { dossierSessionProjection } from './dossier-session';
import {
  partnerDossierScope,
  resolvePartnerOrganization,
} from './partner-dossier-loading';

describe('partner dossier loading lifecycle', () => {
  const user: LoginResponse['user'] = {
    id: 'actor',
    username: 'actor',
    displayName: 'Actor',
    email: null,
    permissions: ['master_data.read'],
    branches: [{ id: 'branch', name: 'Branch', code: 'B' }],
  };
  const scope = (revision: number) => {
    const p = dossierSessionProjection(user, revision, 'branch');
    return partnerDossierScope({
      ready: Boolean(p.contextKey),
      actorUserId: p.actorUserId,
      branchId: p.branchId,
      permissions: p.permissions,
    });
  };
  it('does not reset the parent when newly mounted children refresh the same session', () => {
    expect(new Set(Array.from({ length: 25 }, (_, i) => scope(i))).size).toBe(
      1,
    );
  });
  it('invalidates identity, permissions, branch and pending session without retaining another user data', () => {
    const initial = {
      ready: true,
      actorUserId: user.id,
      branchId: 'branch',
      permissions: user.permissions,
    };
    const baseline = partnerDossierScope(initial);
    for (const change of [
      { actorUserId: 'other' },
      { branchId: 'other' },
      { permissions: [] },
      { ready: false },
    ])
      expect(partnerDossierScope({ ...initial, ...change })).not.toBe(baseline);
  });
  it.each(['suppliers', 'brokers'] as const)(
    'opens existing %s without any creation request',
    async (resource) => {
      const connect = vi.fn();
      const source = {
        resource,
        attributes: { organizationId: 'org' },
      } as unknown as MasterDataRecord;
      expect(await resolvePartnerOrganization(source, 'branch', connect)).toBe(
        'org',
      );
      expect(connect).not.toHaveBeenCalled();
    },
  );
  it.each(['suppliers', 'brokers'] as const)(
    'automatically resolves a legacy %s using its current version',
    async (resource) => {
      const connect = vi.fn().mockResolvedValue({ organizationId: 'org' });
      const source = {
        resource,
        id: 'partner',
        version: 7,
        attributes: {},
      } as unknown as MasterDataRecord;
      expect(await resolvePartnerOrganization(source, 'branch', connect)).toBe(
        'org',
      );
      expect(connect).toHaveBeenCalledWith(resource, 'partner', 7, 'branch');
    },
  );
  it('propagates denied/conflict responses and rejects malformed success instead of waiting forever', async () => {
    const source = {
      resource: 'suppliers',
      id: 'partner',
      version: 7,
      attributes: {},
    } as unknown as MasterDataRecord;
    await expect(
      resolvePartnerOrganization(
        source,
        'branch',
        vi.fn().mockRejectedValue(new Error('Forbidden')),
      ),
    ).rejects.toThrow('Forbidden');
    await expect(
      resolvePartnerOrganization(
        source,
        'branch',
        vi.fn().mockResolvedValue({}),
      ),
    ).rejects.toThrow('اتصال ناموفق بود.');
  });
});
