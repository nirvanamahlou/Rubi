import { BadRequestException } from '@nestjs/common';
import { unzipSync, strFromU8 } from 'fflate';

const fail = () => {
  throw new BadRequestException(
    'فایل اکسل معتبر نیست یا از محدودیت مجاز عبور کرده است.',
  );
};
const xmlText = (text: string) =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
function sheetXml(xml: string, strings: string[]) {
  if (/<!DOCTYPE|<!ENTITY|<f[ >]|<\w+:f[ >]/i.test(xml)) fail();
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells: string[] = [];
    for (const cell of row[1]!.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      if (/\bt="e"/.test(cell[1]!)) fail();
      const address = /\br="([A-Z]+)\d+"/.exec(cell[1]!)?.[1];
      if (!address) fail();
      const column =
        [...address!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (column > 200) fail();
      const value =
        /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell[2]!)?.[1] ?? xmlText(cell[2]!);
      cells[column] = /\bt="s"/.test(cell[1]!)
        ? (strings[Number(value)] ?? fail())
        : xmlText(value);
    }
    rows.push(cells);
    if (rows.length > 1001) fail();
  }
  return rows;
}

/** Bounded CFB reader for the Workbook stream of BIFF8 .xls; never executes macros/formulas. */
function biffWorkbook(file: Buffer): Buffer {
  if (
    file.length < 512 ||
    file.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1'
  )
    return fail();
  const size = 2 ** file.readUInt16LE(30),
    miniSize = 2 ** file.readUInt16LE(32);
  if (![512, 4096].includes(size) || miniSize !== 64) return fail();
  const sector = (id: number) => {
    const from = (id + 1) * size;
    if (id < 0 || from + size > file.length) return fail();
    return file.subarray(from, from + size);
  };
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const id = file.readInt32LE(76 + i * 4);
    if (id >= 0) difat.push(id);
  }
  let cursor = file.readInt32LE(68);
  const seenDifat = new Set<number>();
  while (cursor >= 0) {
    if (seenDifat.has(cursor) || seenDifat.size > 500) return fail();
    seenDifat.add(cursor);
    const data = sector(cursor);
    for (let i = 0; i < size / 4 - 1; i++) {
      const id = data.readInt32LE(i * 4);
      if (id >= 0) difat.push(id);
    }
    cursor = data.readInt32LE(size - 4);
  }
  const fat = Buffer.concat(difat.map(sector));
  const chain = (
    start: number,
    table: Buffer,
    read: (id: number) => Buffer,
    limit: number,
  ) => {
    const chunks: Buffer[] = [];
    const seen = new Set<number>();
    let id = start;
    while (id >= 0) {
      if (
        seen.has(id) ||
        seen.size * limit > 20 * 1024 * 1024 ||
        id * 4 + 4 > table.length
      )
        return fail();
      seen.add(id);
      chunks.push(read(id));
      id = table.readInt32LE(id * 4);
    }
    return Buffer.concat(chunks);
  };
  const dirs = chain(file.readInt32LE(48), fat, sector, size);
  let root: { start: number; size: number } | undefined;
  let workbook: { start: number; size: number } | undefined;
  for (let i = 0; i + 128 <= dirs.length; i += 128) {
    const nameLength = dirs.readUInt16LE(i + 64);
    if (nameLength > 64) return fail();
    const name = dirs
      .subarray(i, i + Math.max(0, nameLength - 2))
      .toString('utf16le');
    const entry = {
      start: dirs.readInt32LE(i + 116),
      size: Number(dirs.readBigUInt64LE(i + 120)),
    };
    if (entry.size > 20 * 1024 * 1024) return fail();
    if (dirs[i + 66] === 5) root = entry;
    if (['Workbook', 'Book'].includes(name)) workbook = entry;
    if (/VBA|Macros/i.test(name)) return fail();
  }
  if (!workbook) return fail();
  if (workbook.size >= 4096)
    return chain(workbook.start, fat, sector, size).subarray(0, workbook.size);
  if (!root) return fail();
  const miniStream = chain(root.start, fat, sector, size);
  const miniFat = chain(file.readInt32LE(60), fat, sector, size);
  return chain(
    workbook.start,
    miniFat,
    (id) => {
      if (id * 64 + 64 > miniStream.length) return fail();
      return miniStream.subarray(id * 64, id * 64 + 64);
    },
    64,
  ).subarray(0, workbook.size);
}
function biffRows(file: Buffer) {
  const stream = biffWorkbook(file),
    records: { id: number; data: Buffer; offset: number }[] = [];
  for (let at = 0; at + 4 <= stream.length;) {
    const id = stream.readUInt16LE(at),
      length = stream.readUInt16LE(at + 2);
    if (at + 4 + length > stream.length) return fail();
    records.push({
      id,
      data: stream.subarray(at + 4, at + 4 + length),
      offset: at,
    });
    at += 4 + length;
  }
  const strings: string[] = [];
  const sstIndex = records.findIndex((r) => r.id === 0xfc);
  if (sstIndex >= 0) {
    const chunks = [records[sstIndex]!.data.subarray(8)];
    let next = sstIndex + 1;
    while (records[next]?.id === 0x3c) chunks.push(records[next++]!.data);
    let chunk = 0,
      pos = 0;
    const byte = () => {
      while (pos >= chunks[chunk]!.length) {
        chunk++;
        pos = 0;
        if (!chunks[chunk]) return fail();
      }
      return chunks[chunk]![pos++]!;
    };
    const short = () => byte() | (byte() << 8);
    const count = records[sstIndex]!.data.readUInt32LE(4);
    if (count > 100000) return fail();
    for (let i = 0; i < count; i++) {
      const length = short();
      let flags = byte();
      const runs = flags & 8 ? short() : 0;
      const extra =
        flags & 4
          ? (byte() | (byte() << 8) | (byte() << 16) | (byte() << 24)) >>> 0
          : 0;
      let text = '';
      for (let j = 0; j < length; j++) {
        if (pos >= chunks[chunk]!.length) {
          chunk++;
          pos = 0;
          if (!chunks[chunk]) return fail();
          flags = byte();
        }
        text += String.fromCharCode(flags & 1 ? short() : byte());
      }
      for (let j = 0; j < runs * 4 + extra; j++) byte();
      strings.push(text);
    }
  }
  const bound = records.find((r) => r.id === 0x85);
  if (!bound || bound.data.length < 6 || bound.data[5] !== 0) return fail();
  const start = bound.data.readUInt32LE(0);
  const rows: string[][] = [];
  const cell = (r: number, c: number, value: string) => {
    if (r > 1000 || c > 200) return fail();
    (rows[r] ??= [])[c] = value;
  };
  const rk = (data: Buffer, offset: number) => {
    const raw = data.readUInt32LE(offset);
    let value: number;
    if (raw & 2) value = data.readInt32LE(offset) >> 2;
    else {
      const bytes = Buffer.alloc(8);
      bytes.writeUInt32LE((raw & 0xfffffffc) >>> 0, 4);
      value = bytes.readDoubleLE();
    }
    if (!Number.isFinite(value)) return fail();
    return String(raw & 1 ? value / 100 : value);
  };
  for (const r of records) {
    if (r.offset < start) continue;
    if (r.id === 0x0a) break;
    const d = r.data;
    if ([0x06, 0x4bc, 0x1b8].includes(r.id)) return fail();
    if (r.id === 0xfd) {
      if (d.length < 10) return fail();
      cell(
        d.readUInt16LE(0),
        d.readUInt16LE(2),
        strings[d.readUInt32LE(6)] ?? fail(),
      );
    } else if (r.id === 0x203) {
      if (d.length < 14) return fail();
      cell(d.readUInt16LE(0), d.readUInt16LE(2), String(d.readDoubleLE(6)));
    } else if (r.id === 0xbd) {
      if (d.length < 12 || (d.length - 6) % 6 !== 0) return fail();
      const row = d.readUInt16LE(0),
        first = d.readUInt16LE(2),
        last = d.readUInt16LE(d.length - 2);
      if (last - first + 1 !== (d.length - 6) / 6) return fail();
      for (let column = first; column <= last; column++)
        cell(row, column, rk(d, 6 + (column - first) * 6));
    } else if (r.id === 0x205) {
      if (d.length < 8 || d[7] !== 0) return fail();
      cell(d.readUInt16LE(0), d.readUInt16LE(2), d[6] ? 'TRUE' : 'FALSE');
    } else if (r.id === 0x204) {
      if (d.length < 9) return fail();
      const count = d.readUInt16LE(6),
        wide = Boolean(d[8]! & 1);
      if (d.length < 9 + count * (wide ? 2 : 1)) return fail();
      cell(
        d.readUInt16LE(0),
        d.readUInt16LE(2),
        d
          .subarray(9, 9 + count * (wide ? 2 : 1))
          .toString(wide ? 'utf16le' : 'latin1'),
      );
    } else if (r.id === 0x27e) {
      if (d.length < 10) return fail();
      const raw = d.readUInt32LE(6);
      let value: number;
      if (raw & 2) value = d.readInt32LE(6) >> 2;
      else {
        const b = Buffer.alloc(8);
        b.writeUInt32LE((raw & 0xfffffffc) >>> 0, 4);
        value = b.readDoubleLE();
      }
      cell(
        d.readUInt16LE(0),
        d.readUInt16LE(2),
        String(raw & 1 ? value / 100 : value),
      );
    }
  }
  return rows.filter(Boolean);
}
export function readPayslipWorkbook(buffer: Buffer, name: string): string[][] {
  if (
    !/\.(xlsx|xls)$/i.test(name) ||
    !buffer.length ||
    buffer.length > 10 * 1024 * 1024
  )
    return fail();
  if (/\.xls$/i.test(name)) {
    try {
      return biffRows(buffer);
    } catch {
      return fail();
    }
  }
  let total = 0,
    entries = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer, {
      filter: (entry) => {
        total += entry.originalSize;
        if (
          ++entries > 300 ||
          total > 20 * 1024 * 1024 ||
          /\.\.|vba|externalLinks|embeddings/i.test(entry.name)
        )
          return fail();
        return /\.xml$|\.rels$/.test(entry.name);
      },
    });
  } catch {
    return fail();
  }
  for (const file of Object.values(files))
    if (
      /<!DOCTYPE|<!ENTITY|TargetMode=["']External|<externalLink/i.test(
        strFromU8(file),
      )
    )
      return fail();
  const shared = strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array());
  const strings = [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(
    (match) => xmlText(match[1]!),
  );
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) return fail();
  return sheetXml(strFromU8(sheet), strings);
}
