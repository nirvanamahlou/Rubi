import { BadRequestException } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import {
  moneyUnits,
  moneyDecimal,
  type FloatingTourMoney,
  type FloatingTourGroup,
  type FloatingTourSaleRow,
  type FloatingTourImportOptions,
  type FloatingTourStay,
  type TourPackageInputV1,
} from '@nora/contracts';

const fail = (message: string): never => {
  throw new BadRequestException(message);
};
const text = (xml: string) =>
  xml
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([a-f0-9]+);/gi, (_, x: string) =>
      String.fromCodePoint(parseInt(x, 16)),
    )
    .replace(/&#(\d+);/g, (_, x: string) => String.fromCodePoint(Number(x)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
const attr = (xml: string, name: string) =>
  new RegExp(`\\b${name}=["']([^"']*)["']`).exec(xml)?.[1] ?? '';
export const floatingHotelKey = (name: string) =>
  name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
const digits = (s: string) =>
  s.replace(/[۰-۹٠-٩]/g, (x) =>
    String(
      '۰۱۲۳۴۵۶۷۸۹'.indexOf(x) >= 0
        ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)
        : '٠١٢٣٤٥٦٧٨٩'.indexOf(x),
    ),
  );
export type FloatingCell = { value: string; format: string; numeric: boolean };
export function readFloatingWorkbook(bytes: Uint8Array): FloatingCell[][] {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    return fail('فایل اکسل معتبر نیست یا از محدودیت مجاز عبور کرده است.');
  let entries = 0,
    size = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (
          ++entries > 300 ||
          (size += file.originalSize) > 20 * 1024 * 1024 ||
          /\.\.|\\|vba|externalLinks|embeddings|connections|activeX/i.test(
            file.name,
          )
        )
          throw new Error('Unsafe workbook');
        return /\.xml$|\.rels$/.test(file.name);
      },
    });
  } catch {
    return fail('فایل اکسل معتبر نیست یا از محدودیت مجاز عبور کرده است.');
  }
  for (const file of Object.values(files))
    if (
      /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|<(?:\w+:)?(?:f|externalLink)\b/i.test(
        strFromU8(file),
      )
    )
      return fail('فرمول یا ارتباط خارجی در فایل مجاز نیست.');
  const workbook = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());
  const sheetTag = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].find(
    (m) => text(attr(m[1]!, 'name')) === 'قیمت تور',
  );
  if (!sheetTag) return fail('Sheet قیمت تور یافت نشد.');
  const rels = strFromU8(
    files['xl/_rels/workbook.xml.rels'] ?? new Uint8Array(),
  );
  const relation = [...rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].find(
    (m) => attr(m[1]!, 'Id') === attr(sheetTag[1]!, 'r:id'),
  );
  const target = relation ? attr(relation[1]!, 'Target') : '';
  const path = target.startsWith('/xl/') ? target.slice(1) : `xl/${target}`;
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path) || !files[path])
    return fail('ساختار XLSX قابل خواندن نیست.');
  const shared = [
    ...strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array()).matchAll(
      /<si\b[^>]*>([\s\S]*?)<\/si>/g,
    ),
  ].map((m) =>
    [...m[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((t) => text(t[1]!))
      .join(''),
  );
  const styles = strFromU8(files['xl/styles.xml'] ?? new Uint8Array());
  const formats = new Map(
    [...styles.matchAll(/<numFmt\b([^>]*)\/?\s*>/g)].map((m) => [
      attr(m[1]!, 'numFmtId'),
      text(attr(m[1]!, 'formatCode')),
    ]),
  );
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
  const cellFormats = [...xfs.matchAll(/<xf\b([^>]*)>/g)].map(
    (m) =>
      formats.get(attr(m[1]!, 'numFmtId')) ??
      (['5', '6', '7', '8', '42', '44'].includes(attr(m[1]!, 'numFmtId'))
        ? '$'
        : ''),
  );
  const rows: FloatingCell[][] = [];
  for (const row of strFromU8(files[path]!).matchAll(
    /<row\b[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    if (rows.length >= 2001) return fail('حداکثر ۲۰۰۰ ردیف قیمت مجاز است.');
    const cells: FloatingCell[] = [];
    for (const cell of row[1]!.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const address = /^[A-Z]+/.exec(attr(cell[1]!, 'r'))?.[0];
      if (!address) return fail('ساختار XLSX قابل خواندن نیست.');
      const column =
        [...address].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (column > 50) return fail('ساختار XLSX قابل خواندن نیست.');
      const type = attr(cell[1]!, 't');
      if (type === 'e' || /<(?:\w+:)?f\b/.test(cell[2]!))
        return fail('فرمول یا ارتباط خارجی در فایل مجاز نیست.');
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell[2]!)?.[1] ?? '';
      const value =
        type === 's'
          ? shared[Number(raw)]
          : type === 'inlineStr'
            ? [...cell[2]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
                .map((t) => text(t[1]!))
                .join('')
            : text(raw);
      if (value === undefined || value.length > 1000)
        return fail('ساختار XLSX قابل خواندن نیست.');
      cells[column] = {
        value: value.trim(),
        format: cellFormats[Number(attr(cell[1]!, 's') || 0)] ?? '',
        numeric: !type || type === 'n',
      };
    }
    rows.push(cells);
  }
  return rows;
}
export function floatingMoney(cell?: FloatingCell): FloatingTourMoney[] {
  if (!cell?.value.trim()) return [];
  const source = digits(cell.value)
    .replace(/[,،٬\s]/g, '')
    .replace(/٫/g, '.');
  const parts = source.split('+');
  const result = new Map<FloatingTourMoney['currency'], bigint>();
  for (const part of parts) {
    const format = cell.format.replace(/\[\$([^\]]*)\]/g, (_, token: string) =>
      token.replace(/-[A-Fa-f0-9]+$/, ''),
    );
    const hints = (part + (cell.numeric ? format : '')).toUpperCase();
    const currencies = [
      /(?:\$|USD|دلار)/.test(hints) && 'USD',
      /(?:€|EUR|یورو)/.test(hints) && 'EUR',
      /(?:₺|TRY|لیر)/.test(hints) && 'TRY',
    ].filter(Boolean) as FloatingTourMoney['currency'][];
    if (currencies.length > 1)
      return fail('استفاده هم‌زمان از چند ارز خارجی در یک ردیف مجاز نیست.');
    const currency = currencies[0] ?? 'IRR';
    const amount = part.replace(
      /USD|EUR|TRY|IRR|IRT|دلار|یورو|لیر|تومان|ریال|[$€₺]/gi,
      '',
    );
    if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/.test(amount))
      return fail('مبلغ قیمت معتبر نیست.');
    const rial = currency === 'IRR' && !/IRR|ریال/i.test(hints) ? 10n : 1n;
    result.set(
      currency,
      (result.get(currency) ?? 0n) + moneyUnits(amount) * rial,
    );
  }
  return [...result].map(([currency, amount]) => ({
    currency,
    amount: moneyDecimal(amount),
  }));
}
const add = (a: FloatingTourMoney[], b: FloatingTourMoney[]) => {
  const sums = new Map<FloatingTourMoney['currency'], bigint>();
  for (const m of [...a, ...b])
    sums.set(m.currency, (sums.get(m.currency) ?? 0n) + moneyUnits(m.amount));
  return [...sums].map(([currency, amount]) => ({
    currency,
    amount: moneyDecimal(amount),
  }));
};
export function floatingPrices(
  cells: Record<string, FloatingCell | undefined>,
) {
  const adult = floatingMoney(cells['flight per person']);
  const child = cells['flight child w bed']?.value
    ? floatingMoney(cells['flight child w bed'])
    : adult;
  const groups: [FloatingTourGroup, string][] = [
    ['double', 'dbl'],
    ['single', 'sgl'],
    ['extra', 'extra'],
    ['childBed', 'chd w bed'],
    ['childNoBed', 'child no bed'],
    ['infant', 'infant'],
  ];
  const prices: FloatingTourSaleRow['prices'] = {};
  const foreign = new Set<string>();
  for (const [group, column] of groups) {
    const base = floatingMoney(cells[column]);
    if (!base.length) continue;
    const flight =
      cells[`add_flight_${column}`]?.value.toLowerCase() === 'no' ||
      group === 'infant' ||
      (group === 'childNoBed' && base.every((m) => m.currency === 'IRR'))
        ? []
        : group === 'childBed' || group === 'childNoBed'
          ? child
          : adult;
    prices[group] = add(base, flight);
    for (const m of prices[group]!)
      if (m.currency !== 'IRR') foreign.add(m.currency);
  }
  if (foreign.size > 1)
    return fail('استفاده هم‌زمان از چند ارز خارجی در یک ردیف مجاز نیست.');
  if (!Object.keys(prices).length) return fail('حداقل یک قیمت فروش لازم است.');
  return { prices, commission: floatingMoney(cells.commission) };
}
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function floatingDate(cell: FloatingCell): string {
  const value = digits(cell.value);
  if (cell.numeric && /^\d+(?:\.0+)?$/.test(value)) {
    const serial = Number(value);
    if (serial < 61 || serial > 100000) return fail('تاریخ حرکت معتبر نیست.');
    return iso(Date.UTC(1899, 11, 30) + serial * 86400000);
  }
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  if (!match) return fail('تاریخ حرکت معتبر نیست.');
  const y = Number(match[1]),
    m = Number(match[2]),
    d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return fail('تاریخ حرکت معتبر نیست.');
  if (y >= 1700 && y <= 2200) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (iso(Date.parse(date)) !== date) return fail('تاریخ حرکت معتبر نیست.');
    return date;
  }
  if (y < 1300 || y > 1600) return fail('تاریخ حرکت معتبر نیست.');
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  let lo = Math.floor(Date.UTC(y + 620, 0, 1) / 86400000),
    hi = Math.floor(Date.UTC(y + 623, 0, 1) / 86400000);
  const key = y * 10000 + m * 100 + d;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = fmt.formatToParts(new Date(mid * 86400000));
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const actual = n('year') * 10000 + n('month') * 100 + n('day');
    if (actual === key) return iso(mid * 86400000);
    if (actual < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return fail('تاریخ حرکت معتبر نیست.');
}
export interface FloatingHotelReference {
  id: string;
  name: string;
  englishName?: string;
  cityId: string;
}
export function parseFloatingRows(
  workbook: FloatingCell[][],
  options: FloatingTourImportOptions,
  tour: TourPackageInputV1,
  hotels: FloatingHotelReference[],
  previous: FloatingTourSaleRow[] = [],
): FloatingTourSaleRow[] {
  const headers =
    workbook[0]?.map((c) =>
      c?.value
        .trim()
        .toLowerCase()
        .replace(/^room type$/, 'room'),
    ) ?? [];
  if (headers.includes('hotel_name_1'))
    return parseDedicatedFloatingRows(
      workbook,
      options,
      tour,
      hotels,
      previous,
    );
  for (const h of [
    'departure_date',
    'hotel_name',
    'room',
    'service',
    'dbl',
    'sgl',
    'chd w bed',
    'child no bed',
    'infant',
    'flight per person',
    'flight child w bed',
    'extra',
  ])
    if (!headers.includes(h)) return fail(`Missing Excel column: ${h}`);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length)
    return fail('ستون تکراری در فایل مجاز نیست.');
  const rows: FloatingTourSaleRow[] = [];
  const duplicate = new Set<string>();
  for (let index = 1; index < workbook.length; index++) {
    const source = workbook[index]!;
    if (!source.some((c) => c?.value)) continue;
    try {
      const fields = Object.fromEntries(headers.map((h, i) => [h, source[i]]));
      const name = floatingHotelKey(fields.hotel_name?.value ?? '');
      const matches = hotels.filter((hotel) =>
        [hotel.name, hotel.englishName ?? ''].some(
          (n) => floatingHotelKey(n) === name,
        ),
      );
      if (!name || matches.length !== 1)
        return fail('نام هتل یافت نشد یا مبهم است.');
      const hotel = matches[0]!;
      const date =
        options.mode === 'DATED'
          ? floatingDate(
              fields.departure_date ?? {
                value: '',
                format: '',
                numeric: false,
              },
            )
          : null;
      let room = fields.room?.value.trim() ?? '';
      if (!room) {
        const priorRooms = [
          ...new Set(
            previous
              .filter(
                (row) => row.startsOn === date && row.nights === options.nights,
              )
              .flatMap((row) =>
                row.stays
                  .filter((s) => s.hotelId === hotel.id)
                  .map((s) => s.room),
              ),
          ),
        ];
        if (priorRooms.length !== 1) return fail('نوع اتاق را مشخص کنید.');
        room = priorRooms[0]!;
      }
      const key = JSON.stringify([date, hotel.id, floatingHotelKey(room)]);
      if (duplicate.has(key))
        return fail('هتل و نوع اتاق در این تاریخ تکراری است.');
      duplicate.add(key);
      const stay: FloatingTourStay = {
        hotelId: hotel.id,
        hotelName: hotel.englishName || hotel.name,
        cityId: hotel.cityId,
        room,
        service: (fields.service?.value ?? '')
          .replace(/^\s*\d\s*\*\s*/, '')
          .trim(),
        location: fields.loc?.value ?? '',
        nights: options.nights,
      };
      rows.push({
        sourceRows: [index + 1],
        startsOn: date,
        endsOn: date ? iso(Date.parse(date) + options.nights * 86400000) : null,
        nights: options.nights,
        stays: [stay],
        ...floatingPrices(fields),
      });
    } catch (e) {
      return fail(
        `Row ${index + 1}: ${e instanceof Error ? e.message : 'Invalid row'}`,
      );
    }
  }
  if (!rows.length) return fail('فایل قیمت خالی است.');
  if (!options.combined) return rows;
  const combined: FloatingTourSaleRow[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i]!,
      b = rows[i + 1];
    const definitions = tour.details?.destinations;
    if (
      !b ||
      a.startsOn !== b.startsOn ||
      a.stays[0]!.hotelId === b.stays[0]!.hotelId ||
      JSON.stringify(a.prices) !== JSON.stringify(b.prices) ||
      JSON.stringify(a.commission) !== JSON.stringify(b.commission) ||
      definitions?.length !== 2 ||
      definitions[0]!.nights + definitions[1]!.nights !== options.nights ||
      definitions[0]!.cityId !== a.stays[0]!.cityId ||
      definitions[1]!.cityId !== b.stays[0]!.cityId
    )
      return fail('ترتیب دو هتل، شب‌ها و قیمت مشترک تور ترکیبی را بررسی کنید.');
    combined.push({
      ...a,
      sourceRows: [...a.sourceRows, ...b.sourceRows],
      stays: [
        { ...a.stays[0]!, nights: definitions[0]!.nights },
        { ...b.stays[0]!, nights: definitions[1]!.nights },
      ],
    });
  }
  return combined;
}

/** Explicit two-hotel template: one package row, one price, separate hotel nights. */
function parseDedicatedFloatingRows(
  workbook: FloatingCell[][],
  options: FloatingTourImportOptions,
  tour: TourPackageInputV1,
  hotels: FloatingHotelReference[],
  previous: FloatingTourSaleRow[],
) {
  if (!options.combined || !tour.details?.isCombined)
    return fail('قالب ترکیبی فقط برای تور ترکیبی مجاز است.');
  const headers = workbook[0]!.map((c) => c.value.toLowerCase().trim());
  if (new Set(headers).size !== headers.length)
    return fail('ستون تکراری در فایل مجاز نیست.');
  const result: FloatingTourSaleRow[] = [];
  const identities = new Set<string>();
  const baseHeaders = [
    'departure_date',
    'hotel_name',
    'loc',
    'room',
    'service',
    'dbl',
    'sgl',
    'extra',
    'chd w bed',
    'child no bed',
    'infant',
    'flight per person',
    'flight child w bed',
  ];
  for (let i = 1; i < workbook.length; i++) {
    if (!workbook[i]!.some((cell) => cell?.value)) continue;
    const fields = Object.fromEntries(
      headers.map((h, j) => [h, workbook[i]![j]]),
    );
    const nights = [1, 2].map((n) => Number(fields[`nights_${n}`]?.value));
    if (
      nights.some((n) => !Number.isSafeInteger(n) || n < 1) ||
      nights[0]! + nights[1] !== options.nights
    )
      return fail(
        `Row ${i + 1}: مجموع شب‌های دو هتل باید با تعداد شب بازه برابر باشد.`,
      );
    const selected = [1, 2].map((n) => {
      const name = floatingHotelKey(fields[`hotel_name_${n}`]?.value ?? '');
      const found = hotels.filter((h) =>
        [h.name, h.englishName ?? ''].some(
          (value) => floatingHotelKey(value) === name,
        ),
      );
      if (!name || found.length !== 1)
        return fail(`Row ${i + 1}: نام هتل یافت نشد یا مبهم است.`);
      return found[0]!;
    });
    const combinedDefinition = {
      ...tour,
      details: {
        ...tour.details,
        version: 1 as const,
        destinations: selected.map((h, n) => ({
          cityId: h.cityId,
          nights: nights[n]!,
        })),
      },
    };
    const controls = [
      'dbl',
      'sgl',
      'extra',
      'chd w bed',
      'child no bed',
      'infant',
    ].map((g) => `add_flight_${g}`);
    for (const key of controls)
      if (
        fields[key]?.value &&
        !['yes', 'no'].includes(fields[key]!.value.toLowerCase())
      )
        return fail(`Row ${i + 1}: ${key}: YES / NO`);
    const columns = [...baseHeaders, 'commission', ...controls];
    const blank: FloatingCell = { value: '', format: '', numeric: false };
    const paired = [
      columns.map((value) => ({ ...blank, value })),
      ...[1, 2].map((n) =>
        columns.map(
          (key) =>
            fields[
              (
                {
                  hotel_name: `hotel_name_${n}`,
                  loc: `loc_${n}`,
                  room: `room_${n}`,
                  service: `service_${n}`,
                } as Record<string, string>
              )[key] ?? key
            ] ?? blank,
        ),
      ),
    ];
    const row = parseFloatingRows(
      paired,
      options,
      combinedDefinition,
      hotels,
      previous,
    )[0]!;
    const key = JSON.stringify([
      row.startsOn,
      row.stays.map((s) => [s.hotelId, floatingHotelKey(s.room)]),
    ]);
    if (identities.has(key))
      return fail(`Row ${i + 1}: ترکیب هتل و اتاق تکراری است.`);
    identities.add(key);
    result.push({ ...row, sourceRows: [i + 1] });
  }
  if (!result.length) return fail('فایل قیمت خالی است.');
  return result;
}
