/** Unverified display metadata, never a customer identity or routing key. */
export function issabelCallerName(value: string | undefined): string | null {
  const name = value?.normalize('NFC').trim();
  if (
    !name ||
    name.length > 160 ||
    [...name].some((character) => character.charCodeAt(0) < 32) ||
    /[\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)
  )
    return null;
  if (
    /^(?:unknown|anonymous|restricted|unavailable|withheld|<unknown>|\+?[\d\s().-]+)$/i.test(
      name,
    )
  )
    return null;
  return name;
}
