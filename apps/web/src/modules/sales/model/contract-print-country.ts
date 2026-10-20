import type { MasterDataRecord } from '@nora/contracts';

/** Country references decide only the calendar; they never change saved dates. */
export async function printCityInternational(
  city: Pick<MasterDataRecord, 'attributes'>,
  country: (
    id: string,
  ) => Promise<Pick<MasterDataRecord, 'code' | 'attributes'> | undefined>,
): Promise<boolean> {
  const id = city.attributes.countryId;
  if (typeof id !== 'string' || !id) return false;
  try {
    const record = await country(id);
    const code = String(record?.attributes.iso2Code || record?.code || '')
      .trim()
      .toUpperCase();
    return Boolean(code) && !['IR', 'IRN', 'IRAN'].includes(code);
  } catch {
    return false;
  }
}
