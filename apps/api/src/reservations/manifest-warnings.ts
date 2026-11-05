import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const warningPath = 'xl/worksheets/nora-empty-cells.xml';
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The original manifest sheet and template remain intact; warnings never contain passenger values. */
export function addManifestWarnings(
  bytes: Uint8Array,
  labels: readonly string[],
  rows: readonly (readonly string[])[],
) {
  const warnings = rows.flatMap((row, index) => {
    const missing = labels.filter((_, column) => !row[column]?.trim());
    return missing.length ? [[String(index + 2), missing.join('، ')]] : [];
  });
  if (!warnings.length) return bytes;
  const files = unzipSync(bytes);
  const workbook = strFromU8(files['xl/workbook.xml']!);
  const ids = [...workbook.matchAll(/sheetId="(\d+)"/g)].map((match) =>
    Number(match[1]),
  );
  const id = Math.max(0, ...ids) + 1;
  const prefix = /<x:workbook\b/.test(workbook) ? 'x:' : '';
  files['xl/workbook.xml'] = strToU8(
    workbook.replace(
      `</${prefix}sheets>`,
      `<${prefix}sheet name="EMPTY CELLS" sheetId="${id}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdNoraEmptyCells"/></${prefix}sheets>`,
    ),
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    strFromU8(files['xl/_rels/workbook.xml.rels']!).replace(
      '</Relationships>',
      '<Relationship Id="rIdNoraEmptyCells" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/nora-empty-cells.xml"/></Relationships>',
    ),
  );
  files['[Content_Types].xml'] = strToU8(
    strFromU8(files['[Content_Types].xml']!).replace(
      '</Types>',
      '<Override PartName="/xl/worksheets/nora-empty-cells.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
  );
  files[warningPath] = strToU8(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="100" customWidth="1"/></cols><sheetData>${[['Excel row', 'Empty columns'], ...warnings].map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${j ? 'B' : 'A'}${i + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`,
  );
  return zipSync(files, { level: 6 });
}

export function manifestWarningCount(bytes: Uint8Array) {
  const sheet = unzipSync(bytes)[warningPath];
  return sheet
    ? Math.max(0, (strFromU8(sheet).match(/<row /g)?.length ?? 1) - 1)
    : 0;
}
