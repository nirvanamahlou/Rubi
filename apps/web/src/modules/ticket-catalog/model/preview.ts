import {
  createProduct,
  type Product,
  type ProductInput,
  type Reference,
  type TransportType,
} from './catalog';

export const statusLabels = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  paused: 'توقف فروش',
  cancelled: 'لغو بلیت',
} as const;
export const supplyLabels = {
  company: 'ظرفیت شرکت',
  allotment: 'سهمیه',
  charter: 'چارتر',
  supplier: 'تأمین‌کننده / API',
} as const;
export const transportLabels = {
  flight: 'هواپیما',
  train: 'قطار',
  bus: 'اتوبوس',
} as const;
export const journeyLabels = {
  'one-way': 'یک‌طرفه',
  outbound: 'رفت',
  return: 'برگشت',
} as const;

export function emptyInput(transport: TransportType = 'flight'): ProductInput {
  return {
    title: '',
    transport,
    journeyRole: 'one-way',
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
        departureZone: transport === 'flight' ? 'UTC' : 'Asia/Tehran',
        arrivalZone: transport === 'flight' ? 'UTC' : 'Asia/Tehran',
        originTerminal: '',
        destinationTerminal: '',
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

type SampleDefinition = {
  transport: TransportType;
  role: ProductInput['journeyRole'];
  group?: string;
  number: string;
  operator: string;
  vehicle: string;
  origin: string;
  destination: string;
  originTerminal: string;
  destinationTerminal: string;
  departureDay: number;
  durationHours: number;
  capacity: number;
  purchase: string;
  connection?: {
    number: string;
    destination: string;
    destinationTerminal: string;
    waitHours: number;
    durationHours: number;
  };
};

export function catalogSamples(now: string): Product[] {
  const samples: SampleDefinition[] = [
    {
      transport: 'flight',
      role: 'outbound',
      group: 'sample-flight-rt',
      number: 'W5-1042',
      operator: 'هواپیمایی معراج',
      vehicle: 'ایرباس A320',
      origin: 'تهران',
      destination: 'استانبول',
      originTerminal: 'فرودگاه امام خمینی',
      destinationTerminal: 'فرودگاه استانبول',
      departureDay: 7,
      durationHours: 3.5,
      capacity: 70,
      purchase: '18500000',
    },
    {
      transport: 'flight',
      role: 'return',
      group: 'sample-flight-rt',
      number: 'W5-1043',
      operator: 'هواپیمایی معراج',
      vehicle: 'ایرباس A320',
      origin: 'استانبول',
      destination: 'تهران',
      originTerminal: 'فرودگاه استانبول',
      destinationTerminal: 'فرودگاه امام خمینی',
      departureDay: 12,
      durationHours: 3.5,
      capacity: 70,
      purchase: '18500000',
    },
    {
      transport: 'flight',
      role: 'one-way',
      number: 'EP-602',
      operator: 'ایران ایرتور',
      vehicle: 'MD-82',
      origin: 'مشهد',
      destination: 'تهران',
      originTerminal: 'فرودگاه شهید هاشمی‌نژاد',
      destinationTerminal: 'فرودگاه مهرآباد',
      departureDay: 9,
      durationHours: 1.5,
      capacity: 45,
      purchase: '7600000',
      connection: {
        number: 'EP-610',
        destination: 'شیراز',
        destinationTerminal: 'فرودگاه شهید دستغیب',
        waitHours: 2,
        durationHours: 1.5,
      },
    },
    {
      transport: 'train',
      role: 'outbound',
      group: 'sample-train-rt',
      number: 'R4-218',
      operator: 'رجا',
      vehicle: 'قطار چهار تخته',
      origin: 'تهران',
      destination: 'مشهد',
      originTerminal: 'ایستگاه راه‌آهن تهران',
      destinationTerminal: 'ایستگاه راه‌آهن مشهد',
      departureDay: 10,
      durationHours: 11,
      capacity: 160,
      purchase: '4200000',
    },
    {
      transport: 'train',
      role: 'return',
      group: 'sample-train-rt',
      number: 'R4-219',
      operator: 'رجا',
      vehicle: 'قطار چهار تخته',
      origin: 'مشهد',
      destination: 'تهران',
      originTerminal: 'ایستگاه راه‌آهن مشهد',
      destinationTerminal: 'ایستگاه راه‌آهن تهران',
      departureDay: 15,
      durationHours: 11,
      capacity: 160,
      purchase: '4200000',
    },
    {
      transport: 'train',
      role: 'one-way',
      number: 'F5-330',
      operator: 'فدک',
      vehicle: 'قطار پنج ستاره',
      origin: 'تهران',
      destination: 'شیراز',
      originTerminal: 'ایستگاه راه‌آهن تهران',
      destinationTerminal: 'ایستگاه راه‌آهن شیراز',
      departureDay: 14,
      durationHours: 13,
      capacity: 120,
      purchase: '6900000',
    },
    {
      transport: 'bus',
      role: 'outbound',
      group: 'sample-bus-rt',
      number: 'VIP-712',
      operator: 'رویال سفر',
      vehicle: 'VIP تخت‌شو',
      origin: 'تهران',
      destination: 'اصفهان',
      originTerminal: 'پایانه بیهقی',
      destinationTerminal: 'پایانه کاوه',
      departureDay: 8,
      durationHours: 6,
      capacity: 25,
      purchase: '1800000',
    },
    {
      transport: 'bus',
      role: 'return',
      group: 'sample-bus-rt',
      number: 'VIP-713',
      operator: 'رویال سفر',
      vehicle: 'VIP تخت‌شو',
      origin: 'اصفهان',
      destination: 'تهران',
      originTerminal: 'پایانه کاوه',
      destinationTerminal: 'پایانه بیهقی',
      departureDay: 11,
      durationHours: 6,
      capacity: 25,
      purchase: '1800000',
    },
    {
      transport: 'bus',
      role: 'one-way',
      number: 'VIP-408',
      operator: 'سیر و سفر',
      vehicle: 'VIP 25 نفره',
      origin: 'تهران',
      destination: 'رشت',
      originTerminal: 'پایانه غرب',
      destinationTerminal: 'پایانه گیل',
      departureDay: 13,
      durationHours: 5.5,
      capacity: 25,
      purchase: '1550000',
    },
  ];
  const base = Date.parse(now);
  return samples.map((sample, index) => {
    const departureAt = new Date(
      base + sample.departureDay * 86_400_000 + 8 * 3_600_000,
    ).toISOString();
    const arrivalAt = new Date(
      Date.parse(departureAt) + sample.durationHours * 3_600_000,
    ).toISOString();
    const input = emptyInput(sample.transport);
    const connectionDepartureAt = sample.connection
      ? new Date(
          Date.parse(arrivalAt) + sample.connection.waitHours * 3_600_000,
        ).toISOString()
      : '';
    const connectionArrivalAt = sample.connection
      ? new Date(
          Date.parse(connectionDepartureAt) +
            sample.connection.durationHours * 3_600_000,
        ).toISOString()
      : '';
    const finalDestination =
      sample.connection?.destination || sample.destination;
    const product = createProduct(
      `sample-ticket-${index + 1}`,
      {
        ...input,
        title: `${sample.number}${sample.connection ? ' ترکیبی' : ''} • ${sample.origin} به ${finalDestination}`,
        journeyRole: sample.role,
        ...(sample.group ? { tripGroupId: sample.group } : {}),
        display: {
          operator: sample.operator,
          vehicle: sample.vehicle,
          origin: sample.origin,
          destination: finalDestination,
        },
        totalCapacity: sample.capacity,
        supplyType: index % 3 === 0 ? 'company' : 'supplier',
        companyOwned: index % 3 === 0,
        rules:
          'نمونه ساختگی برای بررسی فرم؛ قوانین نهایی هنگام تعریف بلیت وارد می‌شود.',
        segments: [
          {
            ...input.segments[0]!,
            flightNumber: sample.number,
            originTerminal: sample.originTerminal,
            destinationTerminal: sample.destinationTerminal,
            departureAt,
            arrivalAt,
            departureZone:
              sample.transport === 'flight' && sample.origin === 'استانبول'
                ? 'Europe/Istanbul'
                : 'Asia/Tehran',
            arrivalZone:
              sample.transport === 'flight' && sample.destination === 'استانبول'
                ? 'Europe/Istanbul'
                : 'Asia/Tehran',
          },
          ...(sample.connection
            ? [
                {
                  ...input.segments[0]!,
                  flightNumber: sample.connection.number,
                  originTerminal: sample.destinationTerminal,
                  destinationTerminal: sample.connection.destinationTerminal,
                  departureAt: connectionDepartureAt,
                  arrivalAt: connectionArrivalAt,
                  departureZone: 'Asia/Tehran',
                  arrivalZone: 'Asia/Tehran',
                },
              ]
            : []),
        ],
        fare: {
          ...input.fare,
          purchase: sample.purchase,
          currencyCode: 'IRR',
          validFrom: now,
          validTo: new Date(Date.parse(departureAt) - 3_600_000).toISOString(),
        },
      },
      () => undefined,
      now,
      'سیستم نمونه',
    );
    return activateCatalogSample(product, now);
  });
}

export function activateCatalogSample(product: Product, at: string): Product {
  if (!product.id.startsWith('sample-ticket-') || product.status !== 'draft')
    return product;
  const version = product.version + 1;
  return {
    ...product,
    status: 'active',
    version,
    history: [
      ...product.history,
      {
        version,
        action: 'active',
        at,
        actor: 'سیستم نمونه',
        reason: 'فعال‌سازی بلیت نمونه برای نمایش کنترل توقف فروش',
      },
    ],
  };
}

export function groupProductsForCards(
  products: readonly Product[],
): Product[][] {
  const groups: Product[][] = [];
  const tripGroups = new Map<string, Product[]>();
  for (const product of products) {
    const groupId = product.definition.tripGroupId;
    if (!groupId) {
      groups.push([product]);
      continue;
    }
    const existing = tripGroups.get(groupId);
    if (existing) existing.push(product);
    else {
      const group = [product];
      tripGroups.set(groupId, group);
      groups.push(group);
    }
  }
  const rank = { outbound: 0, return: 1, 'one-way': 2 } as const;
  return groups.map((group) =>
    group.length > 1
      ? [...group].sort(
          (left, right) =>
            rank[left.definition.journeyRole] -
            rank[right.definition.journeyRole],
        )
      : group,
  );
}

// Backward-compatible internal alias while existing tests and branches migrate.
export const previewSamples = catalogSamples;

export interface PreviewQuery {
  search: string;
  status: string;
  supply: string;
  transport: string;
  airline: string;
  originCityId: string;
  destinationCityId: string;
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
  transport: 'all',
  airline: '',
  originCityId: 'all',
  destinationCityId: 'all',
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
      const lastSegment = product.definition.segments.at(-1)!;
      const display = product.definition.display;
      return (
        [
          product.definition.title,
          ...product.definition.segments.map((item) => item.flightNumber),
          display?.operator,
          display?.origin,
          display?.destination,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('fa-IR')
          .includes(search) &&
        (query.status === 'all' || product.status === query.status) &&
        (query.supply === 'all' ||
          product.definition.supplyType === query.supply) &&
        (query.transport === 'all' ||
          product.definition.transport === query.transport) &&
        (!query.airline || segment.airlineId === query.airline) &&
        (query.originCityId === 'all' ||
          segment.originCityId === query.originCityId) &&
        (query.destinationCityId === 'all' ||
          lastSegment.destinationCityId === query.destinationCityId) &&
        (!query.from ||
          (Boolean(segment.departureAt) &&
            segment.departureAt.slice(0, 10) >= query.from)) &&
        (!query.to ||
          (Boolean(segment.departureAt) &&
            segment.departureAt.slice(0, 10) <= query.to))
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

export interface RouteProductCount {
  key: string;
  originCityId: string;
  destinationCityId: string;
  origin: string;
  destination: string;
  count: number;
}

export function countProductsByRoute(
  products: readonly Product[],
): RouteProductCount[] {
  const routes = new Map<string, RouteProductCount>();
  for (const product of products) {
    const segment = product.definition.segments[0]!;
    const lastSegment = product.definition.segments.at(-1)!;
    const key = `${segment.originCityId}::${lastSegment.destinationCityId}`;
    const existing = routes.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    routes.set(key, {
      key,
      originCityId: segment.originCityId,
      destinationCityId: lastSegment.destinationCityId,
      origin: product.definition.display?.origin || 'مبدأ نامشخص',
      destination: product.definition.display?.destination || 'مقصد نامشخص',
      count: 1,
    });
  }
  return [...routes.values()].sort(
    (left, right) =>
      right.count - left.count || left.key.localeCompare(right.key),
  );
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

export type RepeatCadence = 'weekly' | 'monthly';
function shiftIso(value: string, cadence: RepeatCadence, count: number) {
  const date = new Date(value);
  if (cadence === 'weekly') date.setUTCDate(date.getUTCDate() + count * 7);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString();
}
export function moveDefinitionToDate(
  source: ProductInput,
  departureDate: string,
): ProductInput {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(departureDate))
    throw new Error('تاریخ اولین بلیت جدید را انتخاب کنید.');
  const selectedDay = new Date(departureDate + 'T00:00:00.000Z');
  if (
    Number.isNaN(selectedDay.getTime()) ||
    selectedDay.toISOString().slice(0, 10) !== departureDate
  )
    throw new Error('تاریخ اولین بلیت جدید معتبر نیست.');
  const firstDeparture = new Date(source.segments[0]?.departureAt ?? '');
  if (Number.isNaN(firstDeparture.getTime()))
    throw new Error('زمان حرکت بلیت مبدأ معتبر نیست.');
  const sourceDay = Date.UTC(
    firstDeparture.getUTCFullYear(),
    firstDeparture.getUTCMonth(),
    firstDeparture.getUTCDate(),
  );
  const delta = selectedDay.getTime() - sourceDay;
  const shift = (value: string) =>
    new Date(Date.parse(value) + delta).toISOString();
  const next = structuredClone(source);
  next.tripGroupId = undefined;
  next.journeyRole = 'one-way';
  next.segments = next.segments.map((segment) => ({
    ...segment,
    departureAt: shift(segment.departureAt),
    arrivalAt: shift(segment.arrivalAt),
  }));
  next.fare = {
    ...next.fare,
    validFrom: shift(next.fare.validFrom),
    validTo: shift(next.fare.validTo),
  };
  return next;
}
export function repeatDefinition(
  source: ProductInput,
  cadence: RepeatCadence,
  occurrence: number,
): ProductInput {
  if (!Number.isSafeInteger(occurrence) || occurrence < 1 || occurrence > 24)
    throw new Error('تعداد تکرار باید بین ۱ تا ۲۴ باشد.');
  const next = structuredClone(source);
  next.tripGroupId = undefined;
  next.journeyRole = 'one-way';
  next.segments = next.segments.map((segment) => ({
    ...segment,
    departureAt: shiftIso(segment.departureAt, cadence, occurrence),
    arrivalAt: shiftIso(segment.arrivalAt, cadence, occurrence),
  }));
  next.fare = {
    ...next.fare,
    validFrom: shiftIso(next.fare.validFrom, cadence, occurrence),
    validTo: shiftIso(next.fare.validTo, cadence, occurrence),
  };
  return next;
}

export interface CatalogBrowserSnapshot {
  products: Product[];
  references: Reference[];
}
export const catalogStorageKey = 'rubi.ticket-catalog.browser.v1';
export function parseCatalogSnapshot(
  raw: string | null,
): CatalogBrowserSnapshot | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as CatalogBrowserSnapshot;
    if (
      !value ||
      !Array.isArray(value.products) ||
      !Array.isArray(value.references) ||
      value.products.some(
        (product) =>
          !product ||
          typeof product.id !== 'string' ||
          !Number.isSafeInteger(product.version) ||
          !product.definition ||
          !['flight', 'train', 'bus'].includes(product.definition.transport) ||
          !Array.isArray(product.definition.segments),
      )
    )
      return undefined;
    return value;
  } catch {
    return undefined;
  }
}
export function displayTime(value: string, zone = 'Asia/Tehran') {
  if (!value) return 'بدون زمان‌بندی';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: zone,
  }).format(new Date(value));
}
