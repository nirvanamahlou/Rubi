'use client';
import { reportCellText, type SectionReport } from './section-reports';

export function buildReportPdf(images: readonly Uint8Array[]): Uint8Array {
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

export async function downloadSectionPdf(
  title: string,
  reports: readonly SectionReport[],
) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('مرورگر امکان ساخت گزارش را ندارد.');
  const images: Uint8Array[] = [];
  let y = 0;
  let page = 0;
  const start = () => {
    page++;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1240, 1754);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#103c78';
    context.font = 'bold 34px Vazirmatn, Tahoma, sans-serif';
    context.fillText(`گزارش ${title}`, 1170, 75);
    context.font = '22px Vazirmatn, Tahoma, sans-serif';
    context.fillStyle = '#52657c';
    context.fillText(
      `داده‌های نشست · ${new Date().toLocaleString('fa-IR')} · صفحه ${page.toLocaleString('fa-IR')}`,
      1170,
      117,
    );
    y = 175;
  };
  const save = () => {
    const binary = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!);
    images.push(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    if (images.length > 200)
      throw new Error('گزارش بیش از ۲۰۰ صفحه است؛ فیلتر را محدود کنید.');
  };
  const line = (text: string, heading = false) => {
    context.font = `${heading ? 'bold ' : ''}25px Vazirmatn, Tahoma, sans-serif`;
    const output: string[] = [];
    let current = '';
    for (const char of text) {
      if (char === '\n' || context.measureText(current + char).width > 1090) {
        output.push(current);
        current = char === '\n' ? '' : char;
      } else current += char;
    }
    if (current) output.push(current);
    for (const value of output) {
      if (y > 1650) {
        save();
        start();
      }
      context.fillStyle = heading ? '#103c78' : '#24354b';
      context.font = `${heading ? 'bold ' : ''}25px Vazirmatn, Tahoma, sans-serif`;
      context.fillText(value, 1170, y);
      y += 39;
    }
  };
  start();
  for (const report of reports) {
    line(
      `${report.title} — ${report.data.rows.length.toLocaleString('fa-IR')} رکورد`,
      true,
    );
    if (!report.data.rows.length) line('رکوردی وجود ندارد.');
    report.data.rows.forEach((row, index) => {
      line(`رکورد ${(index + 1).toLocaleString('fa-IR')}`, true);
      report.data.columns.forEach((column, cellIndex) =>
        line(`${column}: ${reportCellText(row[cellIndex] ?? '') || '—'}`),
      );
      y += 18;
    });
  }
  save();
  const blob = new Blob([new Uint8Array(buildReportPdf(images))], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `گزارش-${title}-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
