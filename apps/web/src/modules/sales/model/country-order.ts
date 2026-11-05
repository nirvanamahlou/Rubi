import type { MasterDataRecord } from '@nora/contracts';

type ReferenceOption = Pick<MasterDataRecord, 'name' | 'code'> &
  Partial<MasterDataRecord>;

function countryPriority(item: ReferenceOption) {
  if (item.resource !== 'countries') return 2;
  const normalize = (value: unknown) =>
    typeof value === 'string'
      ? value
          .normalize('NFKC')
          .replace(/ي/g, 'ی')
          .replace(/ك/g, 'ک')
          .trim()
          .toLowerCase()
      : '';
  for (const code of [item.attributes?.iso2Code, item.code].map(normalize)) {
    if (['ir', 'irn'].includes(code)) return 0;
    if (['tr', 'tur'].includes(code)) return 1;
  }
  const names = [item.name, item.attributes?.englishName].map(normalize);
  if (names.some((name) => ['ایران', 'iran'].includes(name))) return 0;
  if (
    names.some((name) =>
      ['ترکیه', 'turkey', 'türkiye', 'turkiye'].includes(name),
    )
  )
    return 1;
  return 2;
}

/** Display priority only: retain stored values, the input list and all other relative order. */
export function orderSalesCountryOptions<T extends ReferenceOption>(
  options: readonly T[],
): T[] {
  return [...options].sort(
    (left, right) => countryPriority(left) - countryPriority(right),
  );
}
