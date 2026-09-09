/** A Unicode text layer accompanies the browser-shaped Persian page image.
 * Type 3 glyphs are invisible; ToUnicode preserves the actual document text for
 * search/copy without relying on a machine-specific PDF font installation. */
export interface PdfTextLine {
  text: string;
  x: number;
  y: number;
  size: number;
}
export interface HrPdfPage {
  image: Uint8Array;
  width: number;
  height: number;
  lines: readonly PdfTextLine[];
}
const enc = new TextEncoder();
const bytes = (text: string) => enc.encode(text);
const join = (parts: readonly Uint8Array[]) => {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
};
const utf16 = (text: string) =>
  Array.from({ length: text.length }, (_, index) =>
    text.charCodeAt(index).toString(16).padStart(4, '0'),
  )
    .join('')
    .toUpperCase();
const stream = (data: Uint8Array, attributes = '') =>
  join([
    bytes(`<< ${attributes} /Length ${data.length} >>\nstream\n`),
    data,
    bytes('\nendstream'),
  ]);
// PDF readers expect positioned glyphs in visual order, then apply Unicode bidi
// when extracting text. Keep Latin identifiers and numbers left-to-right inside
// the right-to-left Persian line; ActualText retains the original logical line.
export function pdfVisualText(text: string): string {
  return text.replace(
    /[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff\u200c]+(?:[ \t]+[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff\u200c]+)*/gu,
    (run) => Array.from(run).reverse().join(''),
  );
}
export function buildSearchablePdf(pages: readonly HrPdfPage[]): Uint8Array {
  if (!pages.length) throw new Error('PDF requires at least one page');
  const objects: Uint8Array[] = [];
  const add = (value: Uint8Array) => {
    objects.push(value);
    return objects.length;
  };
  const catalog = add(bytes(''));
  const pageTree = add(bytes(''));
  const glyph = add(stream(bytes('600 0 d0\n')));
  const characters = Array.from(
    new Set(
      pages.flatMap((page) =>
        page.lines.flatMap((line) => Array.from(line.text)),
      ),
    ),
  );
  const lookup = new Map<string, { font: number; code: number }>();
  const fonts: number[] = [];
  for (let offset = 0; offset < characters.length; offset += 100) {
    const set = characters.slice(offset, offset + 100);
    const fontIndex = fonts.length;
    set.forEach((char, index) =>
      lookup.set(char, { font: fontIndex, code: index + 1 }),
    );
    const mappings = set.map(
      (char, index) =>
        `<${(index + 1).toString(16).padStart(2, '0')}> <${utf16(char)}>`,
    );
    const cmap = add(
      stream(
        bytes(
          `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Rubi) /Ordering (Unicode) /Supplement 0 >> def /CMapName /RubiUnicode def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange\n${mappings.length} beginbfchar\n${mappings.join('\n')}\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end`,
        ),
      ),
    );
    const font = add(
      bytes(
        `<< /Type /Font /Subtype /Type3 /Name /F${fontIndex} /FontBBox [0 0 600 1000] /FontMatrix [0.001 0 0 0.001 0 0] /FirstChar 1 /LastChar ${set.length} /Widths [${set.map(() => 600).join(' ')}] /Encoding << /Type /Encoding /Differences [1 ${set.map((_, i) => `/g${i + 1}`).join(' ')}] >> /CharProcs << ${set.map((_, i) => `/g${i + 1} ${glyph} 0 R`).join(' ')} >> /Resources << >> /ToUnicode ${cmap} 0 R >>`,
      ),
    );
    fonts.push(font);
  }
  const kids: number[] = [];
  for (const page of pages) {
    const image = add(
      stream(
        page.image,
        `/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      ),
    );
    let commands = 'q 595 0 0 842 0 0 cm /PageImage Do Q\n';
    for (const line of page.lines) {
      const size = (line.size * 595) / page.width;
      commands += `/Span << /ActualText <FEFF${utf16(line.text)}> >> BDC\nBT 3 Tr 1 0 0 1 ${Math.max(20, (line.x * 595) / page.width - line.text.length * size * 0.6).toFixed(2)} ${(842 - (line.y * 842) / page.height).toFixed(2)} Tm\n`;
      let last = -1,
        chunk = '';
      for (const char of pdfVisualText(line.text)) {
        const mapped = lookup.get(char)!;
        if (mapped.font !== last) {
          if (chunk) commands += `<${chunk}> Tj\n`;
          chunk = '';
          commands += `/F${mapped.font} ${size.toFixed(2)} Tf\n`;
          last = mapped.font;
        }
        chunk += mapped.code.toString(16).padStart(2, '0');
      }
      if (chunk) commands += `<${chunk}> Tj\n`;
      commands += 'ET EMC\n';
    }
    const contents = add(stream(bytes(commands)));
    const id = add(
      bytes(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /PageImage ${image} 0 R >> /Font << ${fonts.map((font, index) => `/F${index} ${font} 0 R`).join(' ')} >> >> /Contents ${contents} 0 R >>`,
      ),
    );
    kids.push(id);
  }
  objects[catalog - 1] = bytes(
    `<< /Type /Catalog /Pages ${pageTree} 0 R /Lang (fa-IR) >>`,
  );
  objects[pageTree - 1] = bytes(
    `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] >>`,
  );
  const parts = [bytes('%PDF-1.7\n%Rubi\n')];
  const offsets = [0];
  let at = parts[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(at);
    const part = join([
      bytes(`${index + 1} 0 obj\n`),
      object,
      bytes('\nendobj\n'),
    ]);
    parts.push(part);
    at += part.length;
  });
  parts.push(
    bytes(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`,
    ),
  );
  return join(parts);
}
