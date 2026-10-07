import { localizeDocumentHtml } from '@/i18n/document';
import type { DisplayLanguage } from '@/i18n/language';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '../model/reservation-form';
import { reservationPdfHtml } from './reservation-pdf-html';
import { resolveTicketPdfRuntime } from './ticket-pdf';

const run = promisify(execFile);
let active = 0;
/** Renderer accepts saved, permission-scoped output only, never client HTML or URLs. */
export async function renderReservationPdf(
  output: ReservationFormIntake,
  refs: ReservationFormReferences,
  logo: string,
  css: string,
  voucher = false,
  origin = '',
  language: DisplayLanguage = 'fa',
): Promise<Buffer> {
  const { chromePath: chrome, fontPath: font } =
    await resolveTicketPdfRuntime();
  if (!chrome) throw new Error('PDF_RUNTIME_UNAVAILABLE');
  if (active >= 2) throw new Error('PDF_BUSY');
  active++;
  let directory: string | undefined;
  try {
    let html = localizeDocumentHtml(reservationPdfHtml(output, refs, logo, css, voucher, origin), language);
    if (font) {
      const fontBytes = await readFile(font);
      if (fontBytes.length && fontBytes.length <= 5_000_000)
        html = html.replace(
          '</style>',
          '@font-face{font-family:ReservationNazanin;src:url(data:font/ttf;base64,' +
            fontBytes.toString('base64') +
            ') format("truetype");font-weight:normal}</style>',
        );
    }
    if (Buffer.byteLength(html) > 10_000_000) throw new Error('PDF_TOO_LARGE');
    directory = await mkdtemp(join(tmpdir(), 'nora-reservation-pdf-'));
    const input = join(directory, 'contract.html');
    const result = join(directory, 'contract.pdf');
    await writeFile(input, html, { mode: 0o600 });
    // Isolated profile, no authentication cookies, no inherited database/document secrets.
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const name of [
      'SystemRoot',
      'WINDIR',
      'TEMP',
      'TMP',
      'PATH',
      'HOME',
      'LANG',
    ])
      if (process.env[name]) env[name] = process.env[name];
    await run(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--host-resolver-rules=MAP * ~NOTFOUND',
        '--user-data-dir=' + join(directory, 'profile'),
        '--no-pdf-header-footer',
        '--print-to-pdf=' + result,
        pathToFileURL(input).href,
      ],
      { env, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    // Chrome may return before its child finishes writing the PDF on Windows.
    const deadline = Date.now() + 10_000;
    let previousSize = -1;
    while (Date.now() < deadline) {
      const size = await stat(result)
        .then((entry) => entry.size)
        .catch(() => 0);
      if (size > 0 && size === previousSize) break;
      previousSize = size;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const bytes = await readFile(result);
    if (
      bytes.subarray(0, 5).toString() !== '%PDF-' ||
      bytes.length > 20_000_000
    )
      throw new Error('PDF_INVALID');
    return bytes;
  } finally {
    active--;
    // Only the exact private directory created by this invocation may be removed.
    if (directory && dirname(directory) === tmpdir())
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      }).catch(() => undefined);
  }
}
