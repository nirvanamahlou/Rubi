import { canViewScreen } from '../iam/user-access';
import type { AuthenticatedActor } from '../iam';
/** Contract-area access implies self-service only for owned contracts in allowed branches. */
export function hasSalesContractSelfService(
  permissions: readonly string[],
): boolean {
  return (
    (permissions.includes('sales.contracts.create') ||
      ['own', 'branch', 'all'].some((scope) =>
        permissions.includes('sales.contracts.read.' + scope),
      )) &&
    (canViewScreen(permissions, 'sales.home') ||
      canViewScreen(permissions, 'sales.new-contract'))
  );
}
export function canSelfServeSalesContract(
  actor: Pick<AuthenticatedActor, 'permissions' | 'userId' | 'branchIds'>,
  contract: { ownerUserId: string; branchId: string },
): boolean {
  return (
    hasSalesContractSelfService(actor.permissions) &&
    contract.ownerUserId === actor.userId &&
    actor.branchIds.includes(contract.branchId)
  );
}

/** Correction follows the viewer's existing contract scope, without granting financial approval. */
export function canCorrectSalesContract(
  actor: Pick<AuthenticatedActor, 'permissions' | 'userId' | 'branchIds'>,
  contract: { ownerUserId: string; branchId: string },
): boolean {
  if (!actor.branchIds.includes(contract.branchId)) return false;
  return (
    canSelfServeSalesContract(actor, contract) ||
    actor.permissions.includes('sales.contracts.update.branch') ||
    (actor.permissions.includes('sales.contracts.update.own') &&
      contract.ownerUserId === actor.userId) ||
    (hasSalesContractSelfService(actor.permissions) &&
      (actor.permissions.includes('sales.contracts.read.branch') ||
        actor.permissions.includes('sales.contracts.read.all')))
  );
}
