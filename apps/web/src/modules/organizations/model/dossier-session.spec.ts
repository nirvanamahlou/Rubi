import type { LoginResponse } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import { dossierSessionProjection } from './dossier-session';

const user = (
  id: string,
  permissions: LoginResponse['user']['permissions'],
  branches = [
    { id: 'branch-a', code: 'A', name: 'A' },
    { id: 'branch-b', code: 'B', name: 'B' },
  ],
): LoginResponse['user'] => ({
  id,
  username: id,
  email: null,
  displayName: id,
  permissions,
  branches,
});

describe('dossier session context', () => {
  it('changes identity when the actor or grants change on the same branch', () => {
    const first = dossierSessionProjection(
      user('user-a', ['b2b.agency.read']),
      1,
      'branch-b',
    );
    const nextActor = dossierSessionProjection(
      user('user-b', ['b2b.agency.read']),
      2,
      'branch-b',
    );
    const revoked = dossierSessionProjection(user('user-b', []), 3, 'branch-b');
    expect(first.branchId).toBe('branch-b');
    expect(nextActor.contextKey).not.toBe(first.contextKey);
    expect(revoked.contextKey).not.toBe(nextActor.contextKey);
    expect(revoked.permissions).toEqual([]);
  });

  it('retains the selected branch only while the refreshed actor remains authorized', () => {
    expect(
      dossierSessionProjection(user('user-a', []), 1, 'branch-b').branchId,
    ).toBe('branch-b');
    expect(
      dossierSessionProjection(
        user('user-a', [], [{ id: 'branch-c', code: 'C', name: 'C' }]),
        2,
        'branch-b',
      ).branchId,
    ).toBe('branch-c');
  });
});
