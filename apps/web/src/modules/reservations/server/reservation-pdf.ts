import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  access,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '../model/reservation-form';
import { reservationPdfHtml } from './reservation-pdf-html';

const run = promisify(execFile);
let active = 0;
/** Renderer accepts saved, permission-scoped output only, never client HTML or URLs. */
export async function renderReservationPdf(
  output: ReservationFormIntake,
  refs: ReservationFormReferences,
  logo: string,
  css: string,
  voucher = false,
): Promise<Buffer> {
  const chrome = process.env.SALES_PDF_CHROME_PATH;
  const font = process.env.SALES_PDF_NAZANIN_PATH;
  if (!chrome || !font || !isAbsolute(chrome) || !isAbsolute(font))
    throw new Error('PDF_RUNTIME_UNAVAILABLE');
  if (active >= 2) throw new Error('PDF_BUSY');
  active++;
  let directory: string | undefined;
  try {
    await access(chrome);
    const fontBytes = await readFile(font);
    if (!fontBytes.length || fontBytes.length > 5_000_000)
      throw new Error('PDF_FONT_INVALID');
    const html = reservationPdfHtml(output, refs, logo, css, voucher).replace(
      '</style>',
      '@font-face{font-family:ReservationNazanin;src:url(data:font/ttf;base64,' +
        fontBytes.toString('base64') +
        ') format("truetype");font-weight:normal}</style>',
    );
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
    // Windows Chrome can hand work to its headless process before the file is complete.
    const deadline = Date.now() + 10000;
    let previousSize = -1;
    let complete = false;
    while (Date.now() < deadline) {
      const size = await stat(result)
        .then((entry) => entry.size)
        .catch(() => 0);
      if (size > 0 && size === previousSize) {
        complete = true;
        break;
      }
      previousSize = size;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!complete) throw new Error('PDF_NOT_CREATED');
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
