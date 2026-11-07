/** Explicit deployment policy; malformed or absent configuration grants nothing. */
export function extraRequestAssignees(userId: string): string[] {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(userId)) return [];
  try {
    const value: unknown = JSON.parse(
      process.env.CALL_CENTER_REQUEST_EXTRA_ASSIGNEES ?? '{}',
    );
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const ids: unknown = Object.prototype.hasOwnProperty.call(value, userId)
      ? (value as Record<string, unknown>)[userId]
      : undefined;
    if (!Array.isArray(ids) || ids.length > 20) return [];
    if (
      !ids.every((id): id is string => typeof id === 'string' && uuid.test(id))
    )
      return [];
    return [...new Set(ids)];
  } catch {
    return [];
  }
}
