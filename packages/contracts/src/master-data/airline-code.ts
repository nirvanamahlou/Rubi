/** A primary airline identifier may be IATA, ICAO or a textual callsign. */
export function normalizeAirlineCode(value: string): string | undefined {
  const code = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (code.length < 2 || code.length > 64) return undefined;
  return /^[A-Z0-9]{2}$/.test(code) ||
    /^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$/.test(code)
    ? code
    : undefined;
}
