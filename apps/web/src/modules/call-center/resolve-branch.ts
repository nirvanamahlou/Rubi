export function resolvedCallCenterBranch(
  allowed: readonly string[],
  response: {
    data: { id: string }[];
    meta?: { defaultBranchId: string | null } | undefined;
  },
) {
  const ids = response.data
    .map((b) => b.id)
    .filter((id) => allowed.includes(id));
  const preferred = response.meta?.defaultBranchId;
  if (preferred && ids.includes(preferred)) return preferred;
  // Older APIs may omit the default, which is unambiguous only for a single authorized branch.
  return ids.length === 1 && !preferred ? ids[0]! : null;
}
