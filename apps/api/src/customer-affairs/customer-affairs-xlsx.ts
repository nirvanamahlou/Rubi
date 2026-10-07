import { displayText, type DisplayLanguage } from '../common/i18n/language';
import { zipSync, strToU8 } from 'fflate';

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const safeCell = (value: unknown) => {
  const text = Array.from(
    String(value instanceof Date ? value.toISOString() : (value ?? '')),
  )
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return code > 31 || code === 9 || code === 10 || code === 13;
    })
    .filter((character) => character.codePointAt(0) !== 127)
    .join('');
  // Inline strings are never formulas, but neutralize spreadsheet injection
  // for programs that convert the workbook to a formula-capable format.
  return /^[\s\u200e\u200f]*[=+@-]/u.test(text) ? `'${text}` : text;
};

export function customerAffairsXlsx(
  sheetName: string,
  rows: readonly (readonly unknown[])[],
  language: DisplayLanguage = 'fa',
): Uint8Array {
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="${language === 'en' ? '0' : '1'}" workbookViewId="0"/></sheetViews><sheetData>${rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row
          .map(
            (value) =>
              `<c t="inlineStr"><is><t>${escapeXml(safeCell(index === 0 && typeof value === 'string' ? displayText(value, language) : value))}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('')}</sheetData></worksheet>`;
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': worksheet,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, strToU8(content)]),
    ),
    { level: 6 },
  );
}
