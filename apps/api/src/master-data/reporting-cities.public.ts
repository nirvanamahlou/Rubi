import type { DatabaseClient } from '@nora/database';

/** Master Data-owned, non-private labels for already authorized travel references. */
export async function reportingCityLabels(
  client: DatabaseClient,
  ids: readonly string[],
) {
  const rows = await client.masterCity.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Country labels are derived from the canonical city-to-country FK. */
export async function reportingCityCountries(
  client: DatabaseClient,
  ids: readonly string[],
) {
  const rows = await client.masterCity.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, country: { select: { id: true, name: true } } },
  });
  return new Map(
    rows.map((r) => [r.id, { id: r.country.id, name: r.country.name }]),
  );
}
