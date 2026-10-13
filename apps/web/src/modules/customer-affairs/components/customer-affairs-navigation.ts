export function customerAffairsHref(view: string, detailId?: string) {
  const params = new URLSearchParams({ view });
  if (detailId) params.set(view === 'leads' ? 'lead' : 'ticket', detailId);
  return `/customer-affairs?${params}`;
}
