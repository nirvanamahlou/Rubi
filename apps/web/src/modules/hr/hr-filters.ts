export interface SavedHrFilter {
  status: string;
  branchId: string;
  from: string;
  to: string;
  expiry: string;
}
export function parseSavedHrFilter(
  serialized: string | null,
  allowedBranches: readonly string[],
): SavedHrFilter | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (
      ['status', 'branchId', 'from', 'to', 'expiry'].some(
        (key) => typeof item[key] !== 'string',
      )
    )
      return null;
    if (item.branchId && !allowedBranches.includes(String(item.branchId)))
      return null;
    if (
      [item.from, item.to].some(
        (date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date)),
      )
    )
      return null;
    return {
      status: String(item.status),
      branchId: String(item.branchId),
      from: String(item.from),
      to: String(item.to),
      expiry: String(item.expiry),
    };
  } catch {
    return null;
  }
}
