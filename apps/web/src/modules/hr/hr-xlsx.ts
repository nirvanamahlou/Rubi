const encoder = new TextEncoder();

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

export function createHrXlsx(rows: readonly (readonly string[])[]) {
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
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Employees" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) },
  ]);
}

export function downloadHrXlsx(
  filename: string,
  rows: readonly (readonly string[])[],
) {
  const url = URL.createObjectURL(
    new Blob([createHrXlsx(rows)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Reads bounded, non-macro XLSX workbooks, including Excel shared strings. */
export async function readHrXlsx(file: File): Promise<string[][]> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
    throw new Error('فایل XLSX با حجم حداکثر ۵ مگابایت انتخاب کنید.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  )
    end--;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50)
    throw new Error('ساختار فایل اکسل معتبر نیست.');
  const count = view.getUint16(end + 10, true);
  if (count > 200) throw new Error('فایل اکسل بیش از حد پیچیده است.');
  let cursor = view.getUint32(end + 16, true);
  let total = 0;
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error('فایل اکسل خراب است.');
    const method = view.getUint16(cursor + 10, true),
      compressed = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
    );
    total += size;
    if (total > 20 * 1024 * 1024 || /vbaProject|externalLinks/i.test(name))
      throw new Error('فایل دارای محتوای غیرمجاز یا حجم بازشده بیش از حد است.');
    if (
      name === 'xl/sharedStrings.xml' ||
      name === 'xl/worksheets/sheet1.xml'
    ) {
      if (offset + 30 > bytes.length) throw new Error('فایل اکسل خراب است.');
      const start =
        offset +
        30 +
        view.getUint16(offset + 26, true) +
        view.getUint16(offset + 28, true);
      if (start + compressed > bytes.length)
        throw new Error('فایل اکسل ناقص است.');
      let data = bytes.slice(start, start + compressed);
      if (method === 8) {
        const reader = new Blob([data])
          .stream()
          .pipeThrough(new DecompressionStream('deflate-raw'))
          .getReader();
        const parts: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          length += result.value.length;
          if (length > size || length > 20 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('حجم فایل نامعتبر است.');
          }
          parts.push(result.value);
        }
        data = joinBytes(parts);
      } else if (method !== 0)
        throw new Error('فشرده‌سازی فایل پشتیبانی نمی‌شود.');
      files.set(name, new TextDecoder().decode(data));
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const parse = (xml: string) => {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new Error('ساختار XML مجاز نیست.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror'))
      throw new Error('ساختار XML خراب است.');
    return doc;
  };
  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared = sharedXml
    ? Array.from(parse(sharedXml).getElementsByTagName('si')).map(
        (item) => item.textContent ?? '',
      )
    : [];
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('برگه اول اکسل پیدا نشد.');
  const doc = parse(sheet);
  if (doc.getElementsByTagName('f').length)
    throw new Error('فرمول‌ها را پیش از ورود به مقدار ثابت تبدیل کنید.');
  const rows = Array.from(doc.getElementsByTagName('row'));
  if (rows.length > 10001)
    throw new Error('حداکثر ۱۰٬۰۰۰ رکورد قابل ورود است.');
  return rows.map((row) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const column =
        (cell.getAttribute('r') ?? '').match(/^[A-Z]+/)?.[0] ?? 'A';
      const index =
        Array.from(column).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) -
        1;
      if (index > 100) throw new Error('تعداد ستون‌ها بیش از حد است.');
      const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      const value =
        cell.getAttribute('t') === 's'
          ? (shared[Number(raw)] ?? '')
          : cell.getAttribute('t') === 'inlineStr'
            ? (cell.getElementsByTagName('is')[0]?.textContent ?? '')
            : raw;
      if (value.length > 10000)
        throw new Error('محتوای سلول بیش از حد طولانی است.');
      values[index] = value;
    }
    return Array.from(
      { length: values.length },
      (_, index) => values[index] ?? '',
    );
  });
}
