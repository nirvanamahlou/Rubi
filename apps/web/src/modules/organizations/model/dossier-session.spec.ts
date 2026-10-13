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
    expect(first.branches.map((branch) => branch.id)).toEqual([
      'branch-a',
      'branch-b',
    ]);
    expect(nextActor.contextKey).not.toBe(first.contextKey);
    expect(first.actorIdentityKey).toBe('user-a');
    expect(nextActor.actorIdentityKey).toBe('user-b');
    expect(revoked.contextKey).not.toBe(nextActor.contextKey);
    expect(revoked.permissions).toEqual([]);
  });

  it('keeps actor identity stable across ordinary refresh revisions', () => {
    const first = dossierSessionProjection(user('user-a', []), 1, 'branch-a');
    const refreshed = dossierSessionProjection(
      user('user-a', []),
      2,
      'branch-a',
    );
    expect(refreshed.contextKey).not.toBe(first.contextKey);
    expect(refreshed.actorIdentityKey).toBe(first.actorIdentityKey);
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
