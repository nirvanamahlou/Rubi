import type { AuthenticatedActor } from '@nora/contracts';

export interface ContractDraftScope {
  userId: string;
  storageKey: string;
}

/** A rotating access session must not restore a fresh draft over an open form. */
export function contractDraftScope(
  previous: ContractDraftScope | null,
  actor: Pick<AuthenticatedActor, 'userId' | 'sessionId'> | null,
): ContractDraftScope | null {
  if (!actor) return null;
  if (previous?.userId === actor.userId) return previous;
  return {
    userId: actor.userId,
    storageKey: `nora.sales.contract.draft.v2:${actor.userId}:${actor.sessionId}`,
  };
}
