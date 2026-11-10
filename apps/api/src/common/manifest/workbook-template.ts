import { BadRequestException } from '@nestjs/common';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type ManifestField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'gender'
  | 'passengerType'
  | 'birthDate'
  | 'nationalId'
  | 'nationality'
  | 'passportNumber'
  | 'passportIssuingCountry'
  | 'birthCountry'
  | 'passportExpiryDate'
  | 'cabinClass'
  | 'roomType'
  | 'roomNumber'
  | 'hotelName'
  | 'checkIn'
  | 'checkOut'
  | 'rowNumber'
  | 'flightNumber'
  | 'flightDate'
  | 'airline'
  | 'contractNumber';
export type TemplatePassenger = Partial<Record<ManifestField, string>> & {
  roomCategory?: string;
};
const ns = '(?:[\\w.-]+:)?';
const decode = (v: string) =>
  v
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) =>
      String.fromCodePoint(
        n[0]?.toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n),
      ),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
const escape = (v: string) =>
  Array.from(v)
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        code >= 0x10000
      );
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
function attr(tag: string, key: string) {
  return decode(
    new RegExp(`(?:^|\\s)${key}=["']([^"']*)["']`).exec(tag)?.[1] ?? '',
  );
}
function texts(xml: string) {
  return [
    ...xml.matchAll(
      new RegExp(`<${ns}t(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${ns}t>`, 'g'),
    ),
  ]
    .map((m) => decode(m[1]!))
    .join('');
}
function norm(s: string) {
  return s
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200e\u200f]/g, ' ')
    .toUpperCase()
    .replace(/[_\-./:*()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function field(label: string): ManifestField | undefined {
  const h = norm(label.split(/\r?\n/)[0] || label),
    all = norm(label);
  const tests: [ManifestField, RegExp][] = [
    [
      'passportIssuingCountry',
      /COUNTRY.*PASSPORT|PASSPORT.*(?:COUNTRY|ISSU)|کشور.*صدور/,
    ],
    ['passportExpiryDate', /EXPIR|EXP DATE|انقضا/],
    ['birthCountry', /PLACE OF BIRTH|BIRTH COUNTRY|کشور محل تولد/],
    ['nationalId', /NATIONAL ID|NATIONAL CODE|کد ملی/],
    ['nationality', /NATIONALITY|ملیت/],
    ['passportNumber', /PASSPORT|گذرنامه|پاسپورت/],
    ['birthDate', /BIRTH|DOB|تاریخ تولد/],
    [
      'fullName',
      /FULL NAME|PASSENGER NAME|NAME.*SURNAME|SURNAME.*NAME|نام و نام خانوادگی|نام مسافر/,
    ],
    [
      'lastName',
      /SURNAME|SURENAME|LAST NAME|LASTNAME|FAMILY|نام خانوادگی|فامیل/,
    ],
    ['firstName', /^NAME$|FIRST NAME|FIRSTNAME|GIVEN NAME|^نام(?: لاتین)?$/],
    ['gender', /GENDER|SEX|TITLE|جنسیت/],
    [
      'passengerType',
      /PAX TYPE|PAXTYPE|PASSENGER TYPE|^TYPE$|^نوع$|AGE|ADL|ADT|CHD|رده سنی|نوع مسافر|بزرگسال.*کودک/,
    ],
    ['flightDate', /FLIGHT DATE|TRAVEL DATE|تاریخ پرواز/],
    ['flightNumber', /FLIGHT|شماره پرواز/],
    ['airline', /AIRLINE|CARRIER|ایرلاین/],
    ['contractNumber', /CONTRACT|BOOKING|PNR|قرارداد/],
    ['cabinClass', /CABIN|CLASS|کلاس/],
    ['roomNumber', /ROOM (?:NO|NUMBER)|شماره اتاق/],
    ['roomType', /ROOM|SGL|DBL|TPL|اتاق/],
    ['hotelName', /HOTEL|هتل/],
    ['checkIn', /CHECK IN|CHECKIN|ورود/],
    ['checkOut', /CHECK OUT|CHECKOUT|خروج/],
    ['rowNumber', /^NO$|^NUMBER$|^SR NO$|^S NO$|^ROW$|^#|ردیف/],
  ];
  return (
    tests.find(([, re]) => re.test(h))?.[0] ??
    tests.find(
      ([key, re]) =>
        ['passportIssuingCountry', 'nationalId'].includes(key) && re.test(all),
    )?.[0]
  );
}
type XmlRow = {
  number: number;
  xml: string;
  cells: { column: string; xml: string; value: string; style: string }[];
};
function rows(sheet: string, strings: string[]): XmlRow[] {
  return [
    ...sheet.matchAll(
      new RegExp(`<${ns}row\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${ns}row>)`, 'g'),
    ),
  ].map((m) => ({
    number: Number(attr(m[0], 'r')),
    xml: m[0],
    cells: [
      ...m[0].matchAll(
        new RegExp(`<${ns}c\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${ns}c>)`, 'g'),
      ),
    ].map((c) => {
      const v =
        new RegExp(`<${ns}v[^>]*>([\\s\\S]*?)<\\/${ns}v>`).exec(c[0])?.[1] ??
        '';
      return {
        column: attr(c[0], 'r').replace(/\d/g, ''),
        xml: c[0],
        style: attr(c[0], 's'),
        value:
          attr(c[0], 't') === 's'
            ? (strings[Number(v)] ?? '')
            : attr(c[0], 't') === 'inlineStr'
              ? texts(c[0])
              : decode(v),
      };
    }),
  }));
}
function unpack(bytes: Uint8Array) {
  if (bytes.length > 8 * 1024 * 1024)
    throw new BadRequestException('MANIFEST_TEMPLATE_TOO_LARGE');
  let total = 0,
    count = 0;
  const files = (() => {
    try {
      return unzipSync(bytes, {
        filter: (file) => {
          total += file.originalSize;
          count++;
          if (total > 40 * 1024 * 1024 || count > 2000)
            throw new BadRequestException('MANIFEST_TEMPLATE_TOO_LARGE');
          return true;
        },
      });
    } catch (reason) {
      if (reason instanceof BadRequestException) throw reason;
      throw new BadRequestException('MANIFEST_TEMPLATE_INVALID');
    }
  })();
  for (const [name, data] of Object.entries(files))
    if (
      /\.xml$|\.rels$/i.test(name) &&
      /<!DOCTYPE|<!ENTITY/i.test(strFromU8(data))
    )
      throw new BadRequestException('MANIFEST_TEMPLATE_INVALID');
  if (!files['xl/workbook.xml'] || !files['xl/_rels/workbook.xml.rels'])
    throw new BadRequestException('MANIFEST_TEMPLATE_INVALID');
  return files;
}
export function inspectManifestTemplate(bytes: Uint8Array) {
  const files = unpack(bytes),
    strings = [
      ...strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array()).matchAll(
        new RegExp(`<${ns}si\\b[^>]*>([\\s\\S]*?)<\\/${ns}si>`, 'g'),
      ),
    ].map((m) => texts(m[1]!));
  const book = strFromU8(files['xl/workbook.xml']!),
    rels = strFromU8(files['xl/_rels/workbook.xml.rels']!);
  const candidates = [];
  for (const match of book.matchAll(
    new RegExp(`<${ns}sheet\\b[^>]*\\/>`, 'g'),
  )) {
    if (attr(match[0], 'state') && attr(match[0], 'state') !== 'visible')
      continue;
    const id = attr(match[0], 'r:id'),
      rel = [
        ...rels.matchAll(new RegExp(`<${ns}Relationship\\b[^>]*\\/>`, 'g')),
      ].find((m) => attr(m[0], 'Id') === id)?.[0];
    if (!rel || attr(rel, 'TargetMode') === 'External') continue;
    const target = attr(rel, 'Target');
    const path = target.startsWith('/')
      ? target.slice(1)
      : 'xl/' + target.replace(/^\.\//, '');
    if (path.includes('..') || !files[path]) continue;
    const sheet = strFromU8(files[path]!),
      parsed = rows(sheet, strings);
    for (const row of parsed.filter((r) => r.number <= 50)) {
      let columns = row.cells.flatMap((c) => {
        const key = field(c.value);
        return key ? [{ column: c.column, field: key, header: c.value }] : [];
      });
      if (
        !columns.some((c) => c.field === 'lastName' || c.field === 'fullName')
      )
        columns = columns.map((c) =>
          c.field === 'firstName' &&
          /^(?:NAME|نام)$/.test(norm(c.header.split(/\r?\n/)[0] ?? ''))
            ? { ...c, field: 'fullName' as const }
            : c,
        );
      const keys = new Set(columns.map((c) => c.field));
      if (
        !(
          keys.has('fullName') ||
          (keys.has('firstName') && keys.has('lastName'))
        ) ||
        columns.length < 3
      )
        continue;
      if (keys.size !== columns.length) continue;
      candidates.push({
        sheetName: attr(match[0], 'name'),
        path,
        headerRow: row.number,
        columns,
        score: columns.length,
        sheet,
        parsed,
        files,
        strings,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const found = candidates[0];
  if (!found || candidates[1]?.score === found.score)
    throw new BadRequestException('MANIFEST_TEMPLATE_HEADERS_UNRECOGNIZED');
  const evidence = (key: ManifestField) => {
    const col = found.columns.find((c) => c.field === key);
    if (!col) return '';
    const validation = [
      ...found.sheet.matchAll(
        new RegExp(
          `<${ns}dataValidation\\b[^>]*>[\\s\\S]*?<\\/${ns}dataValidation>`,
          'g',
        ),
      ),
    ]
      .filter((m) =>
        attr(m[0], 'sqref')
          .split(/\s+/)
          .some((range) => range.startsWith(col.column)),
      )
      .map((m) => m[0])
      .join(' ');
    const referencedCodes = [
      ...validation.matchAll(
        new RegExp(`<${ns}formula1[^>]*>([\\s\\S]*?)<\\/${ns}formula1>`, 'g'),
      ),
    ]
      .flatMap((match) => {
        let formula = decode(match[1] ?? '')
          .replace(/^=/, '')
          .trim();
        const defined = [
          ...book.matchAll(
            new RegExp(
              `<${ns}definedName\\b[^>]*>[\\s\\S]*?<\\/${ns}definedName>`,
              'g',
            ),
          ),
        ].find((entry) => attr(entry[0], 'name') === formula)?.[0];
        if (defined)
          formula = decode(
            defined.replace(/^[^>]*>/, '').replace(/<[^>]*>$/, ''),
          );
        const range =
          /^(?:'([^']+)'|([^!]+))!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(
            formula,
          );
        if (!range || range[3] !== range[5]) return [];
        const sheetName = range[1] ?? range[2];
        const sheetTag = [
          ...book.matchAll(new RegExp(`<${ns}sheet\\b[^>]*\\/>`, 'g')),
        ].find((entry) => attr(entry[0], 'name') === sheetName)?.[0];
        if (!sheetTag) return [];
        const rel = [
          ...rels.matchAll(new RegExp(`<${ns}Relationship\\b[^>]*\\/>`, 'g')),
        ].find((entry) => attr(entry[0], 'Id') === attr(sheetTag, 'r:id'))?.[0];
        if (!rel || attr(rel, 'TargetMode') === 'External') return [];
        const target = attr(rel, 'Target');
        const path = target.startsWith('/')
          ? target.slice(1)
          : 'xl/' + target.replace(/^\.\//, '');
        if (path.includes('..') || !files[path]) return [];
        return rows(strFromU8(files[path]!), strings)
          .filter(
            (row) =>
              row.number >= Number(range[4]) && row.number <= Number(range[6]),
          )
          .flatMap((row) =>
            row.cells.filter((c) => c.column === range[3]).map((c) => c.value),
          );
      })
      .join(' ');
    return norm(
      referencedCodes +
        ' ' +
        col.header +
        ' ' +
        validation +
        ' ' +
        found.parsed
          .filter((r) => r.number > found.headerRow)
          .slice(0, 20)
          .map((r) => r.cells.find((c) => c.column === col.column)?.value ?? '')
          .join(' '),
    );
  };
  const roomCodes = /\bSGL\b|\bDBL\b|\bTPL\b/.test(evidence('roomType'));
  const pax = evidence('passengerType'),
    gender = evidence('gender');
  return {
    ...found,
    roomCodes,
    adultShortCode: /\bADL\b/.test(pax) && !/\bADT\b/.test(pax) ? 'ADL' : 'ADT',
    femaleTitle:
      /\bMRS\b/.test(gender) && !/\bMS\b/.test(gender) ? 'MRS' : 'MS',
    ageCodes: /\b(?:ADT|ADL|CHD|INF)\b/.test(pax)
      ? ('short' as const)
      : /کودک|بزرگسال/.test(pax) && !/[A-Z]/.test(pax)
        ? ('persian' as const)
        : ('long' as const),
    genderCodes:
      /\bMALE\b|\bFEMALE\b/.test(gender) && !/\bMR\b|\bMS\b/.test(gender)
        ? ('words' as const)
        : /\bM\b/.test(gender) &&
            /\bF\b/.test(gender) &&
            !/\bMR\b|\bMS\b/.test(gender)
          ? ('letters' as const)
          : ('titles' as const),
  };
}
/** Macros are never executed or delivered from a manifest template. */
export function normalizeManifestTemplate(bytes: Uint8Array) {
  const layout = inspectManifestTemplate(bytes),
    files = layout.files;
  const removed = new Set(
    Object.keys(files).filter((p) =>
      /vbaProject|vbaData|activeX|ctrlProps|customUI|embeddings|calcChain|digital-signature/i.test(
        p,
      ),
    ),
  );
  for (const p of removed) delete files[p];
  for (const [p, data] of Object.entries(files)) {
    if (!/\.rels$|\[Content_Types\]\.xml$/i.test(p)) continue;
    let value = strFromU8(data).replace(
      'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    );
    value = value
      .replace(
        new RegExp(`<${ns}(?:Relationship|Override|Default)\\b[^>]*\\/>`, 'g'),
        (tag) => {
          const attrs = norm(tag);
          if (
            /VBA|MACRO|ACTIVEX|CONTROL|CALCCHAIN|DIGITAL SIGNATURE|EMBEDDINGS/.test(
              attrs,
            )
          )
            return '';
          return tag;
        },
      )
      .replace(
        'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
      );
    // Macro-enabled workbook content type is converted, not deleted.
    if (
      p === '[Content_Types].xml' &&
      !/spreadsheetml\.sheet\.main\+xml/.test(value)
    )
      value = value.replace(
        '</Types>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      );
    files[p] = strToU8(value);
  }
  return {
    bytes: zipSync(files, {
      level: 6,
      mtime: new Date('1980-01-02T00:00:00Z'),
    }),
    sheetName: layout.sheetName,
    columns: layout.columns.map((c) => c.field),
    headers: layout.columns.map((c) => c.header.split(/\r?\n/)[0] ?? c.header),
    ageCodes: layout.ageCodes,
  };
}
export function buildTemplateManifest(
  bytes: Uint8Array,
  passengers: readonly TemplatePassenger[],
  options: { maxPassengers?: number } = {},
) {
  if (!passengers.length)
    throw new BadRequestException('مسافری برای ساخت MANIFEST وجود ندارد.');
  if (passengers.length > (options.maxPassengers ?? 61))
    throw new BadRequestException('این قالب حداکثر ۶۱ مسافر را می‌پذیرد.');
  const layout = inspectManifestTemplate(bytes);
  let sheet = layout.sheet;
  const footer = layout.parsed.find(
    (r) =>
      r.number > layout.headerRow &&
      r.cells.some((c) =>
        /^(?:TOTAL(?: PAX| PASSENGERS)?|GRAND TOTAL|جمع|توضیحات|REMARKS)$/i.test(
          c.value.trim(),
        ),
      ),
  )?.number;
  const body = layout.parsed.filter(
    (r) =>
      r.number > layout.headerRow &&
      (footer === undefined || r.number < footer),
  );
  if (footer !== undefined && passengers.length > footer - layout.headerRow - 1)
    throw new BadRequestException('MANIFEST_TEMPLATE_ROWS_INSUFFICIENT');
  const sample = body[0];
  const prefix = /<([\w.-]+):worksheet\b/.exec(sheet)?.[1];
  const q = prefix ? prefix + ':' : '';
  const cell = (column: string, row: number, value: string, style: string) =>
    `<${q}c r="${column}${row}"${style ? ` s="${style}"` : ''} t="inlineStr"><${q}is><${q}t xml:space="preserve">${escape(value)}</${q}t></${q}is></${q}c>`;
  const rowXml = (
    number: number,
    p: TemplatePassenger | undefined,
    original?: XmlRow,
  ) => {
    const attrs =
      (original?.xml ?? sample?.xml ?? '')
        .match(new RegExp(`^<${ns}row\\b([^>]*)`))?.[1]
        ?.replace(/\br=["'][^"']*["']/, '')
        .replace(/\/$/, '') ?? '';
    const mapped = new Map(layout.columns.map((c) => [c.column, c]));
    const all = new Set([
      ...(original?.cells ?? sample?.cells ?? []).map((c) => c.column),
      ...mapped.keys(),
    ]);
    const colNumber = (c: string) =>
      [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    const cells = [...all]
      .sort((a, b) => colNumber(a) - colNumber(b))
      .map((column) => {
        const old =
            original?.cells.find((c) => c.column === column) ??
            sample?.cells.find((c) => c.column === column),
          spec = mapped.get(column);
        if (!spec || !p) return cell(column, number, '', old?.style ?? '');
        let value = p[spec.field] ?? '';
        if (spec.field === 'roomType' && layout.roomCodes)
          value = p.roomCategory || value;
        if (spec.field === 'fullName')
          value = [p.lastName, p.firstName].filter(Boolean).join(' / ');
        if (spec.field === 'rowNumber')
          value = String(number - layout.headerRow);
        if (spec.field === 'passengerType')
          value =
            layout.ageCodes === 'short'
              ? ({ ADULT: layout.adultShortCode, CHILD: 'CHD', INFANT: 'INF' }[
                  value
                ] ?? value)
              : layout.ageCodes === 'persian'
                ? ({ ADULT: 'بزرگسال', CHILD: 'کودک', INFANT: 'نوزاد' }[
                    value
                  ] ?? value)
                : value;
        if (spec.field === 'gender')
          value =
            layout.genderCodes === 'letters'
              ? ({ MR: 'M', MS: 'F' }[value] ?? value)
              : layout.genderCodes === 'words'
                ? ({ MR: 'MALE', MS: 'FEMALE' }[value] ?? value)
                : value === 'MS'
                  ? layout.femaleTitle
                  : value;
        if (
          /Date$|checkIn|checkOut/.test(spec.field) &&
          /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
          const format = /(YYYY|DD)([/.-])MM[/.-](YYYY|DD)/i.exec(spec.header);
          const separator = format?.[2] ?? '/';
          const parts = value.split('-');
          value =
            format?.[1]?.toUpperCase() === 'DD'
              ? parts.reverse().join(separator)
              : parts.join(separator);
        }
        return cell(column, number, value, old?.style ?? '');
      })
      .join('');
    return `<${q}row r="${number}"${attrs}>${cells}</${q}row>`;
  };
  for (const row of body)
    sheet = sheet.replace(
      row.xml,
      rowXml(row.number, passengers[row.number - layout.headerRow - 1], row),
    );
  for (let i = 0; i < passengers.length; i++) {
    const number = layout.headerRow + 1 + i;
    if (body.some((r) => r.number === number)) continue;
    const value = rowXml(number, passengers[i]);
    const next = rows(sheet, layout.strings).find((r) => r.number > number);
    sheet = next
      ? sheet.replace(next.xml, value + next.xml)
      : sheet.replace(
          new RegExp(`</${ns}sheetData>`),
          value + `</${q}sheetData>`,
        );
  }
  const lastRow = Math.max(
    layout.headerRow + passengers.length,
    ...layout.parsed.map((row) => row.number),
  );
  const dimensionColumn = /(?:[A-Z]+\d+:)?([A-Z]+)\d+/.exec(
    new RegExp(`<${ns}dimension\\b[^>]*`).exec(sheet)?.[0]?.split('ref=')[1] ??
      '',
  )?.[1];
  const lastColumn =
    [
      ...layout.columns.map((c) => c.column),
      ...layout.parsed.flatMap((row) => row.cells.map((c) => c.column)),
      ...(dimensionColumn ? [dimensionColumn] : []),
    ]
      .sort((a, b) => a.length - b.length || a.localeCompare(b))
      .at(-1) ?? 'A';
  sheet = sheet.replace(
    new RegExp(`<${ns}dimension\\b[^>]*\\/>`),
    `<${q}dimension ref="A1:${lastColumn}${lastRow}"/>`,
  );
  sheet = sheet.replace(
    new RegExp(
      `(<${ns}autoFilter\\b[^>]*ref=["'][A-Z]+\\d+:[A-Z]+)(\\d+)(["'])`,
      'g',
    ),
    (_match, start: string, end: string, quote: string) =>
      start +
      String(Math.max(Number(end), layout.headerRow + passengers.length)) +
      quote,
  );
  const workbook = strFromU8(layout.files['xl/workbook.xml']!);
  layout.files['xl/workbook.xml'] = strToU8(
    workbook.replace(
      new RegExp(
        `<${ns}definedName\\b[^>]*>[\\s\\S]*?<\\/${ns}definedName>`,
        'g',
      ),
      (entry) => {
        if (
          attr(entry, 'name') !== '_xlnm.Print_Area' ||
          !(
            entry.includes(`'${layout.sheetName}'!`) ||
            entry.includes(`${layout.sheetName}!`)
          )
        )
          return entry;
        return entry.replace(
          /(:\$?[A-Z]+\$?)(\d+)/g,
          (_match, start: string, end: string) =>
            start +
            String(Math.max(Number(end), layout.headerRow + passengers.length)),
        );
      },
    ),
  );
  layout.files[layout.path] = strToU8(sheet);
  compactSharedStrings(layout.files);
  // Source macros are stripped even for previously registered files.
  return normalizeManifestTemplate(zipSync(layout.files, { level: 6 })).bytes;
}

/** Remove unused sample identities as well as visible sample rows from exports. */
function compactSharedStrings(files: Record<string, Uint8Array>) {
  const path = 'xl/sharedStrings.xml';
  if (!files[path]) return;
  const source = strFromU8(files[path]);
  const si = new RegExp(`<${ns}si\\b[^>]*>[\\s\\S]*?<\\/${ns}si>`, 'g');
  const entries = [...source.matchAll(si)].map((m) => m[0]);
  const used = new Set<number>();
  let count = 0;
  const cellPattern = new RegExp(`<${ns}c\\b[^>]*>[\\s\\S]*?<\\/${ns}c>`, 'g');
  const valuePattern = new RegExp(`(<${ns}v[^>]*>)([0-9]+)(<\\/${ns}v>)`);
  for (const [name, data] of Object.entries(files))
    if (/^xl\/worksheets\/.*\.xml$/.test(name))
      for (const cell of strFromU8(data).matchAll(cellPattern))
        if (attr(cell[0], 't') === 's') {
          const index = Number(valuePattern.exec(cell[0])?.[2]);
          if (Number.isInteger(index) && entries[index] !== undefined) {
            used.add(index);
            count++;
          }
        }
  const indexes = [...used].sort((a, b) => a - b),
    mapping = new Map(indexes.map((old, i) => [old, i]));
  for (const [name, data] of Object.entries(files))
    if (/^xl\/worksheets\/.*\.xml$/.test(name))
      files[name] = strToU8(
        strFromU8(data).replace(cellPattern, (cell) =>
          attr(cell, 't') === 's'
            ? cell.replace(
                valuePattern,
                (_m, start: string, index: string, end: string) =>
                  start + String(mapping.get(Number(index)) ?? index) + end,
              )
            : cell,
        ),
      );
  let output = source.replace(si, '');
  const prefix = /<([\w.-]+):sst\b/.exec(source)?.[1];
  const q = prefix ? prefix + ':' : '';
  output = output.replace(
    new RegExp(`<${ns}sst\\b([^>]*)>`),
    (_m, attrs: string) =>
      `<${q}sst${attrs.replace(/\s(?:count|uniqueCount)=["'][^"']*["']/g, '')} count="${count}" uniqueCount="${indexes.length}">`,
  );
  output = output.replace(
    new RegExp(`</${ns}sst>`),
    indexes.map((i) => entries[i]).join('') + `</${q}sst>`,
  );
  files[path] = strToU8(output);
}

export function templateManifestWarnings(
  bytes: Uint8Array,
  passengers: readonly TemplatePassenger[],
) {
  const layout = inspectManifestTemplate(bytes);
  const labels: Partial<Record<ManifestField, string>> = {
    firstName: 'First name',
    lastName: 'Last name',
    fullName: 'Passenger name',
    gender: 'Gender',
    passengerType: 'PAX type',
    birthDate: 'Birth date',
    nationalId: 'National ID',
    nationality: 'Nationality',
    passportNumber: 'Passport number',
    passportIssuingCountry: 'Passport issuing country',
    birthCountry: 'Birth country',
    passportExpiryDate: 'Passport expiry',
    cabinClass: 'Cabin class',
    roomType: 'Room',
    roomNumber: 'Room number',
    hotelName: 'Hotel',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
  };
  return {
    firstDataRow: layout.headerRow + 1,
    labels: layout.columns.map(
      (c) => labels[c.field] ?? c.header.split('\n')[0]!,
    ),
    rows: passengers.map((p, i) =>
      layout.columns.map((c) =>
        c.field === 'rowNumber'
          ? String(i + 1)
          : c.field === 'fullName'
            ? [p.lastName, p.firstName].filter(Boolean).join(' / ')
            : (p[c.field] ?? ''),
      ),
    ),
  };
}
