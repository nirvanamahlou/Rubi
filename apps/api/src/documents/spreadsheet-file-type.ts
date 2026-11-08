import { unzipSync } from 'fflate';
import { XLS_MIME, XLSX_MIME } from '@nora/contracts';
import {
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_EXPANSION_RATIO,
} from './documents.validation';
const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Recognize workbook containers, not arbitrary renamed ZIP/OLE files. Never execute or extract them. */
export function spreadsheetFileType(bytes: Buffer): string | null {
  try {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      let count = 0,
        expanded = 0;
      const names = new Set<string>();
      const parts = unzipSync(bytes, {
        filter: (file) => {
          if (
            ++count > MAX_ARCHIVE_ENTRIES ||
            (expanded += file.originalSize) >
              bytes.length * MAX_ARCHIVE_EXPANSION_RATIO
          )
            throw new Error('Archive limit');
          names.add(file.name);
          if (/vbaProject|macrosheets/i.test(file.name))
            throw new Error('Macro workbook');
          if (file.name === '[Content_Types].xml') {
            if (file.originalSize > 256 * 1024)
              throw new Error('Content type limit');
            return true;
          }
          return false;
        },
      });
      const content = Buffer.from(parts['[Content_Types].xml'] ?? []).toString(
        'utf8',
      );
      return names.has('xl/workbook.xml') &&
        content.includes(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
        ) &&
        !/macroEnabled|vbaProject/i.test(content)
        ? XLSX_MIME
        : null;
    }
    if (
      bytes.length < 512 ||
      !bytes.subarray(0, 8).equals(ole) ||
      bytes.readUInt16LE(28) !== 0xfffe
    )
      return null;
    const shift = bytes.readUInt16LE(30);
    if (![9, 12].includes(shift)) return null;
    const size = 2 ** shift;
    const sector = (id: number) => {
      const start = (id + 1) * size;
      if (id >= 0xfffffffa || start + size > bytes.length)
        throw new Error('Invalid sector');
      return bytes.subarray(start, start + size);
    };
    const fatIds: number[] = [];
    const add = (id: number) => {
      if (id !== 0xffffffff) fatIds.push(id);
    };
    for (let offset = 76; offset < 512; offset += 4)
      add(bytes.readUInt32LE(offset));
    let difat = bytes.readUInt32LE(68);
    const seen = new Set<number>();
    while (difat !== 0xfffffffe && difat !== 0xffffffff) {
      if (seen.has(difat) || seen.size > 512)
        throw new Error('Invalid DIFAT chain');
      seen.add(difat);
      const block = sector(difat);
      for (let offset = 0; offset < size - 4; offset += 4)
        add(block.readUInt32LE(offset));
      difat = block.readUInt32LE(size - 4);
    }
    if (fatIds.length !== bytes.readUInt32LE(44) || fatIds.length > 512)
      return null;
    const fat = Buffer.concat(fatIds.map(sector));
    let directory = bytes.readUInt32LE(48),
      workbook = false;
    seen.clear();
    while (directory !== 0xfffffffe) {
      if (
        seen.has(directory) ||
        seen.size > 256 ||
        directory * 4 + 4 > fat.length
      )
        throw new Error('Invalid directory chain');
      seen.add(directory);
      const block = sector(directory);
      for (let offset = 0; offset < size; offset += 128) {
        const length = block.readUInt16LE(offset + 64),
          kind = block[offset + 66];
        if (!kind) continue;
        if (length < 2 || length > 64 || length % 2)
          throw new Error('Invalid directory entry');
        const name = block
          .subarray(offset, offset + length - 2)
          .toString('utf16le');
        if (/^(VBA|_VBA_PROJECT|PROJECT|Macros)$/i.test(name)) return null;
        if (kind === 2 && /^(Workbook|Book)$/.test(name)) workbook = true;
      }
      directory = fat.readUInt32LE(directory * 4);
    }
    return workbook ? XLS_MIME : null;
  } catch {
    return null;
  }
}
