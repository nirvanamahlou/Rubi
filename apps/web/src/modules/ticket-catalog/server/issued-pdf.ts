import { localizeDocumentHtml } from '@/i18n/document';
import type { DisplayLanguage } from '@/i18n/language';
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
const run = promisify(execFile);
let active = 0;
const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
export interface IssuedPdfData {
  data: Record<string, string | null>[];
}
const columns = [
  ['contractNumber', 'قرارداد'],
  ['passengerDisplayName', 'مسافر'],
  ['ticketNumber', 'شماره بلیط'],
  ['issuedAt', 'تاریخ صدور'],
  ['origin', 'مبدأ'],
  ['destination', 'مقصد'],
  ['direction', 'رفت / برگشت'],
  ['airline', 'ایرلاین'],
  ['flightNumber', 'شماره پرواز'],
  ['departureAt', 'زمان رفت'],
  ['arrivalAt', 'زمان رسیدن'],
  ['cabinClass', 'کلاس'],
  ['source', 'نوع صدور'],
  ['status', 'وضعیت'],
];
export function issuedPrintHtml(snapshot: IssuedPdfData, fontData: string, language: DisplayLanguage = 'fa') {
  const display = (key: string, value: string | null) => {
    if (!value) return '—';
    if (['issuedAt', 'departureAt', 'arrivalAt'].includes(key))
      return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value));
    if (key === 'direction') return value === 'OUTBOUND' ? 'رفت' : 'برگشت';
    if (key === 'status') return value === 'voided' ? 'ابطال شده' : 'صادرشده';
    if (key === 'source') return value === 'AUTO' ? 'خودکار' : 'دستی';
    return value;
  };
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Report;src:url(data:font/woff2;base64,${fontData})}@page{size:A4;margin:12mm}body{font:12px Report,Tahoma;color:#163553}h1{font-size:20px}article{break-inside:avoid;border:1px solid #cbd8e8;border-radius:8px;margin:12px 0;padding:12px}dl{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:0}dt{color:#54677e;font-size:10px}dd{margin:3px 0;overflow-wrap:anywhere}footer{font-size:10px}</style></head><body><h1>گزارش بلیط‌های صادرشده مسافران</h1><p>تعداد ردیف پرواز: ${snapshot.data.length} — زمان‌ها به وقت تهران</p>${snapshot.data.map((row, i) => `<article><b>ردیف ${i + 1}</b><dl>${columns.map(([key, label]) => `<div><dt>${escape(label!)}</dt><dd>${escape(display(key!, row[key!] ?? null))}</dd></div>`).join('')}</dl></article>`).join('') || '<p>بلیطی با این فیلترها یافت نشد.</p>'}<footer>هر ردیف یک قطعه پرواز از بلیط صادرشده مسافر است.</footer></body></html>`;
}
export async function resolveIssuedChrome(
  env: NodeJS.ProcessEnv = process.env,
  readable: (path: string) => Promise<boolean> = (path) =>
    access(path)
      .then(() => true)
      .catch(() => false),
) {
  const candidates = [
    env.TICKET_REPORT_PDF_CHROME_PATH,
    env.SALES_PDF_CHROME_PATH,
    ...[env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
      .filter((p): p is string => !!p)
      .flatMap((p) => [
        win32.join(p, 'Google/Chrome/Application/chrome.exe'),
        win32.join(p, 'Microsoft/Edge/Application/msedge.exe'),
      ]),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const path of candidates)
    if (
      path &&
      (isAbsolute(path) || win32.isAbsolute(path)) &&
      (await readable(path))
    )
      return path;
  throw new Error('TICKET_REPORT_PDF_RUNTIME_UNAVAILABLE');
}
export async function renderIssuedPdf(snapshot: IssuedPdfData, language: DisplayLanguage = 'fa') {
  if (active >= 2) throw new Error('TICKET_REPORT_PDF_BUSY');
  const chrome = await resolveIssuedChrome();
  active++;
  let directory: string | undefined;
  try {
    const font = await readFile(
      join(process.cwd(), 'public/fonts/vazirmatn-arabic-wght-normal.woff2'),
    );
    const html = localizeDocumentHtml(issuedPrintHtml(snapshot, font.toString('base64'), language), language);
    if (Buffer.byteLength(html) > 10000000)
      throw new Error('TICKET_REPORT_PDF_TOO_LARGE');
    directory = await mkdtemp(join(tmpdir(), 'nora-issued-pdf-'));
    const input = join(directory, 'issued.html'),
      output = join(directory, 'issued.pdf');
    await writeFile(input, html, { mode: 0o600 });
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
      { env, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 },
    );
    const deadline = Date.now() + 10000;
    let previous = 0;
    while (Date.now() < deadline) {
      const size = await stat(output)
        .then((s) => s.size)
        .catch(() => 0);
      if (size > 0 && size === previous) break;
      previous = size;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const bytes = await readFile(output);
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length > 20000000)
      throw new Error('TICKET_REPORT_PDF_INVALID');
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
