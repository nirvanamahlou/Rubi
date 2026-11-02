export function livePopupEligible(
  row: { synthetic: boolean; state: string; technical: { offeredAt?: string } },
  since: string,
) {
  return (
    !row.synthetic &&
    ['RINGING', 'ANSWERED'].includes(row.state) &&
    !!row.technical.offeredAt &&
    Date.parse(row.technical.offeredAt) > Date.parse(since)
  );
}
