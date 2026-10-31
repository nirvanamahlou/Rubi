/** Reuse contact identity only. Previous conversations/results never become new calls. */
export function callContactPrefill(calls: { name: string; source: string }[]) {
  const known = calls.find((call) => call.name.trim());
  return { name: known?.name ?? '', source: known?.source || 'نامشخص' };
}
