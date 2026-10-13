import { afterEach, describe, expect, it, vi } from 'vitest';
import { occupancyImportRows, readOccupancyXlsx } from './occupancy-import';

// Tiny DOM fixtures isolate ZIP/relationship selection from the browser XML engine.
const node = (
  attributes: Record<string, string> = {},
  children: Record<string, unknown[]> = {},
  textContent = '',
) => ({
  getAttribute: (name: string) => attributes[name] ?? null,
  getAttributeNS: (_namespace: string, name: string) =>
    attributes[`r:${name}`] ?? null,
  getElementsByTagNameNS: (_namespace: string, name: string) =>
    children[name] ?? [],
  textContent,
});
const cell = (ref: string, value: string, formula?: string) =>
  node(
    { r: ref, t: 'inlineStr' },
    {
      is: [node({}, {}, value)],
      ...(formula ? { f: [node({}, {}, formula)] } : {}),
    },
  );
function storedZip(entries: Record<string, string>): File {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [name, xml] of Object.entries(entries)) {
    const path = Buffer.from(name),
      data = Buffer.from(xml);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(path.length, 26);
    local.push(head, path, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(path.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, path);
    offset += head.length + path.length + data.length;
  }
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50);
  footer.writeUInt16LE(Object.keys(entries).length, 10);
  footer.writeUInt32LE(offset, 16);
  const bytes = Buffer.concat([...local, ...central, footer]);
  return {
    name: 'rates.xlsx',
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  } as File;
}
function fixture({
  target = 'worksheets/sheet3.xml',
  duplicate = false,
  date1904 = false,
  formula = 'SUM(F6:G6)',
  extraRelations = '',
} = {}) {
  const docs = new Map<string, ReturnType<typeof node>>([
    [
      'book',
      node(
        {},
        {
          sheet: [
            node({ name: 'راهنما', 'r:id': 'r1' }),
            node({ name: 'خروجی نورا', 'r:id': 'r3' }),
            ...(duplicate ? [node({ name: 'خروجی نورا', 'r:id': 'r4' })] : []),
          ],
          workbookPr: [node({ date1904: date1904 ? '1' : '0' })],
        },
      ),
    ],
    [
      'relations',
      node(
        {},
        {
          Relationship: [
            node({
              Id: 'r3',
              Target: target,
              Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
            }),
          ],
        },
      ),
    ],
    [
      'selected',
      node(
        {},
        {
          row: [
            node(
              { r: '5' },
              {
                c: [
                  cell('A5', 'هتل'),
                  cell('D5', 'اتاق'),
                  cell('I5', 'ترکیب اقامت'),
                ],
              },
            ),
            node(
              { r: '6' },
              {
                c: [
                  cell('A6', 'TEST HOTEL'),
                  cell('C6', 'BB'),
                  cell('D6', 'DOUBLE'),
                  cell('F6', '2'),
                  cell('G6', '0'),
                  cell('H6', '2', formula),
                  cell('I6', '2 AD'),
                  cell('K6', '2026-10-01'),
                  cell('L6', '2026-10-31'),
                  cell('M6', 'EUR'),
                  cell('N6', '123.45678'),
                  cell('AI6', 'helper'),
                ],
              },
            ),
          ],
        },
      ),
    ],
  ]);
  if (extraRelations)
    docs.set(
      extraRelations,
      node(
        {},
        {
          Relationship: [
            node({
              TargetMode: 'External',
              Type: extraRelations.includes('/hyperlink')
                ? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'
                : 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
            }),
          ],
        },
      ),
    );
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString(text: string) {
        const doc = docs.get(text);
        if (!doc) throw new Error(`Unexpected XML read: ${text}`);
        return doc;
      }
    },
  );
  return storedZip({
    'xl/workbook.xml': 'book',
    'xl/_rels/workbook.xml.rels': 'relations',
    'xl/worksheets/sheet1.xml': 'not-selected',
    'xl/worksheets/sheet3.xml': 'selected',
    ...(extraRelations
      ? { 'xl/worksheets/_rels/sheet1.xml.rels': extraRelations }
      : {}),
  });
}
afterEach(() => vi.unstubAllGlobals());
describe('bounded Nora XLSX relationship reader', () => {
  it('ignores passive external hyperlinks without reading their targets', async () => {
    expect(
      occupancyImportRows(
        await readOccupancyXlsx(
          fixture({
            extraRelations:
              '<Relationship TargetMode="External" Type="relationships/hyperlink" />',
          }),
        ),
      ).rows,
    ).toHaveLength(1);
  });
  it('reads named third sheet, skips unrelated sheets/helpers and preserves physical row numbers', async () => {
    const result = occupancyImportRows(await readOccupancyXlsx(fixture()));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      hotel: 'TEST HOTEL',
      sourceRow: 6,
      amount: '123.45678',
    });
  });
  it('supports absolute OPC worksheet paths', async () => {
    expect(
      occupancyImportRows(
        await readOccupancyXlsx(
          fixture({ target: '/xl/worksheets/sheet3.xml' }),
        ),
      ).rows,
    ).toHaveLength(1);
  });
  it.each([
    '../outside.xml',
    'https://example.test/rates.xml',
    'worksheets/missing.xml',
  ])('rejects unsafe or missing sheet path %s', async (target) => {
    await expect(readOccupancyXlsx(fixture({ target }))).rejects.toThrow(
      'آدرس شیت',
    );
  });
  it('rejects ambiguous duplicate named sheets', async () => {
    await expect(
      readOccupancyXlsx(fixture({ duplicate: true })),
    ).rejects.toThrow('دقیقاً یک شیت');
  });
  it('rejects unsupported date epoch instead of shifting dates', async () => {
    await expect(
      readOccupancyXlsx(fixture({ date1904: true })),
    ).rejects.toThrow('۱۹۰۴');
  });
  it('reads cached local formulas without evaluating them', async () => {
    expect(
      occupancyImportRows(
        await readOccupancyXlsx(fixture({ formula: "'ورود'!F6" })),
      ).rows,
    ).toHaveLength(1);
  });
  it('rejects external formulas and external relationships even on an unrelated sheet', async () => {
    await expect(
      readOccupancyXlsx(fixture({ formula: '[other.xlsx]Sheet1!F6' })),
    ).rejects.toThrow('ارتباط خارجی');
    await expect(
      readOccupancyXlsx(
        fixture({ extraRelations: '<Relationship TargetMode="External" />' }),
      ),
    ).rejects.toThrow('ارتباط خارجی');
  });
});
