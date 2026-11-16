import type { AuthenticatedActor, LegalEntityContext } from '@nora/contracts';

/** Navigation is not an identity change. The shared CRM layout owns this state;
 * a full refresh discards it, without persisting ERP text to browser storage. */
export function assistantConversationScopeKey(
  context: LegalEntityContext | null,
  actor: Pick<
    AuthenticatedActor,
    'userId' | 'branchIds' | 'permissions'
  > | null,
) {
  return JSON.stringify([
    context?.selection,
    context?.version,
    actor?.userId,
    actor && [...actor.branchIds].sort(),
    actor && [...actor.permissions].sort(),
  ]);
}

/** Display keeps every exchange. Provider history retains its separate budget. */
export function appendChatExchange<T>(
  previous: readonly T[],
  exchange: readonly T[],
): T[] {
  return [...previous, ...exchange];
}
