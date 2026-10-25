import type { SalesServiceInput } from './index';

export interface LegacyServiceParty {
  adults: number;
  children: number;
  infants: number;
}

/** Aggregate historical service counts, never substitute passenger identities. */
export function readLegacyServiceParties(
  services: readonly Pick<
    SalesServiceInput,
    'clientKey' | 'kind' | 'metadata'
  >[],
): Readonly<Record<string, LegacyServiceParty>> | null {
  const marked = services.filter(
    (s) => s.metadata?.legacyServicePartiesV2 !== undefined,
  );
  if (!marked.length) return null;
  if (
    marked.length !== 1 ||
    marked[0] !== services[0] ||
    services.some((s) => s.metadata?.legacyContractV1 === true)
  )
    throw Error('Invalid legacy service counts');
  const raw = marked[0]!.metadata!.legacyServicePartiesV2;
  if (typeof raw !== 'string' || raw.length > 12000)
    throw Error('Invalid legacy service counts');
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw Error('Invalid legacy service counts');
  const values = data as Record<string, unknown>;
  if (
    Object.keys(values).length !== services.length ||
    new Set(services.map((s) => s.clientKey)).size !== services.length
  )
    throw Error('Invalid legacy service counts');
  const result: Record<string, LegacyServiceParty> = Object.create(
    null,
  ) as Record<string, LegacyServiceParty>;
  for (const service of services) {
    if (!Object.hasOwn(values, service.clientKey))
      throw Error('Invalid legacy service counts');
    const value = values[service.clientKey];
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('Invalid legacy service counts');
    const party = value as Record<string, unknown>;
    if (
      Object.keys(party).sort().join(',') !== 'adults,children,infants' ||
      ![party.adults, party.children, party.infants].every(
        (n) =>
          typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 500,
      )
    )
      throw Error('Invalid legacy service counts');
    const { adults, children, infants } =
      party as unknown as LegacyServiceParty;
    if (
      adults + children + infants < 1 ||
      adults + children + infants > 500 ||
      (infants > 0 && adults === 0)
    )
      throw Error('Invalid legacy service counts');
    result[service.clientKey] = { adults, children, infants };
  }
  return result;
}

export function legacyServiceHeadcount(
  services: Parameters<typeof readLegacyServiceParties>[0],
): number | null {
  const parties = readLegacyServiceParties(services);
  return parties
    ? Math.max(
        ...Object.values(parties).map((p) => p.adults + p.children + p.infants),
      )
    : null;
}
