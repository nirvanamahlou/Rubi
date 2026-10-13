import type { MessagingContactV1 } from '@nora/contracts';

export function canAddGroupMember(
  selected: MessagingContactV1[],
  candidate: MessagingContactV1,
): boolean {
  if (!selected.length) return true;
  return candidate.branches.some((branch) =>
    selected.every((member) =>
      member.branches.some((memberBranch) => memberBranch.id === branch.id),
    ),
  );
}
