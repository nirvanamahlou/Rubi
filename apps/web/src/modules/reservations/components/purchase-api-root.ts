export const purchaseApiRoot = (id: string, root?: string) =>
  root ?? 'reservations/requests/' + encodeURIComponent(id);
