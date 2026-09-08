// ZIP/XML primitives adapted from the existing customer workbook codec; no customer data is imported.
import {
  organizationHeaders,
  organizationImportLimit,
  type OrganizationImportRow,
} from './organization-import';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const maxFileBytes = 5 * 1024 * 1024;
const maxExpandedBytes = 20 * 1024 * 1024;

export function validateOrganizationWorkbookXml(xml: string) {
  for (const character of xml) {
    const code = character.codePointAt(0)!;
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127)
      throw new Error('نویسه کنترلی نامعتبر در فایل وجود دارد.');
  }
  if (
    /<!DOCTYPE|<!ENTITY|<(?:[\w.-]+:)?(?:f|ddeLink|oleObject|externalReference)\b|macroEnabled|vbaProject|TargetMode\s*=\s*["']External["']/i.test(
      xml,
    )
  )
    throw new Error('فرمول، ماکرو یا ارتباط خارجی در فایل مجاز نیست.');
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function joinBytes(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function zipStored(entries: readonly { name: string; content: string }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
  }

  const locals = joinBytes(localParts);
  const central = joinBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, locals.length, true);
  return joinBytes([locals, central, end]);
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function worksheetXml(rows: readonly (readonly string[])[]) {
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map(
            (value, columnIndex) =>
              `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function createOrganizationXlsx(rows: readonly (readonly string[])[]) {
  return zipStored([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Organizations" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) },
  ]);
}

export function downloadOrganizationXlsx(
  filename: string,
  rows: readonly (readonly string[])[],
) {
  const bytes = createOrganizationXlsx(rows);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function unzipWorkbook(buffer: ArrayBuffer) {
  if (buffer.byteLength > maxFileBytes || buffer.byteLength < 22)
    throw new Error('فایل XLSX باید حداکثر ۵ مگابایت و معتبر باشد.');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = bytes.length - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50)
    endOffset -= 1;
  if (endOffset < 0) throw new Error('فایل XLSX معتبر نیست.');
  const entryCount = view.getUint16(endOffset + 10, true);
  if (
    !entryCount ||
    entryCount > 100 ||
    view.getUint16(endOffset + 4, true) !== 0 ||
    view.getUint16(endOffset + 6, true) !== 0
  )
    throw new Error('ساختار یا تعداد فایل‌های XLSX مجاز نیست.');
  let offset = view.getUint32(endOffset + 16, true);
  const files = new Map<string, string>();
  let expandedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('ساختار XLSX قابل خواندن نیست.');
    const method = view.getUint16(offset + 10, true);
    const flags = view.getUint16(offset + 8, true);
    const expectedSize = view.getUint32(offset + 24, true);
    const expectedCrc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (
      flags & 1 ||
      expectedSize > maxExpandedBytes ||
      expandedBytes + expectedSize > maxExpandedBytes ||
      offset + 46 + nameLength + extraLength + commentLength > endOffset ||
      localOffset + 30 > buffer.byteLength
    )
      throw new Error('فایل رمزدار یا اندازه غیرمجاز XLSX.');
    const name = decoder.decode(
      bytes.slice(offset + 46, offset + 46 + nameLength),
    );
    if (
      files.has(name) ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').some((part) => part === '..' || part === '.') ||
      /:|vbaProject|embeddings|externalLinks/i.test(name)
    )
      throw new Error('مسیر داخلی ناامن یا تکراری در XLSX.');
    if (
      view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 8, true) !== method ||
      view.getUint16(localOffset + 6, true) !== flags
    )
      throw new Error('ساختار فایل فشرده سازگار نیست.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (
      dataStart + compressedSize > offset ||
      decoder.decode(
        bytes.slice(localOffset + 30, localOffset + 30 + localNameLength),
      ) !== name
    )
      throw new Error('محدوده داخلی فایل فشرده معتبر نیست.');
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) {
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw' as 'deflate'));
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > expectedSize || expandedBytes + size > maxExpandedBytes)
            throw new Error('حجم بازشده فایل بیش از حد مجاز است.');
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      content = joinBytes(chunks);
    } else throw new Error('نوع فشرده‌سازی XLSX پشتیبانی نمی‌شود.');
    if (content.byteLength !== expectedSize || crc32(content) !== expectedCrc)
      throw new Error('یکپارچگی فایل XLSX تأیید نشد.');
    expandedBytes += content.byteLength;
    const xml = decoder.decode(content);
    if (name.endsWith('.xml') || name.endsWith('.rels'))
      validateOrganizationWorkbookXml(xml);
    files.set(name, xml);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function cellColumn(reference: string) {
  return (
    [...reference.replaceAll(/\d/g, '')].reduce(
      (value, character) => value * 26 + character.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

export async function parseOrganizationXlsx(
  file: File,
): Promise<OrganizationImportRow[]> {
  if (file.size > maxFileBytes || !file.name.toLowerCase().endsWith('.xlsx'))
    throw new Error('فقط فایل XLSX تا ۵ مگابایت مجاز است.');
  const files = await unzipWorkbook(await file.arrayBuffer());
  const documents = new Map<string, Document>();
  for (const [name, xml] of files) {
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.getElementsByTagName('parsererror').length)
      throw new Error('ساختار XML فایل معتبر نیست.');
    for (const element of document.getElementsByTagName('*')) {
      if (
        ['f', 'ddeLink', 'oleObject', 'externalReference'].includes(
          element.localName,
        )
      )
        throw new Error('محتوای فعال در اکسل مجاز نیست.');
      if (
        element.localName === 'Relationship' &&
        (element.getAttribute('TargetMode')?.toLowerCase() === 'external' ||
          /:|\\/.test(element.getAttribute('Target') ?? ''))
      )
        throw new Error('ارتباط خارجی در اکسل مجاز نیست.');
    }
    documents.set(name, document);
  }
  const workbook = documents.get('xl/workbook.xml');
  const sheets = workbook?.getElementsByTagNameNS('*', 'sheet');
  if (!sheets || sheets.length !== 1)
    throw new Error('قالب ورودی باید دقیقاً یک برگه داشته باشد.');
  const sheet = documents.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('برگه اصلی قالب پیدا نشد.');
  const strings = [
    ...(documents
      .get('xl/sharedStrings.xml')
      ?.getElementsByTagNameNS('*', 'si') ?? []),
  ].map((item) =>
    [...item.getElementsByTagNameNS('*', 't')]
      .map((text) => text.textContent ?? '')
      .join(''),
  );
  const sourceRows = [...sheet.getElementsByTagNameNS('*', 'row')];
  if (sourceRows.length > organizationImportLimit + 1)
    throw new Error('حداکثر ۲۰۰ سازمان در هر فایل مجاز است.');
  const rows = sourceRows.map((row) => {
    const values: string[] = [];
    for (const cell of row.getElementsByTagNameNS('*', 'c')) {
      const reference = cell.getAttribute('r') ?? '';
      if (!/^[A-Z]{1,2}[1-9]\d{0,6}$/.test(reference))
        throw new Error('نشانی سلول نامعتبر است.');
      const index = cellColumn(reference);
      if (index > 15 || values[index] !== undefined)
        throw new Error('ستون تکراری یا خارج از قالب وجود دارد.');
      const type = cell.getAttribute('t');
      const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? '';
      if (
        type === 's' &&
        (!/^\d+$/.test(raw) || strings[Number(raw)] === undefined)
      )
        throw new Error('مرجع متن سلول نامعتبر است.');
      const value =
        type === 's'
          ? strings[Number(raw)]!
          : type === 'inlineStr'
            ? [...cell.getElementsByTagNameNS('*', 't')]
                .map((text) => text.textContent ?? '')
                .join('')
            : raw;
      if (value.length > 1000) throw new Error('متن سلول بیش از حد مجاز است.');
      values[index] = value.trim();
    }
    return values;
  });
  const [headers = [], ...data] = rows;
  const aliases = new Map<string, string>([
    ['code', organizationHeaders[0]],
    ['legalName', organizationHeaders[1]],
    ['personType', organizationHeaders[2]],
    ['roleCodes', organizationHeaders[3]],
  ]);
  const normalized = headers.map((header) => aliases.get(header) ?? header);
  if (
    new Set(normalized.filter(Boolean)).size !==
    normalized.filter(Boolean).length
  )
    throw new Error('عنوان ستون تکراری است.');
  if (organizationHeaders.some((header) => !normalized.includes(header)))
    throw new Error('ستون‌های فایل با قالب سازمان‌ها مطابقت ندارند.');
  return data
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      code: row[normalized.indexOf(organizationHeaders[0])] ?? '',
      legalName: row[normalized.indexOf(organizationHeaders[1])] ?? '',
      personType: row[normalized.indexOf(organizationHeaders[2])] ?? '',
      roleCodes: row[normalized.indexOf(organizationHeaders[3])] ?? '',
    }));
}
