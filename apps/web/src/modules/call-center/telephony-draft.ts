/** Prefill only; never replace an operator's in-progress draft on polling. */
export function telephonyDraftName(row: {
  call: { name: string };
  technical: { callerName?: string | null };
}) {
  return row.call.name.trim()
    ? row.call.name
    : (row.technical.callerName ?? '');
}
