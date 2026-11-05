/** Output vocabulary only; persisted flight/transfer direction identifiers stay unchanged. */
export function reservationDirectionLabel(value: string) {
  return value
    .replace(/\bOUTBOUND\b/g, 'ARRIVAL')
    .replace(/\bRETURN\b/g, 'DEPARTURE');
}
