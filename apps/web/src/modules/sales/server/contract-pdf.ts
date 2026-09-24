import { execFile } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { SalesContractOutputV1 } from '@nora/contracts';
import {
  contractPrintHtml,
  type ContractPrintReferences,
} from '../model/contract-print';

const run = promisify(execFile);
let active = 0;

const uniqueAbsolute = (values: Array<string | undefined>) => [
  ...new Set(
    values.filter(
      (value): value is string =>
        typeof value === 'string' &&
        (isAbsolute(value) || win32.isAbsolute(value)),
    ),
  ),
];

const joinRuntimePath = (base: string, ...parts: string[]) =>
  win32.isAbsolute(base) ? win32.join(base, ...parts) : join(base, ...parts);

export async function resolveContractPdfRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
  readable: (path: string) => Promise<boolean> = async (path) =>
    access(path)
      .then(() => true)
      .catch(() => false),
): Promise<{ chromePath: string | null; fontPath: string | null }> {
  const chromeCandidates = uniqueAbsolute([
    env.SALES_PDF_CHROME_PATH,
    env.ProgramFiles &&
      joinRuntimePath(env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    env['ProgramFiles(x86)'] &&
      joinRuntimePath(
        env['ProgramFiles(x86)'],
        'Google/Chrome/Application/chrome.exe',
      ),
    env.LOCALAPPDATA &&
      joinRuntimePath(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    env.ProgramFiles &&
      joinRuntimePath(
        env.ProgramFiles,
        'Microsoft/Edge/Application/msedge.exe',
      ),
    env['ProgramFiles(x86)'] &&
      joinRuntimePath(
        env['ProgramFiles(x86)'],
        'Microsoft/Edge/Application/msedge.exe',
      ),
    env.LOCALAPPDATA &&
      joinRuntimePath(
        env.LOCALAPPDATA,
        'Microsoft/Edge/Application/msedge.exe',
      ),
  ]);
  const fontCandidates = uniqueAbsolute([
    env.SALES_PDF_NAZANIN_PATH,
    env.LOCALAPPDATA &&
      joinRuntimePath(env.LOCALAPPDATA, 'Microsoft/Windows/Fonts/BNazanin.ttf'),
    env.WINDIR && joinRuntimePath(env.WINDIR, 'Fonts/BNazanin.ttf'),
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

/** Renderer accepts saved, permission-scoped output only, never client HTML or URLs. */
export async function renderContractPdf(
  output: SalesContractOutputV1,
  refs: ContractPrintReferences,
): Promise<Buffer> {
  const { chromePath: chrome, fontPath: font } =
    await resolveContractPdfRuntime();
  if (!chrome) throw new Error('PDF_RUNTIME_UNAVAILABLE');
  if (active >= 2) throw new Error('PDF_BUSY');
  active++;
  let directory: string | undefined;
  try {
    let html = contractPrintHtml(output, refs);
    if (font) {
      const fontBytes = await readFile(/* turbopackIgnore: true */ font);
      if (fontBytes.length && fontBytes.length <= 5_000_000)
        html = html.replace(
          '</style>',
          '@font-face{font-family:ContractNazanin;src:url(data:font/ttf;base64,' +
            fontBytes.toString('base64') +
            ') format("truetype");font-weight:normal}</style>',
        );
    }
    if (Buffer.byteLength(html) > 10_000_000) throw new Error('PDF_TOO_LARGE');
    directory = await mkdtemp(join(tmpdir(), 'nora-contract-pdf-'));
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
    // Chrome on Windows can return before its headless process flushes the file.
    await waitForPdf(result);
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
