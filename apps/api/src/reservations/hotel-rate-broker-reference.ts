/** Persist exactly one real FK while retaining the public brokerId contract. */
export function hotelRateBrokerFields(
  brokerId: string,
  source?: 'BROKER' | 'ORGANIZATION',
) {
  return source === 'BROKER'
    ? { brokerId: null, registeredBrokerId: brokerId }
    : { brokerId, registeredBrokerId: null };
}

export function hotelRateBrokerId(row: {
  brokerId: string | null;
  registeredBrokerId?: string | null;
}): string {
  const id = row.registeredBrokerId ?? row.brokerId;
  if (!id) throw new Error('Hotel rate broker reference is missing.');
  return id;
}
