/** Stable identity for the same flight across every passenger ticket. */
export const reservationFlightOutputKey = (
  serviceClientKey: string,
  offerId?: string,
) => `${serviceClientKey}-${offerId ?? 'contract-only'}`;

export function validateTicketFlightNumbers(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, string> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length > 100
  )
    throw new Error('اطلاعات شماره پرواز معتبر نیست.');
  const entries = Object.entries(value);
  for (const [key, number] of entries) {
    if (
      !allowedKeys.includes(key) ||
      typeof number !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9 /-]{0,31}$/.test(number.trim())
    )
      throw new Error(
        'شماره پرواز باید متعلق به همین قرارداد و حداکثر ۳۲ نویسه باشد.',
      );
  }
  return Object.fromEntries(
    entries.map(([key, number]) => [
      key,
      (number as string).trim().toUpperCase(),
    ]),
  );
}
