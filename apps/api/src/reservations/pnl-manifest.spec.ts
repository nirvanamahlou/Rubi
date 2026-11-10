import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { inspectManifestTemplate } from '../common/manifest/workbook-template';
import { buildPnlManifest } from './pnl-manifest';
const template = () =>
  readFile(join(__dirname, 'templates', 'default-pnl-manifest.xlsm'));
const passenger = {
  firstName: 'ALI',
  lastName: 'EXAMPLE',
  gender: 'MR',
  passengerType: 'ADULT',
  birthDate: '1990-02-03',
  nationalId: '0012345678',
  nationality: 'IRN',
  passportNumber: 'X00123',
  passportIssuingCountry: 'IRN',
  birthCountry: 'TUR',
  passportExpiryDate: '2030-04-05',
};
it('keeps exactly the 11 airline headers and data starts at row two with filter, guide and XLSM project intact', async () => {
  const source = await template();
  const layout = inspectManifestTemplate(source);
  expect(layout.columns.map((c) => c.field)).toEqual([
    'firstName',
    'lastName',
    'gender',
    'passengerType',
    'birthDate',
    'nationalId',
    'nationality',
    'passportNumber',
    'passportIssuingCountry',
    'birthCountry',
    'passportExpiryDate',
  ]);
  expect(layout.headerRow).toBe(1);
  expect(layout.columns[0]?.header).toContain('ONLY [A-Z ]');
  expect(layout.ageCodes).toBe('long');
  const output = buildPnlManifest(source, [
    passenger,
    { ...passenger, firstName: 'SARA', gender: 'MS', passengerType: 'CHILD' },
    { ...passenger, firstName: 'BABY', passengerType: 'INFANT' },
  ]);
  const files = unzipSync(output),
    original = unzipSync(source);
  expect(
    Buffer.from(files['xl/vbaProject.bin'] ?? []).equals(
      Buffer.from(original['xl/vbaProject.bin']!),
    ),
  ).toBe(true);
  expect(strFromU8(files['[Content_Types].xml']!)).toContain('macroEnabled');
  const result = inspectManifestTemplate(output);
  expect(result.columns.map((c) => c.header)).toEqual(
    layout.columns.map((c) => c.header),
  );
  expect(result.sheet).toContain('ref="A1:K4"');
  expect(result.sheet).toContain('autoFilter');
  expect(result.parsed[1]?.cells.map((c) => c.value)).toEqual([
    'ALI',
    'EXAMPLE',
    'MR',
    'ADULT',
    '1990/02/03',
    '0012345678',
    'IRN',
    'X00123',
    'IRN',
    'TUR',
    '2030/04/05',
  ]);
  expect(result.parsed[2]?.cells[3]?.value).toBe('CHILD');
  expect(result.parsed[3]?.cells[3]?.value).toBe('INFANT');
  expect(result.parsed[2]?.cells[2]?.value).toBe('MS');
  expect(strFromU8(files['xl/workbook.xml']!)).toContain('Help');
  if (process.env.NORA_PNL_REVIEW_FILE)
    await writeFile(process.env.NORA_PNL_REVIEW_FILE, output);
});
it('supports a full aircraft, uses uppercase Latin names and never turns values into formulas', async () => {
  const output = buildPnlManifest(
    await template(),
    Array.from({ length: 120 }, () => ({
      ...passenger,
      firstName: '  Alí-Reza ',
      lastName: '=EXAMPLE',
      nationalId: '=1+1',
    })),
  );
  const result = inspectManifestTemplate(output);
  expect(result.parsed).toHaveLength(121);
  expect(result.sheet).toContain('ref="A1:K121"');
  expect(result.parsed[1]?.cells[0]?.value).toBe('ALI REZA');
  expect(result.parsed[1]?.cells[1]?.value).toBe('EXAMPLE');
  expect(result.sheet).not.toMatch(/<f[ >]/);
  expect(result.parsed[1]?.cells[5]?.value).toBe('=1+1');
});
it('keeps missing or malformed dates/countries blank rather than inventing personal data', async () => {
  const result = inspectManifestTemplate(
    buildPnlManifest(await template(), [
      {
        ...passenger,
        birthDate: '2026-02-30',
        nationality: 'IR',
        passportExpiryDate: '',
      },
    ]),
  );
  expect(result.parsed[1]?.cells[4]?.value).toBe('');
  expect(result.parsed[1]?.cells[6]?.value).toBe('');
});
