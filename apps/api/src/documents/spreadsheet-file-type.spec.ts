import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  XLS_MIME,
  XLSX_MIME,
  attachmentMimeType,
  receiptFileSupported,
  documentMimeTypes,
} from '@nora/contracts/upload-formats';
import { spreadsheetFileType } from './spreadsheet-file-type';
import { spreadsheetZipTypeFromRanges } from './spreadsheet-zip-ranges';
import { validateUploadFile } from './documents.validation';
const xlsx = (extra: Record<string, Uint8Array> = {}) =>
  Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /></Types>',
      ),
      'xl/workbook.xml': strToU8('<workbook/>'),
      ...extra,
    }),
  );
function xls(name = 'Workbook') {
  const bytes = Buffer.alloc(1536);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(bytes);
  bytes.writeUInt16LE(0xfffe, 28);
  bytes.writeUInt16LE(9, 30);
  bytes.writeUInt32LE(1, 44);
  bytes.writeUInt32LE(1, 48);
  bytes.writeUInt32LE(0xfffffffe, 68);
  for (let i = 76; i < 512; i += 4) bytes.writeUInt32LE(0xffffffff, i);
  bytes.writeUInt32LE(0, 76);
  bytes.fill(0xff, 512, 1024);
  bytes.writeUInt32LE(0xfffffffd, 512);
  bytes.writeUInt32LE(0xfffffffe, 516);
  Buffer.from(name + '\0', 'utf16le').copy(bytes, 1024);
  bytes.writeUInt16LE((name.length + 1) * 2, 1088);
  bytes[1090] = 2;
  return bytes;
}
it('recognizes Excel containers without trusting a browser MIME or renaming', () => {
  expect(spreadsheetFileType(xlsx())).toBe(XLSX_MIME);
  expect(spreadsheetFileType(xls())).toBe(XLS_MIME);
  expect(spreadsheetFileType(xls('WordDocument'))).toBeNull();
  expect(
    spreadsheetFileType(
      Buffer.from(zipSync({ 'payload.exe': strToU8('bad') })),
    ),
  ).toBeNull();
  expect(
    spreadsheetFileType(xlsx({ 'xl/vbaProject.bin': strToU8('macro') })),
  ).toBeNull();
  expect(spreadsheetFileType(xls('VBA'))).toBeNull();
  const cycle = xls();
  cycle.writeUInt32LE(1, 516);
  expect(spreadsheetFileType(cycle)).toBeNull();
});
it('rejects expansion bombs before extracting archive contents', () => {
  expect(
    spreadsheetFileType(xlsx({ 'xl/huge.xml': new Uint8Array(500000) })),
  ).toBeNull();
});
it('recognizes a large ordinary XLSX while reading only its metadata ranges', async () => {
  const bytes = xlsx({ 'xl/media/image.bin': randomBytes(2 * 1024 * 1024) });
  const ranges: number[] = [];
  const found = await spreadsheetZipTypeFromRanges(
    bytes.length,
    async (offset, length) => {
      ranges.push(length);
      return bytes.subarray(offset, offset + length);
    },
  );
  expect(found).toBe(spreadsheetFileType(bytes));
  expect(found).toBe(XLSX_MIME);
  expect(ranges.length).toBeGreaterThan(1);
  expect(ranges.reduce((sum, length) => sum + length, 0)).toBeLessThan(
    bytes.length / 4,
  );
});

it.each([
  xlsx({ 'xl/vbaProject.bin': strToU8('synthetic macro label') }),
  xlsx({ 'xl/huge.xml': new Uint8Array(500000) }),
  Buffer.from(zipSync({ 'word/document.xml': strToU8('<document/>') })),
])(
  'matches the existing spreadsheet rejection for a non-workbook or disallowed ZIP',
  async (bytes) => {
    expect(
      await spreadsheetZipTypeFromRanges(bytes.length, async (offset, length) =>
        bytes.subarray(offset, offset + length),
      ),
    ).toBeNull();
    expect(spreadsheetFileType(bytes)).toBeNull();
  },
);

it.each([
  ['receipt.JFIF', 'image/jfif', 'image/jpeg'],
  [
    'book.xlsx',
    '',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['book.xls', 'application/octet-stream', XLS_MIME],
  ['receipt.pdf', 'application/pdf', 'application/pdf'],
])('normalizes browser metadata for %s', (name, mime, expected) => {
  expect(attachmentMimeType(name!, mime!)).toBe(expected);
  expect(receiptFileSupported(name!, mime!)).toBe(true);
});
it('does not admit a mismatching explicit type or macro extension', () => {
  expect(receiptFileSupported('photo.jfif', 'application/pdf')).toBe(false);
  expect(receiptFileSupported('macro.xlsm', XLSX_MIME)).toBe(false);
  expect(documentMimeTypes([XLSX_MIME])).toEqual([XLSX_MIME, XLS_MIME]);
  expect(documentMimeTypes(['application/pdf'])).toEqual(['application/pdf']);
});
it('accepts JPEG bytes under JFIF and rejects a renamed executable', () => {
  const base = {
    originalFileName: 'proof.jfif',
    declaredMimeType: 'image/jpeg',
    detectedMimeType: 'image/jpeg',
    sizeBytes: 5,
    sha256: 'a'.repeat(64),
    magicBytes: [255, 216, 255, 224],
  };
  expect(validateUploadFile(base).valid).toBe(true);
  expect(validateUploadFile({ ...base, magicBytes: [77, 90] }).valid).toBe(
    false,
  );
});
