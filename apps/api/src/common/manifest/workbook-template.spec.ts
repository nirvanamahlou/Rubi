import { expect, it } from 'vitest';
import { strFromU8, strToU8, zipSync, unzipSync } from 'fflate';
import {
  buildTemplateManifest,
  inspectManifestTemplate,
  normalizeManifestTemplate,
} from './workbook-template';
function template(headers: string[], codes = 'ADT,CHD,INF', footer = false) {
  const cell = (col: string, row: number, value: string) =>
    `<c r="${col}${row}" s="1" t="inlineStr"><is><t>${value}</t></is></c>`;
  const row = (n: number, values: string[]) =>
    `<row r="${n}" ht="22" customHeight="1">${values.map((v, i) => cell(String.fromCharCode(65 + i), n, v)).join('')}</row>`;
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
    ),
    'xl/workbook.xml': strToU8(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Help" sheetId="1" r:id="rId1"/><sheet name="Passengers" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rIdVba" Type="vbaProject" Target="vbaProject.bin"/></Relationships>',
    ),
    'xl/vbaProject.bin': strToU8('never execute'),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData>' +
        row(1, ['HELP ONLY']) +
        '</sheetData></worksheet>',
    ),
    'xl/worksheets/sheet2.xml': strToU8(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:E6"/><sheetData>' +
        row(1, ['TITLE']) +
        row(3, headers) +
        row(
          4,
          headers.map(() => 'OLD-SAMPLE'),
        ) +
        row(
          5,
          headers.map(() => 'STALE-PASSENGER'),
        ) +
        (footer
          ? row(6, ['TOTAL'])
          : row(
              6,
              headers.map(() => ''),
            )) +
        '</sheetData><dataValidations><dataValidation sqref="C4:C61" type="list"><formula1>"' +
        codes +
        '"</formula1></dataValidation></dataValidations></worksheet>',
    ),
  });
}
it('maps reordered columns after title rows and uses short child codes without adding passport columns', () => {
  const source = template([
    'ROOM',
    'NAME / SURNAME',
    'PAX TYPE',
    'SEX',
    'CHECK IN',
  ]);
  const layout = inspectManifestTemplate(source);
  expect(layout.path).toBe('xl/worksheets/sheet2.xml');
  expect(layout.headerRow).toBe(3);
  expect(layout.columns.map((c) => c.field)).toEqual([
    'roomType',
    'fullName',
    'passengerType',
    'gender',
    'checkIn',
  ]);
  const out = unzipSync(
    buildTemplateManifest(source, [
      {
        firstName: '=SAMPLE',
        lastName: 'FAMILY',
        roomType: 'DOUBLE',
        passengerType: 'CHILD',
        gender: 'MS',
        checkIn: '2026-09-09',
      },
    ]),
  );
  const xml = strFromU8(out['xl/worksheets/sheet2.xml']!);
  expect(xml).toContain('FAMILY / =SAMPLE');
  expect(xml).toContain('CHD');
  expect(xml).toContain('DOUBLE');
  expect(xml).not.toContain('OLD-SAMPLE');
  expect(xml).not.toContain('STALE-PASSENGER');
  expect(xml).not.toContain('<f>');
  expect(xml).toContain('ht="22"');
  expect(xml).toContain('NAME / SURNAME');
  expect(xml).not.toContain('Passport');
  expect(out['xl/vbaProject.bin']).toBeUndefined();
  expect(strFromU8(out['[Content_Types].xml']!)).not.toContain('macroEnabled');
  expect(strFromU8(out['xl/worksheets/sheet1.xml']!)).toContain('HELP ONLY');
});
it('retains long airline codes and missing values without inferring gender or adult status', () => {
  const source = template(
    [
      'NAME',
      'SURENAME',
      'PAX TYPE ADULT CHILD INFANT',
      'GENDER MR MS',
      'PASSPORT NO',
    ],
    'ADULT,CHILD,INFANT',
  );
  const xml = strFromU8(
    unzipSync(
      buildTemplateManifest(source, [
        { firstName: 'SAMPLE', lastName: 'CHILD', passengerType: 'CHILD' },
        { firstName: 'UNKNOWN', lastName: 'TYPE' },
      ]),
    )['xl/worksheets/sheet2.xml']!,
  );
  expect(xml).toContain('>CHILD<');
  expect(xml).not.toContain('>CHD<');
  expect(xml).not.toContain('>MR<');
  expect(xml).not.toContain('>ADULT<');
});
it('extends passenger rows and updates dimensions while preserving footer capacity', () => {
  const source = template(['NAME', 'LAST NAME', 'AGE']);
  const people = Array.from({ length: 12 }, (_, i) => ({
    firstName: 'SAMPLE' + i,
    lastName: 'LAST',
    passengerType: 'ADULT',
  }));
  const xml = strFromU8(
    unzipSync(buildTemplateManifest(source, people))[
      'xl/worksheets/sheet2.xml'
    ]!,
  );
  expect(xml).toContain('SAMPLE11');
  expect(xml).toContain('ref="A1:E15"');
  expect(() =>
    buildTemplateManifest(
      template(['NAME', 'LAST NAME', 'AGE'], 'ADT,CHD,INF', true),
      people,
    ),
  ).toThrow('MANIFEST_TEMPLATE_ROWS_INSUFFICIENT');
});
it('refuses unknown or ambiguous layouts rather than silently writing to unrelated columns', () => {
  expect(() =>
    inspectManifestTemplate(template(['CITY', 'RATE', 'TOTAL'])),
  ).toThrow('MANIFEST_TEMPLATE_HEADERS_UNRECOGNIZED');
  expect(() =>
    inspectManifestTemplate(template(['NAME', 'LAST NAME', 'AGE', 'PAX TYPE'])),
  ).toThrow('MANIFEST_TEMPLATE_HEADERS_UNRECOGNIZED');
});
it('normalizes XLSM content to ordinary XLSX without macros, while preserving worksheet styling', () => {
  const source = template(['NAME', 'LAST NAME', 'AGE']);
  const normalized = normalizeManifestTemplate(source);
  expect(normalizeManifestTemplate(source).bytes).toEqual(normalized.bytes);
  const files = unzipSync(normalized.bytes);
  expect(normalized.sheetName).toBe('Passengers');
  expect(files['xl/vbaProject.bin']).toBeUndefined();
  expect(strFromU8(files['xl/_rels/workbook.xml.rels']!)).not.toContain(
    'vbaProject',
  );
  expect(strFromU8(files['[Content_Types].xml']!)).toContain(
    'spreadsheetml.sheet.main+xml',
  );
  expect(strFromU8(files['xl/worksheets/sheet2.xml']!)).toContain(
    'customHeight="1"',
  );
});

it('honors room, age and date codes requested by the uploaded template', () => {
  const source = template(
    [
      'ROOM SGL DBL',
      'NAME / SURNAME',
      'PAX TYPE ADL CHD INF',
      'BIRTHDAY DD.MM.YYYY',
      'GENDER M F',
    ],
    'ADL,CHD,INF',
  );
  const xml = strFromU8(
    unzipSync(
      buildTemplateManifest(source, [
        {
          firstName: 'SAMPLE',
          lastName: 'PERSON',
          passengerType: 'ADULT',
          birthDate: '1990-02-03',
          gender: 'MS',
          roomType: 'STANDARD',
          roomCategory: 'DBL',
        },
      ]),
    )['xl/worksheets/sheet2.xml']!,
  );
  expect(xml).toContain('>DBL<');
  expect(xml).toContain('>ADL<');
  expect(xml).toContain('>03.02.1990<');
  expect(xml).toContain('>F<');
});
it('removes unused shared-string sample identities from the delivered workbook', () => {
  const files = unzipSync(template(['NAME', 'LAST NAME', 'AGE']));
  files['xl/sharedStrings.xml'] = strToU8(
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>OLD-PRIVATE-SAMPLE</t></si></sst>',
  );
  const sheet = strFromU8(files['xl/worksheets/sheet2.xml']!).replace(
    '<c r="A4" s="1" t="inlineStr"><is><t>OLD-SAMPLE</t></is></c>',
    '<c r="A4" t="s"><v>0</v></c>',
  );
  files['xl/worksheets/sheet2.xml'] = strToU8(sheet);
  const output = unzipSync(
    buildTemplateManifest(zipSync(files), [
      { firstName: 'NEW', lastName: 'SAMPLE', passengerType: 'CHILD' },
    ]),
  );
  expect(strFromU8(output['xl/sharedStrings.xml']!)).not.toContain(
    'OLD-PRIVATE-SAMPLE',
  );
});

it('reads age codes from hidden validation ranges in a blank single-name template', () => {
  const files = unzipSync(template(['NAME', 'ROOM', 'PAX TYPE']));
  files['xl/workbook.xml'] = strToU8(
    strFromU8(files['xl/workbook.xml']!).replace(
      '</sheets>',
      '<sheet name="Codes" sheetId="3" state="hidden" r:id="rId3"/></sheets>',
    ),
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    strFromU8(files['xl/_rels/workbook.xml.rels']!).replace(
      '</Relationships>',
      '<Relationship Id="rId3" Type="worksheet" Target="worksheets/codes.xml"/></Relationships>',
    ),
  );
  files['xl/worksheets/codes.xml'] = strToU8(
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ADL</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>CHD</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>INF</t></is></c></row></sheetData></worksheet>',
  );
  files['xl/worksheets/sheet2.xml'] = strToU8(
    strFromU8(files['xl/worksheets/sheet2.xml']!).replace(
      '"ADT,CHD,INF"',
      "'Codes'!$A$1:$A$3",
    ),
  );
  const xml = strFromU8(
    unzipSync(
      buildTemplateManifest(zipSync(files), [
        {
          firstName: 'SAMPLE',
          lastName: 'CHILD',
          roomType: 'DOUBLE',
          passengerType: 'CHILD',
        },
      ]),
    )['xl/worksheets/sheet2.xml']!,
  );
  expect(xml).toContain('CHILD / SAMPLE');
  expect(xml).toContain('>CHD<');
});
