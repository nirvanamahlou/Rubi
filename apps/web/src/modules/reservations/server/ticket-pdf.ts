import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
let active = 0;

export async function renderTicketPdf(html: string): Promise<Buffer> {
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
    const document = html.replace(
      '</style>',
      `@font-face{font-family:ReservationNazanin;src:url(data:font/ttf;base64,${fontBytes.toString('base64')}) format("truetype")}</style>`,
    );
    if (
      !fontBytes.length ||
      fontBytes.length > 5_000_000 ||
      Buffer.byteLength(document) > 10_000_000
    )
      throw new Error('PDF_INPUT_INVALID');
    directory = await mkdtemp(join(tmpdir(), 'rubi-ticket-pdf-'));
    const input = join(directory, 'ticket.html');
    const output = join(directory, 'ticket.pdf');
    await writeFile(input, document, { mode: 0o600 });
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
        '--print-to-pdf=' + output,
        pathToFileURL(input).href,
      ],
      { env, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    const bytes = await readFile(output);
    if (
      bytes.subarray(0, 5).toString() !== '%PDF-' ||
      bytes.length > 20_000_000
    )
      throw new Error('PDF_INVALID');
    return bytes;
  } finally {
    active--;
    if (directory && dirname(directory) === tmpdir())
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      }).catch(() => undefined);
  }
}
