import type { CommercialReport } from './commercial-export';

export function isolateCommercialIdentifiers(text: string) {
  return text.replace(/[A-Za-z0-9][A-Za-z0-9_.,:/%+-]*/g, '\u2066$&\u2069');
}

export function buildCommercialPdf(images: readonly Uint8Array[]): Uint8Array {
  const enc = new TextEncoder();
  const join = (parts: readonly Uint8Array[]) => {
    const bytes = new Uint8Array(
      parts.reduce((sum, item) => sum + item.length, 0),
    );
    let at = 0;
    for (const item of parts) {
      bytes.set(item, at);
      at += item.length;
    }
    return bytes;
  };
  const objects: Uint8Array[] = [];
  objects.push(enc.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(
    enc.encode(
      `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`,
    ),
  );
  images.forEach((image, index) => {
    const page = 3 + index * 3;
    objects.push(
      enc.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /PageImage ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`,
      ),
    );
    objects.push(
      join([
        enc.encode(
          `<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
        ),
        image,
        enc.encode('\nendstream'),
      ]),
    );
    const command = 'q 595 0 0 842 0 0 cm /PageImage Do Q\n';
    objects.push(
      enc.encode(
        `<< /Length ${enc.encode(command).length} >>\nstream\n${command}endstream`,
      ),
    );
  });
  const parts = [enc.encode('%PDF-1.4\n%Rubi\n')];
  const offsets = [0];
  let at = parts[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(at);
    const bytes = join([
      enc.encode(`${index + 1} 0 obj\n`),
      object,
      enc.encode('\nendobj\n'),
    ]);
    parts.push(bytes);
    at += bytes.length;
  });
  parts.push(
    enc.encode(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`,
    ),
  );
  return join(parts);
}

/** Browser text shaping preserves Persian ligatures and the loaded Rubi font. */
export async function commercialPdf(
  report: CommercialReport,
): Promise<Uint8Array> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ساخت PDF در این مرورگر امکان‌پذیر نیست.');
  const font = getComputedStyle(document.body).fontFamily;
  const images: Uint8Array[] = [];
  let y = 0;
  const start = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#103c78';
    ctx.font = `bold 30px ${font}`;
    ctx.fillText('روبی · قرارداد و شرایط تجاری', 1170, 65);
    ctx.font = `20px ${font}`;
    ctx.fillText(
      `صفحه ${(images.length + 1).toLocaleString('fa-IR')}`,
      1170,
      1705,
    );
    y = 125;
  };
  const save = () => {
    const data = atob(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]!);
    images.push(Uint8Array.from(data, (c) => c.charCodeAt(0)));
    if (images.length > 150)
      throw new Error('گزارش بیش از ۱۵۰ صفحه است؛ بازه تاریخ را محدود کنید.');
  };
  const line = (text: string, heading = false) => {
    const apply = () => {
      ctx.font = `${heading ? 'bold ' : ''}24px ${font}`;
      ctx.fillStyle = heading ? '#103c78' : '#253850';
    };
    apply();
    const lines: string[] = [];
    let current = '';
    for (const char of text) {
      if (char === '\n' || ctx.measureText(current + char).width > 1090) {
        lines.push(current);
        current = char === '\n' ? '' : char;
      } else current += char;
    }
    if (current) lines.push(current);
    for (const value of lines) {
      if (y > 1625) {
        save();
        start();
        apply();
      }
      ctx.fillText(isolateCommercialIdentifiers(value), 1170, y);
      y += 37;
    }
  };
  start();
  line(report.title, true);
  report.context.forEach((text) => line(text));
  for (const section of report.sections) {
    y += 18;
    line(
      `${section.title} · ${section.rows.length.toLocaleString('fa-IR')} ردیف`,
      true,
    );
    if (!section.rows.length) line('رکوردی مطابق فیلترها وجود ندارد.');
    for (const [index, row] of section.rows.entries()) {
      line(
        `${section.title} — ردیف ${(index + 1).toLocaleString('fa-IR')}`,
        true,
      );
      section.columns.forEach((column, i) =>
        line(`${column}: ${row[i] || '—'}`),
      );
      y += 18;
    }
  }
  save();
  return buildCommercialPdf(images);
}
