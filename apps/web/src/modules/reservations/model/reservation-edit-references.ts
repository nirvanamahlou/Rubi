import type { MasterDataRecord, MasterDataResource } from '@nora/contracts';

export type ReservationEditReferenceResource =
  'airlines' | 'hotels' | 'brokers';

export type ReservationEditReferenceOption = {
  id: string;
  label: string;
  searchText: string;
  aliases: readonly string[];
};

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export function normalizeReservationReference(value: string) {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u200C]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

export function reservationEditReferenceOption(
  resource: ReservationEditReferenceResource,
  record: MasterDataRecord,
): ReservationEditReferenceOption {
  const englishName = text(record.attributes.englishName);
  const code = text(record.code);
  const aliases = [
    ...new Set([record.name.trim(), englishName, code].filter(Boolean)),
  ];
  return {
    id: record.id,
    label:
      resource === 'airlines' || resource === 'hotels'
        ? englishName || record.name.trim()
        : record.name.trim() || englishName,
    searchText: aliases.join(' '),
    aliases,
  };
}

export function findReservationEditReference(
  value: string,
  options: readonly ReservationEditReferenceOption[],
) {
  const normalized = normalizeReservationReference(value);
  if (!normalized) return undefined;
  return options.find((option) =>
    option.aliases.some(
      (alias) => normalizeReservationReference(alias) === normalized,
    ),
  );
}

export const reservationEditReferenceResource = {
  arrivalAirline: 'airlines',
  departureAirline: 'airlines',
  hotel: 'hotels',
  broker: 'brokers',
} as const satisfies Record<string, MasterDataResource>;

export type ReservationEditReferenceKey =
  keyof typeof reservationEditReferenceResource;
