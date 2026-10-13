import type { HotelOccupancyRateV1 } from '@nora/contracts';

export type ImportedOccupancy = HotelOccupancyRateV1 & {
  hotel: string;
  room: string;
  capacity: string;
  sourceRow: number;
};
const date = (value: string) => {
  const text = /^\d+(?:\.\d+)?$/.test(value)
    ? new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000)
        .toISOString()
        .slice(0, 10)
    : value.slice(0, 10);
  const stamp = Date.parse(`${text}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(stamp) ||
    new Date(stamp).toISOString().slice(0, 10) !== text
  )
    throw new Error('تاریخ نرخ نامعتبر است.');
  return text;
};
export function occupancyImportRows(rows: readonly string[][]): {
  rows: ImportedOccupancy[];
  issues: string[];
  excluded: number;
} {
  const header = rows.findIndex(
    (r) =>
      r[0]?.trim() === 'هتل' &&
      r[3]?.trim() === 'اتاق' &&
      r[8]?.trim() === 'ترکیب اقامت',
  );
  if (header < 0)
    throw new Error('ستون‌های استاندارد شیت خروجی نورا پیدا نشد.');
  const result: ImportedOccupancy[] = [],
    issues: string[] = [];
  let excluded = 0;
  rows.slice(header + 1).forEach((r, index) => {
    const sourceRow = header + index + 2;
    if (!r[0]?.trim()) return;
    if (/^IN\s*DBL\s*PP$/i.test(r[8]?.trim() ?? '')) {
      excluded++;
      return;
    }
    try {
      if (!r[3]?.trim() || !r[8]?.trim())
        throw new Error('نام اتاق و ترکیب اقامت ضروری است.');
      const adults = Number(r[5]),
        children = Number(r[6]);
      if (
        !Number.isInteger(adults) ||
        adults < 1 ||
        adults > 20 ||
        !Number.isInteger(children) ||
        children < 0 ||
        children > 10
      )
        throw new Error('تعداد بزرگسال/کودک نامعتبر است.');
      let ranges = [
        ...(r[9] ?? '').matchAll(
          /(\d+(?:\.\d+)?)\s*تا\s*(کمتر از\s*)?(\d+(?:\.\d+)?)\s*سال/g,
        ),
      ].map((m) => ({
        min: Number(m[1]),
        maxExclusive: m[2]
          ? Number(m[3])
          : Math.round(Number(m[3]) * 100 + 1) / 100,
      }));
      // Original Nora output uses 0-11.99 notation. If its child column
      // omits a slot, the explicit composition must supply every range.
      // Never synthesize or repeat a missing child's age band.
      if (children > 0 && ranges.length === 0) {
        const rawRanges = (text: string) =>
          [
            ...text.matchAll(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/g),
          ].map((m) => ({
            min: Number(m[1]!.replace(',', '.')),
            maxExclusive:
              Math.round(Number(m[2]!.replace(',', '.')) * 100 + 1) / 100,
          }));
        ranges = rawRanges(r[9] ?? '');
        if (ranges.length !== children) ranges = rawRanges(r[8] ?? '');
      }
      if (
        ranges.length !== children ||
        ranges.some(
          (a) => a.min < 0 || a.maxExclusive <= a.min || a.maxExclusive > 18,
        )
      )
        throw new Error('سن همهٔ کودک‌ها باید جدا و معتبر نوشته شود.');
      const startsOn = date(r[10] ?? ''),
        endsOn = date(r[11] ?? '');
      const endsOnExclusive = new Date(
        Date.parse(`${endsOn}T00:00:00Z`) + 86400000,
      )
        .toISOString()
        .slice(0, 10);
      if (startsOn >= endsOnExclusive)
        throw new Error('پایان نرخ قبل از شروع است.');
      let amount = (r[13] ?? '').trim();
      // Excel formulas may serialize 515.2 as 515.1999999999999. Normalize
      // only representational IEEE-754 noise, never genuine excess precision.
      if (/^\d{1,12}\.\d{13,18}$/.test(amount)) {
        const numeric = Number(amount),
          canonical = numeric.toFixed(12);
        if (
          numeric < 100000000 &&
          Math.abs(numeric - Number(canonical)) <=
            Number.EPSILON * Math.max(1, numeric) * 4
        )
          amount = canonical.replace(/0+$/, '').replace(/\.$/, '');
      }
      if (
        !/^\d{1,12}(\.\d{1,12})?$/.test(amount) ||
        !['EUR', 'USD', 'IRR'].includes(r[12] ?? '') ||
        (r[12] === 'IRR' && !/^\d+$/.test(amount))
      )
        throw new Error(
          'نرخ یا ارز معتبر نیست؛ ارزهای فعال این ورودی EUR، USD و IRR هستند.',
        );
      result.push({
        hotel: r[0]!.trim(),
        room: r[3]?.trim() ?? '',
        capacity: r[4] ?? '',
        sourceRow,
        adults,
        childAges: ranges,
        startsOn,
        endsOnExclusive,
        amount,
        currencyCode: r[12]!,
        composition: r[8] ?? '',
        board: r[2] ?? '',
      });
    } catch (error) {
      issues.push(
        `ردیف ${sourceRow}: ${error instanceof Error ? error.message : 'نامعتبر'}`,
      );
    }
  });
  return { rows: result, issues, excluded };
}

/** Bounded local XLSX reader: no upload or formula evaluation; only canonical output sheet. */
export async function readOccupancyXlsx(file: File): Promise<string[][]> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 15 * 1024 * 1024)
    throw new Error('فایل XLSX تا ۱۵ مگابایت انتخاب کنید.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50)
    throw new Error('فایل اکسل معتبر نیست.');
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  )
    end--;
  if (end < Math.max(0, bytes.length - 65557))
    throw new Error('ZIP اکسل نامعتبر است.');
  const count = view.getUint16(end + 10, true);
  if (count > 300) throw new Error('ساختار فایل بیش از حد پیچیده است.');
  let cursor = view.getUint32(end + 16, true),
    total = 0;
  const files = new Map<string, string>();
  const entries = new Map<
    string,
    { method: number; compressed: number; size: number; offset: number }
  >();
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error('ZIP ناقص است.');
    const method = view.getUint16(cursor + 10, true),
      compressed = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true);
    const n = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true),
      offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + n),
    );
    total += size;
    if (
      cursor + 46 + n + extra + comment > bytes.length ||
      total > 200 * 1024 * 1024 ||
      view.getUint16(cursor + 8, true) & 1 ||
      /\.\.|vbaProject|externalLinks|embeddings|activeX/i.test(name)
    )
      throw new Error('محتوای ناامن یا حجم بازشده بیش از حد است.');
    if (entries.has(name)) throw new Error('نام تکراری در ZIP مجاز نیست.');
    entries.set(name, { method, compressed, size, offset });
    cursor += 46 + n + extra + comment;
  }
  async function extract(name: string) {
    const entry = entries.get(name);
    if (!entry) throw new Error('بخش لازم فایل اکسل پیدا نشد.');
    const { method, compressed, size, offset } = entry;
    if (
      offset + 30 > bytes.length ||
      view.getUint32(offset, true) !== 0x04034b50
    )
      throw new Error('ZIP خراب است.');
    const start =
      offset +
      30 +
      view.getUint16(offset + 26, true) +
      view.getUint16(offset + 28, true);
    if (start + compressed > bytes.length) throw new Error('ZIP ناقص است.');
    let data: Uint8Array = bytes.slice(start, start + compressed);
    if (method === 8) {
      const reader = new Blob([data as Uint8Array<ArrayBuffer>])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))
        .getReader();
      const parts: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > size || length > 200 * 1024 * 1024) {
          await reader.cancel();
          throw new Error('حجم بازشده نامعتبر است.');
        }
        parts.push(part.value);
      }
      data = new Uint8Array(length);
      let at = 0;
      for (const part of parts) {
        data.set(part, at);
        at += part.length;
      }
      if (length !== size) throw new Error('اندازه ZIP نامعتبر است.');
    } else if (method !== 0)
      throw new Error('روش فشرده‌سازی پشتیبانی نمی‌شود.');
    if (data.length !== size) throw new Error('اندازه ZIP نامعتبر است.');
    const xml = new TextDecoder().decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new Error('ارتباط خارجی یا Entity مجاز نیست.');
    files.set(name, xml);
  }
  for (const name of entries.keys()) {
    if (
      ['xl/sharedStrings.xml', 'xl/workbook.xml'].includes(name) ||
      /\.rels$/.test(name)
    )
      await extract(name);
  }
  const parse = (text: string) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagNameNS('*', 'parsererror').length)
      throw new Error('XML خراب است.');
    return doc;
  };
  for (const [name, xml] of files) {
    if (!name.endsWith('.rels')) continue;
    for (const relation of Array.from(
      parse(xml).getElementsByTagNameNS('*', 'Relationship'),
    )) {
      if (
        relation.getAttribute('TargetMode') === 'External' &&
        !relation.getAttribute('Type')?.endsWith('/hyperlink')
      )
        throw new Error('ارتباط خارجی داده در اکسل مجاز نیست.');
      // Passive hyperlinks are ignored; never fetched, opened or imported.
    }
  }
  const book = parse(files.get('xl/workbook.xml') ?? '');
  const sheets = Array.from(book.getElementsByTagNameNS('*', 'sheet'));
  const matching = sheets.filter(
    (sheet) => sheet.getAttribute('name')?.trim() === 'خروجی نورا',
  );
  if (matching.length !== 1)
    throw new Error(
      'فایل باید دقیقاً یک شیت با نام «خروجی نورا» داشته باشد؛ وجود شیت‌های دیگر مجاز است.',
    );
  const sheetId = matching[0]!.getAttributeNS(
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'id',
  );
  const relations = parse(files.get('xl/_rels/workbook.xml.rels') ?? '');
  const relation = Array.from(
    relations.getElementsByTagNameNS('*', 'Relationship'),
  ).find((node) => node.getAttribute('Id') === sheetId);
  const target = relation?.getAttribute('Target') ?? '';
  const sheetPath = target.startsWith('/xl/')
    ? target.slice(1)
    : `xl/${target}`;
  if (
    !relation?.getAttribute('Type')?.endsWith('/worksheet') ||
    relation.getAttribute('TargetMode') === 'External' ||
    !/^xl\/worksheets\/[^/]+\.xml$/.test(sheetPath) ||
    !entries.has(sheetPath)
  )
    throw new Error('آدرس شیت خروجی نورا در فایل معتبر نیست.');
  if (
    book
      .getElementsByTagNameNS('*', 'workbookPr')[0]
      ?.getAttribute('date1904')
      ?.match(/^(1|true)$/)
  )
    throw new Error(
      'تقویم ۱۹۰۴ اکسل پشتیبانی نمی‌شود؛ فایل را با تقویم استاندارد ذخیره کنید.',
    );
  const shared = files.has('xl/sharedStrings.xml')
    ? Array.from(
        parse(files.get('xl/sharedStrings.xml')!).getElementsByTagNameNS(
          '*',
          'si',
        ),
      ).map((node) => node.textContent ?? '')
    : [];
  await extract(sheetPath);
  const doc = parse(files.get(sheetPath)!);
  const rows = Array.from(doc.getElementsByTagNameNS('*', 'row'));
  if (rows.length > 50001)
    throw new Error('حداکثر ۵۰٬۰۰۰ ردیف قابل خواندن است.');
  const output: string[][] = [];
  for (const row of rows) {
    const number = Number(row.getAttribute('r'));
    if (
      !Number.isInteger(number) ||
      number < 1 ||
      number > 50001 ||
      output[number - 1]
    )
      throw new Error('شماره ردیف اکسل نامعتبر است.');
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagNameNS('*', 'c'))) {
      const ref = cell.getAttribute('r') ?? '',
        letter = ref.match(/^[A-Z]+/)?.[0] ?? '';
      const index =
        [...letter].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (index < 0) throw new Error('ستون اکسل نامعتبر است.');
      if (index > 19) continue; // Nora imports only canonical A:T, not helper columns.
      const formula = cell.getElementsByTagNameNS('*', 'f')[0];
      if (
        formula &&
        /\[|WEBSERVICE\s*\(|HYPERLINK\s*\(|\|/i.test(formula.textContent ?? '')
      )
        throw new Error('فرمول با ارتباط خارجی مجاز نیست.');
      // Never evaluate formulas: only the cached result saved by Excel is read.
      const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? '';
      values[index] =
        cell.getAttribute('t') === 's'
          ? (shared[Number(raw)] ?? '')
          : cell.getAttribute('t') === 'inlineStr'
            ? (cell.getElementsByTagNameNS('*', 'is')[0]?.textContent ?? '')
            : raw;
      if (values[index]!.length > 1000)
        throw new Error('متن سلول بیش از حد طولانی است.');
    }
    output[number - 1] = values;
  }
  return Array.from({ length: output.length }, (_, i) => output[i] ?? []);
}
