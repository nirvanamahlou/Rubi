import { localizeDocumentHtml } from '@/i18n/document';
import type { DisplayLanguage } from '@/i18n/language';
import type { FinanceExportSnapshotV1 } from '@nora/contracts';
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
function display(value: string | null | undefined, type: string, language: DisplayLanguage = 'fa') {
  if (value == null) return '—';
  return type === 'DATE'
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : value;
}
/** Server-authorized immutable export snapshot only. No client HTML, URLs or bank-success claims. */
export function financePrintHtml(
  snapshot: FinanceExportSnapshotV1,
  fontData: string,
  language: DisplayLanguage = 'fa',
) {
  const blocks = snapshot.rows
    .map(
      (row, index) =>
        `<article><div class="record">${snapshot.scope === 'RECEIPT' ? 'رسید تراکنش' : 'ردیف ' + (index + 1)}</div><dl>${snapshot.columns.map((col, i) => `<div class="field ${col.type === 'TEXT' && (row[i]?.length ?? 0) > 80 ? 'wide' : ''}"><dt>${escape(col.label)}</dt><dd ${col.type === 'DECIMAL' ? 'dir="ltr"' : ''}>${escape(display(row[i], col.type, language))}</dd></div>`).join('')}</dl></article>`,
    )
    .join('');
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>${escape(snapshot.title)}</title><style>@font-face{font-family:Finance;src:url(data:font/woff2;base64,${fontData}) format('woff2')}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Finance,Tahoma,sans-serif;color:#163553;margin:0}header{border-bottom:3px solid #159ca6;padding-bottom:12px;margin-bottom:16px}h1{font-size:22px;margin:0 0 8px}.meta{color:#526577;font-size:10px;overflow-wrap:anywhere}.notice{padding:9px;background:#eef6f9;line-height:1.9;margin:10px 0}article{break-inside:avoid;border:1px solid #d2e0e8;border-radius:10px;margin:12px 0;padding:12px}.record{color:#07818d;font-weight:bold;margin-bottom:10px}dl{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin:0}.field{min-width:0;break-inside:avoid}.wide{grid-column:1/-1}dt{font-size:10px;color:#5d7083}dd{margin:3px 0 0;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.8}.total{padding:10px;background:#f4f8fb}.empty{padding:25px}footer{font-size:10px;margin-top:20px;padding-top:10px;border-top:1px solid #d2e0e8}.signatures{display:flex;justify-content:space-between;margin:36px 0 25px}button{font:inherit;border:1px solid #159ca6;border-radius:6px;background:white;padding:8px 16px}@media print{button{display:none}}</style></head><body><header><h1>${escape(snapshot.title)}</h1><div class="meta">تهیه: ${escape(new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(snapshot.generatedAt)))} | تعداد: ${snapshot.rows.length}</div><div class="meta">تهیه‌کننده: ${escape(snapshot.preparedBy)}</div></header><div class="notice">${snapshot.warnings.map((w) => escape(w)).join('<br>')}</div>${snapshot.rows.length ? blocks : '<p class="empty">هیچ رکوردی با این فیلتر وجود ندارد.</p>'}${snapshot.totals.length ? '<div class="total">' + snapshot.totals.map((t) => `<div>جمع در ${escape(t.currencyCode)}: <bdi>${escape(t.amount)}</bdi></div>`).join('') + '</div>' : ''}${snapshot.scope === 'RECEIPT' ? '<div class="signatures"><span>امضای دریافت‌کننده</span><span>امضای پرداخت‌کننده</span><span>تأیید مالی</span></div>' : ''}<footer>تاریخ‌ها به وقت تهران هستند. شناسه تراکنش برای پیگیری ثبت داخلی است. ${escape(snapshot.scope === 'INBOX' ? 'این گزارش رسید پرداخت نیست.' : 'ثبت داخلی به معنای تأیید انتقال بانکی بیرونی نیست.')}</footer></body></html>`;
}
export async function resolveFinanceChrome(
  env: NodeJS.ProcessEnv = process.env,
  readable: (path: string) => Promise<boolean> = (path) =>
    access(path)
      .then(() => true)
      .catch(() => false),
) {
  const candidates = [
    env.FINANCE_PDF_CHROME_PATH,
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
  throw new Error('FINANCE_PDF_RUNTIME_UNAVAILABLE');
}
export async function renderFinancePdf(snapshot: FinanceExportSnapshotV1, language: DisplayLanguage = 'fa') {
  if (active >= 2) throw new Error('FINANCE_PDF_BUSY');
  const chrome = await resolveFinanceChrome();
  active++;
  let directory: string | undefined;
  try {
    const font = await readFile(
      join(process.cwd(), 'public/fonts/vazirmatn-arabic-wght-normal.woff2'),
    );
    const html = localizeDocumentHtml(financePrintHtml(snapshot, font.toString('base64'), language), language);
    if (Buffer.byteLength(html) > 10000000)
      throw new Error('FINANCE_PDF_TOO_LARGE');
    directory = await mkdtemp(join(tmpdir(), 'nora-finance-pdf-'));
    const input = join(directory, 'finance.html'),
      output = join(directory, 'finance.pdf');
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
      throw new Error('FINANCE_PDF_INVALID');
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
