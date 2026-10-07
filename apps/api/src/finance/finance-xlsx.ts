import { displayText, type DisplayLanguage } from '../common/i18n/language';
import type { FinanceExportSnapshotV1 } from '@nora/contracts';
import { strToU8, zipSync } from 'fflate';
export const FINANCE_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const xml = (value: string) =>
  Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return code >= 32 || [9, 10, 13].includes(code);
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const text = (ref: string, value: string, style = 0) =>
  `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
function letter(index: number) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
function cell(ref: string, value: string | null, type: string) {
  if (value === null) return text(ref, '');
  if (type === 'DECIMAL') {
    if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('INVALID_EXPORT_AMOUNT');
    const significant = value.replace(/^0+/, '').replace('.', '');
    return significant.length > 15
      ? text(ref, value)
      : `<c r="${ref}" s="2"><v>${value}</v></c>`;
  }
  if (type === 'DATE') {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new Error('INVALID_EXPORT_DATE');
    // Excel serial stores Tehran wall-clock time; UTC value stays in filter metadata.
    return `<c r="${ref}" s="3"><v>${(date.getTime() + 12600000) / 86400000 + 25569}</v></c>`;
  }
  // Text stays text, even when starting with =,+,-,@. No formulas/external links.
  return text(ref, value);
}
export function buildFinanceXlsx(
  snapshot: FinanceExportSnapshotV1,
  language: DisplayLanguage = 'fa',
): Uint8Array {
  const label = (ref: string, value: string, style = 0) => text(ref, displayText(value, language), style);
  const last = letter(snapshot.columns.length - 1),
    header = 5,
    end = header + snapshot.rows.length,
    totalsEnd = end + snapshot.totals.length + 2,
    finalEnd = snapshot.scope === 'RECEIPT' ? totalsEnd + 2 : totalsEnd;
  const rows = [
    `<row r="1" ht="34" customHeight="1">${label('A1', snapshot.title, 4)}</row>`,
    `<row r="2" ht="28" customHeight="1">${label('A2', `زمان تهیه UTC: ${snapshot.generatedAt} | تعداد ردیف: ${snapshot.rows.length}`, 0)}</row>`,
    `<row r="3" ht="38" customHeight="1">${label('A3', snapshot.warnings.map((warning) => displayText(warning, language)).join(' '), 0)}</row>`,
    `<row r="4" ht="28" customHeight="1">${label('A4', `فیلتر: ${JSON.stringify(snapshot.filterSnapshot)}`, 0)}</row>`,
    `<row r="5" ht="36" customHeight="1">${snapshot.columns.map((col, i) => label(letter(i) + '5', col.label, 1)).join('')}</row>`,
    ...snapshot.rows.map(
      (values, index) =>
        `<row r="${index + 6}" ht="48" customHeight="1">${values.map((value, i) => cell(letter(i) + (index + 6), value, snapshot.columns[i]!.type)).join('')}</row>`,
    ),
    `<row r="${end + 2}" ht="28" customHeight="1">${label('A' + (end + 2), 'تهیه‌کننده: ' + snapshot.preparedBy)}</row>`,
    ...snapshot.totals.map(
      (total, index) =>
        `<row r="${end + 3 + index}" ht="28" customHeight="1">${label('A' + (end + 3 + index), 'جمع در ' + total.currencyCode)}${cell('B' + (end + 3 + index), total.amount, 'DECIMAL')}</row>`,
    ),
    ...(snapshot.scope === 'RECEIPT'
      ? [
          `<row r="${finalEnd}" ht="45" customHeight="1">${label('A' + finalEnd, 'امضای دریافت‌کننده')}${label('D' + finalEnd, 'امضای پرداخت‌کننده')}${label('G' + finalEnd, 'تأیید مالی')}</row>`,
        ]
      : []),
  ].join('');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    pack = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const xf = (font: number, fill: number, format: number) =>
    `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>`;
  const files: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="مالی" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'مالی'!$5:$5</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'مالی'!$A$1:$${last}$${finalEnd}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><dimension ref="A1:${last}${finalEnd}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="${language === 'en' ? '0' : '1'}" showGridLines="0"><pane ySplit="5" topLeftCell="A6" state="frozen" activePane="bottomLeft"/></sheetView></sheetViews><cols>${snapshot.columns.map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${col.type === 'TEXT' ? 34 : 23}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A5:${last}${end}"/><mergeCells count="4">${[1, 2, 3, 4].map((n) => `<mergeCell ref="A${n}:${last}${n}"/>`).join('')}</mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`,
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.########"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF133969"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5">${xf(0, 0, 0)}${xf(1, 2, 0)}${xf(0, 0, 164)}${xf(0, 0, 165)}${xf(2, 0, 0)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, value]) => [
        name,
        strToU8(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + value,
        ),
      ]),
    ),
    { level: 6 },
  );
}
