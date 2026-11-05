/** Count Chrome's page dictionaries, excluding the /Pages tree. */
export function chromePdfPageCount(pdf: Buffer): number | undefined {
  if (pdf.subarray(0, 5).toString() !== '%PDF-') return undefined;
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length;
  return pages || undefined;
}

/**
 * Keep the full-size output unless a reduction of at most 5% saves a page.
 * Reprint the same escaped HTML, including its repeating footers and page counters;
 * never remove content or deliberately combine the template's explicit pages.
 */
export async function renderPdfWithSmallOverflowFit(
  html: string,
  render: (html: string) => Promise<Buffer>,
  minimumPages = 1,
): Promise<Buffer> {
  const original = await render(html);
  const originalPages = chromePdfPageCount(original);
  if (
    !originalPages ||
    originalPages <= minimumPages ||
    !html.includes('</style>')
  )
    return original;
  const compactHtml = (scale: number) =>
    html.replace('</style>', `@media print{body{zoom:${scale}}}</style>`);
  let compact: Buffer;
  try {
    compact = await render(compactHtml(0.95));
  } catch {
    // A fitting retry must never prevent downloading an already valid PDF.
    return original;
  }
  const compactPages = chromePdfPageCount(compact);
  if (
    !compactPages ||
    compactPages < minimumPages ||
    compactPages >= originalPages
  )
    return original;
  try {
    const gentle = await render(compactHtml(0.98));
    const gentlePages = chromePdfPageCount(gentle);
    return gentlePages &&
      gentlePages >= minimumPages &&
      gentlePages <= compactPages
      ? gentle
      : compact;
  } catch {
    return compact;
  }
}
