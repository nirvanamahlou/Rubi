export type DestinationChoice = {
  id: string;
  name: string;
  countryId?: string;
};
type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export async function loadPackDestinations(
  kind: 'countries' | 'cities',
  request: Request,
  countryId = '',
  search = '',
) {
  if (kind === 'cities' && !countryId) return [];
  const options: DestinationChoice[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; page <= 50; page += 1) {
    const query = new URLSearchParams({ kind, page: String(page), search });
    if (countryId) query.set('countryId', countryId);
    const result = await request<{
      data: DestinationChoice[];
      meta: { total: number };
    }>(`/pack-options?${query}`);
    const total = result.meta.total;
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      total > 5000 ||
      (expected !== undefined && expected !== total) ||
      (kind === 'cities' &&
        result.data.some((city) => city.countryId !== countryId))
    )
      throw new Error('فهرست مقصد کامل یا معتبر نیست؛ دوباره تلاش کنید.');
    expected = total;
    for (const option of result.data) {
      if (ids.has(option.id))
        throw new Error('فهرست مقصد تغییر کرده است؛ دوباره تلاش کنید.');
      ids.add(option.id);
      options.push(option);
    }
    if (options.length === expected) return options;
    if (!result.data.length || options.length > expected) break;
  }
  throw new Error('فهرست مقصد کامل دریافت نشد؛ جست‌وجو را دقیق‌تر کنید.');
}
