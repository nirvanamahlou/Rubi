import { createProduct, type Product, type ProductInput } from './catalog';

export const statusLabels = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  paused: 'توقف فروش',
  cancelled: 'لغو برنامه',
} as const;
export const supplyLabels = {
  company: 'ظرفیت شرکت',
  allotment: 'سهمیه',
  charter: 'چارتر',
  supplier: 'تأمین‌کننده / API',
} as const;
export function emptyInput(): ProductInput {
  return {
    title: '',
    transport: 'flight',
    segments: [
      {
        airlineId: '',
        aircraftId: '',
        flightNumber: '',
        originCountryId: '',
        originCityId: '',
        destinationCountryId: '',
        destinationCityId: '',
        originAirportId: '',
        destinationAirportId: '',
        departureAt: '',
        arrivalAt: '',
        departureZone: 'Asia/Tehran',
        arrivalZone: 'Asia/Tehran',
      },
    ],
    flightClassId: '',
    baggageId: '',
    supplyType: 'supplier',
    companyOwned: false,
    entryMethod: 'manual',
    totalCapacity: 0,
    rules: '',
    fare: {
      purchase: '0',
      fee: '0',
      commission: '0',
      currencyId: '',
      currencyCode: '',
      validFrom: '',
      validTo: '',
    },
  };
}
export function previewSamples(now: string): Product[] {
  // Synthetic program definitions only: no fake master-data IDs, PNRs or actual counters.
  const base = Date.parse(now);
  return Array.from({ length: 8 }, (_, index) => {
    const departureAt = new Date(base + (index + 7) * 86400000).toISOString();
    const arrivalAt = new Date(Date.parse(departureAt) + 7200000).toISOString();
    const input = emptyInput();
    return createProduct(
      'preview-sample-' + index,
      {
        ...input,
        title: 'برنامه ساختگی ' + (index + 1),
        totalCapacity: 20 + index * 5,
        supplyType: index % 2 ? 'company' : 'supplier',
        companyOwned: Boolean(index % 2),
        segments: [
          {
            ...input.segments[0]!,
            flightNumber: 'DEMO-' + (index + 1),
            departureAt,
            arrivalAt,
          },
        ],
        fare: {
          ...input.fare,
          purchase: '100.10',
          validFrom: now,
          validTo: departureAt,
        },
      },
      () => undefined,
      now,
      'کاربر نمایشی',
    );
  });
}
export interface PreviewQuery {
  search: string;
  status: string;
  supply: string;
  airline: string;
  from: string;
  to: string;
  sort: 'departure' | 'title' | 'updated';
  direction: 'asc' | 'desc';
  page: number;
}
export const initialQuery: PreviewQuery = {
  search: '',
  status: 'all',
  supply: 'all',
  airline: '',
  from: '',
  to: '',
  sort: 'departure',
  direction: 'asc',
  page: 1,
};
export function queryProducts(
  products: readonly Product[],
  query: PreviewQuery,
) {
  const search = query.search.trim().toLocaleLowerCase('fa-IR');
  const rows = products
    .filter((product) => {
      const segment = product.definition.segments[0]!;
      return (
        (product.definition.title + ' ' + segment.flightNumber)
          .toLocaleLowerCase('fa-IR')
          .includes(search) &&
        (query.status === 'all' || product.status === query.status) &&
        (query.supply === 'all' ||
          product.definition.supplyType === query.supply) &&
        (!query.airline || segment.airlineId === query.airline) &&
        (!query.from || segment.departureAt.slice(0, 10) >= query.from) &&
        (!query.to || segment.departureAt.slice(0, 10) <= query.to)
      );
    })
    .sort((a, b) => {
      const value = (p: Product) =>
        query.sort === 'title'
          ? p.definition.title
          : query.sort === 'updated'
            ? p.history.at(-1)!.at
            : p.definition.segments[0]!.departureAt;
      const comparison =
        value(a).localeCompare(value(b), 'fa') || a.id.localeCompare(b.id);
      return query.direction === 'asc' ? comparison : -comparison;
    });
  const pages = Math.max(1, Math.ceil(rows.length / 6));
  const page = Math.max(1, Math.min(pages, query.page));
  return {
    total: rows.length,
    pages,
    page,
    rows: rows.slice((page - 1) * 6, page * 6),
  };
}
export function replacePreview(
  products: readonly Product[],
  next: Product,
  expectedVersion?: number,
): Product[] {
  const existing = products.find((p) => p.id === next.id);
  if (expectedVersion === undefined) {
    if (existing) throw new Error('Conflict: شناسه تکراری است.');
    return [...products, next];
  }
  if (!existing || existing.version !== expectedVersion)
    throw new Error('Conflict: نسخه تغییر کرده است؛ فرم را دوباره باز کنید.');
  return products.map((p) => (p.id === next.id ? next : p));
}
export function displayTime(value: string, zone = 'Asia/Tehran') {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: zone,
  }).format(new Date(value));
}
