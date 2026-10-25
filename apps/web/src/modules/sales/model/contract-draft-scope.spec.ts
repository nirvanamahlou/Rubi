import { describe, expect, it } from 'vitest';
import { contractDraftScope } from './contract-draft-scope';

describe('mounted contract draft ownership', () => {
  const actor = { userId: 'seller', sessionId: 'login-session' };
  it('keeps an open draft scope unchanged when authentication rotates', () => {
    const scope = contractDraftScope(null, actor);
    expect(
      contractDraftScope(scope, { ...actor, sessionId: 'rotated-session' }),
    ).toBe(scope);
  });
  it('uses the current session on a new form mount', () => {
    expect(
      contractDraftScope(null, { ...actor, sessionId: 'new-login' })
        ?.storageKey,
    ).toBe('nora.sales.contract.draft.v2:seller:new-login');
  });
  it('never exposes a previous user draft to another account', () => {
    const scope = contractDraftScope(null, actor);
    expect(
      contractDraftScope(scope, {
        userId: 'other-seller',
        sessionId: 'other-login',
      })?.storageKey,
    ).toBe('nora.sales.contract.draft.v2:other-seller:other-login');
  });
  it('clears ownership when the authenticated actor is removed', () => {
    expect(
      contractDraftScope(contractDraftScope(null, actor), null),
    ).toBeNull();
  });
});
