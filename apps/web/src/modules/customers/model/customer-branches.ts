import type { BranchReference } from '@rubi/contracts';

export function customerBranchOptions(
  allowedIds: readonly string[],
  references: readonly BranchReference[],
) {
  const names = new Map(
    references.map((branch) => [branch.id, branch.name.trim()]),
  );
  return [...new Set(allowedIds)].map((id) => ({
    id,
    name: names.get(id) || 'نام شعبه در دسترس نیست',
    unavailable: !names.get(id),
  }));
}
