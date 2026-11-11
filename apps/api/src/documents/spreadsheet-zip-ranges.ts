import { inflateRawSync } from 'node:zlib';

import { XLSX_MIME } from '@nora/contracts';

import {
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_EXPANSION_RATIO,
} from './documents.validation';

const maxZipTail = 65_558;
const maxDirectoryBytes = 1024 * 1024;
const maxManifestBytes = 256 * 1024;
const maxCompressedManifestBytes = 512 * 1024;

type ManifestEntry = {
  offset: number;
  compressed: number;
  expanded: number;
  method: number;
};

/**
 * Inspect ordinary ZIP directories from authenticated ranges. Undefined lets
 * the existing workbook parser handle layouts outside this bounded path.
 */
export async function spreadsheetZipTypeFromRanges(
  size: number,
  read: (offset: number, length: number) => Promise<Buffer>,
): Promise<string | null | undefined> {
  const tailOffset = Math.max(0, size - maxZipTail);
  const tail = await read(tailOffset, size - tailOffset);
  let end = tail.length - 22;
  while (end >= 0 && tail.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || (end < 20 && tailOffset > 0)) return undefined;
  if (end >= 20 && tail.readUInt32LE(end - 20) === 0x07064b50) return undefined;
  const count = tail.readUInt16LE(end + 8);
  const directorySize = tail.readUInt32LE(end + 12);
  const directoryOffset = tail.readUInt32LE(end + 16);
  if (
    tail.readUInt16LE(end + 4) ||
    tail.readUInt16LE(end + 6) ||
    count !== tail.readUInt16LE(end + 10) ||
    count === 0xffff ||
    directorySize > maxDirectoryBytes ||
    directoryOffset + directorySize > tailOffset + end
  )
    return undefined;
  if (!count || count > MAX_ARCHIVE_ENTRIES) return null;

  const directory =
    directoryOffset >= tailOffset
      ? tail.subarray(
          directoryOffset - tailOffset,
          directoryOffset - tailOffset + directorySize,
        )
      : await read(directoryOffset, directorySize);
  let entry = 0;
  let totalExpanded = 0;
  let workbook = false;
  let manifest: ManifestEntry | undefined;
  for (let index = 0; index < count; index++) {
    if (
      entry + 46 > directory.length ||
      directory.readUInt32LE(entry) !== 0x02014b50
    )
      return undefined;
    const nameLength = directory.readUInt16LE(entry + 28);
    const nameStart = entry + 46;
    const nameEnd = nameStart + nameLength;
    const next =
      nameEnd +
      directory.readUInt16LE(entry + 30) +
      directory.readUInt16LE(entry + 32);
    if (next > directory.length) return undefined;
    const flags = directory.readUInt16LE(entry + 8);
    const name = directory.toString(
      flags & 2048 ? 'utf8' : 'latin1',
      nameStart,
      nameEnd,
    );
    const compressed = directory.readUInt32LE(entry + 20);
    const expanded = directory.readUInt32LE(entry + 24);
    const offset = directory.readUInt32LE(entry + 42);
    if ([compressed, expanded, offset].includes(0xffffffff)) return undefined;
    totalExpanded += expanded;
    if (
      totalExpanded > size * MAX_ARCHIVE_EXPANSION_RATIO ||
      /vbaProject|macrosheets/i.test(name)
    )
      return null;
    if (name === 'xl/workbook.xml') workbook = true;
    if (name === '[Content_Types].xml') {
      if (expanded > maxManifestBytes) return null;
      if (manifest || compressed > maxCompressedManifestBytes || flags & 1)
        return undefined;
      manifest = {
        offset,
        compressed,
        expanded,
        method: directory.readUInt16LE(entry + 10),
      };
    }
    entry = next;
  }
  if (!workbook || !manifest) return null;
  const { offset, compressed, expanded, method } = manifest;
  if (
    offset + 30 + compressed > directoryOffset ||
    (method !== 0 && method !== 8)
  )
    return undefined;
  // Read the local header and enough space for its variable-length name and
  // extra data. The manifest itself is bounded independently above.
  const length = Math.min(
    directoryOffset - offset,
    30 + 2 * 65_535 + compressed,
  );
  const local =
    offset >= tailOffset
      ? tail.subarray(offset - tailOffset, offset - tailOffset + length)
      : await read(offset, length);
  if (local.readUInt32LE(0) !== 0x04034b50) return undefined;
  const start = 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  if (start + compressed > local.length) return undefined;
  const bytes = local.subarray(start, start + compressed);
  let content: Buffer;
  try {
    content =
      method === 0
        ? bytes
        : inflateRawSync(bytes, { maxOutputLength: maxManifestBytes });
  } catch {
    return null;
  }
  if (content.length !== expanded) return null;
  const xml = content.toString('utf8');
  return xml.includes(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  ) && !/macroEnabled|vbaProject/i.test(xml)
    ? XLSX_MIME
    : null;
}
