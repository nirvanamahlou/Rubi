import {
  buildSearchablePdf,
  type PdfPage,
} from '@/lib/customer-affairs-pdf-core';
import { companies, wrapLetterParagraph, type Letter } from './letter';

export async function renderLetterPages(
  letter: Letter,
  body: string,
): Promise<HTMLCanvasElement[]> {
  await document.fonts.ready;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('امکان ساخت خروجی وجود ندارد.');
  measure.font = '28px Vazirmatn, sans-serif';
  const lines: string[] = [];
  for (const paragraph of body.split('\n')) {
    lines.push(
      ...wrapLetterParagraph(
        paragraph,
        (text) => measure.measureText(text).width,
        1000,
      ),
    );
  }
  const pages: HTMLCanvasElement[] = [];
  const color =
    companies.find((company) => company.title === letter.company)?.color ??
    '#163b75';
  for (let offset = 0; offset < lines.length; offset += 24) {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ساخت خروجی ناموفق بود.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1240, 1754);
    context.fillStyle = color;
    context.fillRect(70, 60, 1100, 8);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.font = 'bold 44px Vazirmatn, sans-serif';
    context.fillText(letter.company, 1140, 145);
    context.font = '24px Vazirmatn, sans-serif';
    context.fillStyle = '#475569';
    context.fillText(
      `تاریخ: ${letter.date}     شماره: ${letter.number || '—'}`,
      1140,
      215,
    );
    context.font = 'bold 28px Vazirmatn, sans-serif';
    context.fillStyle = '#172033';
    // Bound metadata to the letter width; the body wraps onto additional pages.
    const header = [`گیرنده: ${letter.recipient}`, `موضوع: ${letter.subject}`];
    header.forEach((text, index) =>
      context.fillText(text, 1140, 285 + index * 55, 1000),
    );
    context.font = '28px Vazirmatn, sans-serif';
    lines
      .slice(offset, offset + 24)
      .forEach((text, index) => context.fillText(text, 1140, 440 + index * 46));
    context.fillStyle = '#64748b';
    context.font = '22px Vazirmatn, sans-serif';
    context.fillText(
      `${letter.company}     |     صفحه ${pages.length + 1}`,
      1140,
      1670,
    );
    pages.push(canvas);
  }
  return pages;
}
export async function letterDownloads(
  letter: Letter,
  body: string,
  format: 'png' | 'pdf',
) {
  const canvases = await renderLetterPages(letter, body);
  const images = await Promise.all(
    canvases.map(
      (canvas) =>
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error('ساخت فایل ناموفق بود.')),
            format === 'pdf' ? 'image/jpeg' : 'image/png',
            0.96,
          ),
        ),
    ),
  );
  if (format === 'png')
    return images.map((blob, index) => ({
      blob,
      name: `letter-${index + 1}.png`,
    }));
  const pages: PdfPage[] = await Promise.all(
    images.map(async (blob) => ({
      image: new Uint8Array(await blob.arrayBuffer()),
      width: 595,
      height: 842,
      lines: [],
    })),
  );
  return [
    {
      blob: new Blob([new Uint8Array(buildSearchablePdf(pages))], {
        type: 'application/pdf',
      }),
      name: 'letter.pdf',
    },
  ];
}
