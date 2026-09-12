import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildIranAirtourManifest } from './reservation-manifest';

describe('Iran Airtour Antalya MANIFEST', () => {
  it('keeps the airline workbook and fills the first passenger without formulas', async () => {
    const template = await readFile(
      join(
        __dirname,
        'templates',
        'iran-airtour-antalya-pax-list.xlsx',
      ),
    );
    const bytes = buildIranAirtourManifest(template, [
      {
        firstName: 'ALI',
        lastName: 'EXAMPLE',
        gender: 'MR',
        passengerType: 'ADULT',
        birthDate: '1990-02-03',
        nationalId: '0012345678',
        nationality: 'IRN',
        passportNumber: 'X1234567',
        passportIssuingCountry: 'IRN',
        birthCountry: 'IRN',
        passportExpiryDate: '2030-04-05',
        cabinClass: 'Y',
      },
    ]);
    const files = unzipSync(bytes);
    const workbook = strFromU8(files['xl/workbook.xml']!);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(Object.keys(files)).toContain('xl/worksheets/sheet7.xml');
    expect(workbook).toContain('name="Pax List"');
    expect(workbook).toContain('name="Country"');
    expect(sheet).toContain('ALI');
    expect(sheet).toContain('X1234567');
    expect(sheet).toContain('1990/02/03');
    expect(sheet).not.toContain('<x:f>');
  });

  it('rejects an empty or oversized passenger list', async () => {
    const template = await readFile(
      join(
        __dirname,
        'templates',
        'iran-airtour-antalya-pax-list.xlsx',
      ),
    );
    expect(() => buildIranAirtourManifest(template, [])).toThrow(
      'مسافری برای ساخت MANIFEST وجود ندارد.',
    );
    const passenger = {
      firstName: 'ALI',
      lastName: 'EXAMPLE',
      gender: 'MR' as const,
      passengerType: 'ADULT' as const,
      birthDate: '1990-02-03',
      nationalId: '',
      nationality: 'IRN',
      passportNumber: 'X1234567',
      passportIssuingCountry: 'IRN',
      birthCountry: 'IRN',
      passportExpiryDate: '2030-04-05',
      cabinClass: 'Y',
    };
    expect(() =>
      buildIranAirtourManifest(
        template,
        Array.from({ length: 62 }, () => passenger),
      ),
    ).toThrow('حداکثر ۶۱ مسافر');
  });
});
