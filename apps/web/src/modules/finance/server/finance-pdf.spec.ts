import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FinanceExportSnapshotV1 } from '@nora/contracts';
import { financePrintHtml, renderFinancePdf } from './finance-pdf';

const snapshot: FinanceExportSnapshotV1 = {
  version: 1, scope: 'RECEIPT', title: 'رسید داخلی پرداخت حقوق — نمونه آزمایش', generatedAt: '2026-10-04T10:00:00.000Z', preparedBy: 'Synthetic reviewer — not real data', filterSnapshot: { scope: 'RECEIPT', historySource: 'OPERATIONAL' },
  columns: [{ label: 'ذی‌نفع', type: 'TEXT' }, { label: 'شرح', type: 'TEXT' }, { label: 'مبلغ این پرداخت', type: 'DECIMAL' }, { label: 'ارز', type: 'TEXT' }, { label: 'زمان پرداخت', type: 'DATE' }, { label: 'مانده درخواست', type: 'DECIMAL' }, { label: 'شماره رسید', type: 'TEXT' }],
  rows: [['کارمند آزمایشی', 'پرداخت جزئی حقوق تأییدشده مهر؛ این اطلاعات صرفاً برای آزمون خوانایی فارسی و چاپ رسید است.', '123456789.125', 'IRR', '2026-10-04T10:00:00.000Z', '600000.1', 'TEST-001']], totals: [{ currencyCode: 'IRR', amount: '123456789.125' }], warnings: ['داده آزمایشی است؛ پرداخت واقعی انجام نشده است.', 'رسید داخلی ثبت تراکنش است و به معنی تأیید انتقال وجه توسط بانک نیست.'],
};
describe('Finance printable Persian receipt', () => {
  it('escapes untrusted text and embeds only the trusted font in a network-denying layout', () => {
    const html = financePrintHtml({ ...snapshot, rows: [['<script>alert("unsafe")</script>', ...snapshot.rows[0]!.slice(1)]] }, 'ZmFrZQ==');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('@page{size:A4');
    expect(html).toContain('font/woff2;base64,ZmFrZQ==');
    expect(html).toContain('تأیید انتقال وجه');
  });
  it.skipIf(process.env.NORA_RUN_FINANCE_PDF_QA !== '1')('renders a genuine PDF with the installed headless browser', async () => {
    const bytes = await renderFinancePdf(snapshot);
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10000);
    const directory = resolve(process.cwd(), '../../tmp/pdfs');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'finance-receipt-qa.pdf'), bytes);
  }, 60000);
});
