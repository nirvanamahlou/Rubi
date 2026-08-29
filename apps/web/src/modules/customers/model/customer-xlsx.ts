const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const customerImportHeaders = [
  'نام مشتری*',
  'شماره تماس',
  'ایمیل',
  'تاریخ تولد',
] as const;

export interface CustomerImportRow {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
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

export function createCustomerXlsx(rows: readonly (readonly string[])[]) {
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
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Customers" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) },
  ]);
}

export function downloadCustomerXlsx(
  filename: string,
  rows: readonly (readonly string[])[],
) {
  const bytes = createCustomerXlsx(rows);
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

async function unzipWorkbook(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = bytes.length - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50)
    endOffset -= 1;
  if (endOffset < 0) throw new Error('فایل XLSX معتبر نیست.');
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const files = new Map<string, string>();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('ساختار XLSX قابل خواندن نیست.');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      bytes.slice(offset + 46, offset + 46 + nameLength),
    );
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) {
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw' as 'deflate'));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error('نوع فشرده‌سازی XLSX پشتیبانی نمی‌شود.');
    files.set(name, decoder.decode(content));
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

export async function parseCustomerXlsx(file: File) {
  const files = await unzipWorkbook(await file.arrayBuffer());
  const sheetXml = files.get('xl/worksheets/sheet1.xml');
  if (!sheetXml) throw new Error('Sheet مشتریان در فایل پیدا نشد.');
  const sharedXml = files.get('xl/sharedStrings.xml');
  const sharedStrings = sharedXml
    ? [
        ...new DOMParser()
          .parseFromString(sharedXml, 'application/xml')
          .getElementsByTagName('si'),
      ].map((item) =>
        [...item.getElementsByTagName('t')]
          .map((text) => text.textContent ?? '')
          .join(''),
      )
    : [];
  const sheet = new DOMParser().parseFromString(sheetXml, 'application/xml');
  const rows = [...sheet.getElementsByTagName('row')].map((row) => {
    const values: string[] = [];
    for (const cell of [...row.getElementsByTagName('c')]) {
      const index = cellColumn(cell.getAttribute('r') ?? 'A1');
      const type = cell.getAttribute('t');
      const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      values[index] =
        type === 's'
          ? (sharedStrings[Number(raw)] ?? '')
          : type === 'inlineStr'
            ? (cell.getElementsByTagName('t')[0]?.textContent ?? '')
            : raw;
    }
    return values;
  });
  const [headers = [], ...data] = rows;
  const positions = new Map(
    headers.map((header, index) => [header.trim(), index]),
  );
  const nameIndex = positions.get(customerImportHeaders[0]);
  if (nameIndex === undefined)
    throw new Error(`ستون اجباری «${customerImportHeaders[0]}» پیدا نشد.`);
  const valueAt = (row: readonly string[], header: string) =>
    row[positions.get(header) ?? -1]?.trim() ?? '';
  return data
    .map<CustomerImportRow>((row) => ({
      name: row[nameIndex]?.trim() ?? '',
      phone: valueAt(row, customerImportHeaders[1]),
      email: valueAt(row, customerImportHeaders[2]),
      birthDate: valueAt(row, customerImportHeaders[3]),
    }))
    .filter((row) => row.name || row.phone || row.email || row.birthDate);
}
