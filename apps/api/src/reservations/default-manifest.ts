import { strToU8, zipSync } from 'fflate';
import { BadRequestException } from '@nestjs/common';

export interface DefaultManifestRow {
  contractName: string;
  destination: string;
  firstName: string;
  lastName: string;
  flightDate: string;
  ticket: string;
  airline: string;
  ageCategory: string;
  nationality: string;
  birthDate: string;
  gender: string;
  cabinClass: string;
  nationalId: string;
  passportNumber: string;
  passportExpiryDate: string;
}

/** Keep the operational override first; legacy snapshots can derive age on travel day. */
export function defaultManifestAge(
  age: string | undefined,
  birthDate: string | null | undefined,
  travelDay: string,
): string {
  if (age === 'INF' || age === 'INFANT') return 'نوزاد';
  if (age === 'CHD' || age === 'CHILD') return 'کودک';
  if (age === 'ADT' || age === 'ADULT') return 'بزرگسال';
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return '';
  const birth = new Date(birthDate + 'T00:00:00Z');
  if (
    Number.isNaN(birth.valueOf()) ||
    !birth.toISOString().startsWith(birthDate) ||
    birthDate > travelDay
  )
    return '';
  let years = Number(travelDay.slice(0, 4)) - birth.getUTCFullYear();
  if (travelDay.slice(5) < birthDate.slice(5)) years -= 1;
  return years < 2 ? 'نوزاد' : years < 12 ? 'کودک' : 'بزرگسال';
}

const escapeXml = (value: string) =>
  Array.from(value)
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

/** Inline string cells preserve leading zeros and never execute passenger text as formulas. */
export function buildDefaultManifest(
  rows: readonly DefaultManifestRow[],
  international: boolean,
  transport: 'FLIGHT' | 'BUS' | 'TRAIN' = 'FLIGHT',
) {
  if (!rows.length)
    throw new BadRequestException('مسافری برای ساخت MANIFEST وجود ندارد.');
  const columns: [keyof DefaultManifestRow, string][] = [
    ['contractName', 'نام قرارداد'],
    ['firstName', 'نام'],
    ['lastName', 'نام خانوادگی'],
    ['flightDate', transport === 'FLIGHT' ? 'تاریخ پرواز' : 'تاریخ حرکت'],
    ['destination', 'مقصد'],
    ['ticket', 'بلیت'],
    [
      'airline',
      transport === 'FLIGHT'
        ? 'ایرلاین'
        : transport === 'BUS'
          ? 'شرکت اتوبوسرانی'
          : 'شرکت ریلی',
    ],
    ['ageCategory', 'رده سنی'],
    ['nationality', 'ملیت'],
    ['birthDate', 'تاریخ تولد'],
    ['gender', 'جنسیت'],
    [
      'cabinClass',
      transport === 'FLIGHT'
        ? 'کلاس پروازی'
        : transport === 'BUS'
          ? 'کلاس اتوبوس'
          : 'کلاس قطار',
    ],
    ['nationalId', 'کد ملی'],
    ...(international
      ? ([
          ['passportNumber', 'شماره پاسپورت'],
          ['passportExpiryDate', 'تاریخ انقضای پاسپورت'],
        ] as [keyof DefaultManifestRow, string][])
      : []),
  ];
  const lastColumn = String.fromCharCode(64 + columns.length);
  const sheetRows = [
    columns.map(([, label]) => label),
    ...rows.map((row) => columns.map(([key]) => row[key])),
  ]
    .map(
      (values, i) =>
        `<row r="${i + 1}">${values
          .map(
            (value, j) =>
              `<c r="${String.fromCharCode(65 + j)}${i + 1}" s="${i === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('');
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="MANIFEST" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F5496"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${rows.length + 1}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${columns.length}" width="23" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length + 1}"/></worksheet>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
    ),
    { level: 6 },
  );
}
