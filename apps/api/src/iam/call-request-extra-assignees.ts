/** Explicit deployment policy; malformed or absent configuration grants nothing. */
export function extraRequestPolicy(
  userId: string,
): { unitId: string; userIds: string[] } | null {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(userId)) return null;
  try {
    const value: unknown = JSON.parse(
      process.env.CALL_CENTER_REQUEST_EXTRA_ASSIGNEES ?? '{}',
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const entry: unknown = Object.prototype.hasOwnProperty.call(value, userId)
      ? (value as Record<string, unknown>)[userId]
      : undefined;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return null;
    const { unitId, userIds: ids } = entry as Record<string, unknown>;
    if (typeof unitId !== 'string' || !uuid.test(unitId)) return null;
    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      !ids.every((id): id is string => typeof id === 'string' && uuid.test(id))
    )
      return null;
    return { unitId, userIds: [...new Set(ids)] };
  } catch {
    return null;
  }
}
export function extraRequestAssignees(userId: string): string[] {
  return extraRequestPolicy(userId)?.userIds ?? [];
}
