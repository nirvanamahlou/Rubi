import type { LoginResponse } from '@nora/contracts';

export function dossierSessionProjection(
  user: LoginResponse['user'],
  revision: number,
  selectedBranchId: string,
) {
  return {
    branches: user.branches,
    branchId: user.branches.some((branch) => branch.id === selectedBranchId)
      ? selectedBranchId
      : (user.branches[0]?.id ?? ''),
    permissions: user.permissions,
    error: user.branches.length
      ? ''
      : 'هیچ شعبه مجازی برای این حساب وجود ندارد.',
    contextKey: [
      revision,
      user.id,
      [...user.permissions].sort().join(','),
      user.branches
        .map((branch) => branch.id)
        .sort()
        .join(','),
    ].join('|'),
  };
}
