import { execFile } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
let active = 0;

const uniqueAbsolute = (values: Array<string | undefined>) => [
  ...new Set(
    values.filter(
      (value): value is string =>
        typeof value === 'string' && isAbsolute(value),
    ),
  ),
];

export async function resolveTicketPdfRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
  readable: (path: string) => Promise<boolean> = async (path) =>
    access(path)
      .then(() => true)
      .catch(() => false),
): Promise<{ chromePath: string | null; fontPath: string | null }> {
  const chromeCandidates = uniqueAbsolute([
    env.SALES_PDF_CHROME_PATH,
    env.ProgramFiles &&
      join(env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    env['ProgramFiles(x86)'] &&
      join(env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    env.LOCALAPPDATA &&
      join(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    env.ProgramFiles &&
      join(env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    env['ProgramFiles(x86)'] &&
      join(env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    env.LOCALAPPDATA &&
      join(env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
  ]);
  const fontCandidates = uniqueAbsolute([
    env.SALES_PDF_NAZANIN_PATH,
    env.LOCALAPPDATA &&
      join(env.LOCALAPPDATA, 'Microsoft/Windows/Fonts/BNazanin.ttf'),
    env.WINDIR && join(env.WINDIR, 'Fonts/BNazanin.ttf'),
  ]);
  const firstReadable = async (candidates: readonly string[]) => {
    for (const candidate of candidates)
      if (await readable(candidate)) return candidate;
    return null;
  };
  return {
    chromePath: await firstReadable(chromeCandidates),
    fontPath: await firstReadable(fontCandidates),
  };
}

async function waitForPdf(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  let previousSize = -1;
  while (Date.now() < deadline) {
    const size = await stat(path)
      .then((entry) => entry.size)
      .catch(() => 0);
    if (size > 0 && size === previousSize) return;
    previousSize = size;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('PDF_NOT_CREATED');
}

export async function renderTicketPdf(html: string): Promise<Buffer> {
  const { chromePath: chrome, fontPath: font } =
    await resolveTicketPdfRuntime();
  if (!chrome) throw new Error('PDF_RUNTIME_UNAVAILABLE');
  if (active >= 2) throw new Error('PDF_BUSY');
  active++;
  let directory: string | undefined;
  try {
    let document = html;
    if (font) {
      const fontBytes = await readFile(/* turbopackIgnore: true */ font);
      if (fontBytes.length && fontBytes.length <= 5_000_000)
        document = html.replace(
          '</style>',
          `@font-face{font-family:ReservationNazanin;src:url(data:font/ttf;base64,${fontBytes.toString('base64')}) format("truetype")}</style>`,
        );
    }
    if (Buffer.byteLength(document) > 10_000_000)
      throw new Error('PDF_INPUT_INVALID');
    directory = await mkdtemp(join(tmpdir(), 'nora-ticket-pdf-'));
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
    // Chrome on Windows can return after handing the work to its headless process.
    await waitForPdf(output);
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
