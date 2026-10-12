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
  const company = companies.find((item) => item.title === letter.company);
  if (!company) throw new Error('شرکت نامه معتبر نیست.');
  const background = new Image();
  background.src = company.letterhead;
  await background.decode().catch(() => {
    throw new Error('بارگذاری سربرگ شرکت ناموفق بود. دوباره تلاش کنید.');
  });
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
  for (let offset = 0; offset < lines.length; offset += 22) {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ساخت خروجی ناموفق بود.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1240, 1754);
    context.drawImage(background, 0, 0, 1240, 1754);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.font = '24px Vazirmatn, sans-serif';
    context.textBaseline = 'middle';
    [letter.date, letter.number || '—', letter.attachment || 'ندارد'].forEach(
      (value, index) => {
        const y = company.metadataY[index]! * canvas.height;
        // Replace only the dotted value area; preserve the supplied labels/logo.
        context.fillStyle = '#fff';
        context.fillRect(55, y - 17, company.metadataRight - 55, 34);
        context.fillStyle = '#09235c';
        context.fillText(
          value,
          company.metadataRight - 7,
          y,
          company.metadataRight - 65,
        );
      },
    );
    context.textBaseline = 'alphabetic';
    context.font = 'bold 28px Vazirmatn, sans-serif';
    context.fillStyle = '#172033';
    // Bound metadata to the letter width; the body wraps onto additional pages.
    const header = [`گیرنده: ${letter.recipient}`, `موضوع: ${letter.subject}`];
    header.forEach((text, index) =>
      context.fillText(text, 1140, 370 + index * 55, 1000),
    );
    context.font = '28px Vazirmatn, sans-serif';
    lines
      .slice(offset, offset + 22)
      .forEach((text, index) => context.fillText(text, 1140, 490 + index * 46));
    context.fillStyle = '#64748b';
    context.font = '22px Vazirmatn, sans-serif';
    context.fillText(`صفحه ${pages.length + 1}`, 650, 1525);
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
    images.map(async (blob, index) => ({
      image: new Uint8Array(await blob.arrayBuffer()),
      width: canvases[index]!.width,
      height: canvases[index]!.height,
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
