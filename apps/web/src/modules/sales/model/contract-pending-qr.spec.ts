import { describe, expect, it } from 'vitest';
import {
  contractPendingQrHtml,
  contractPendingQrPayload,
  contractPendingQrRows,
} from './contract-pending-qr';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';

describe('Pending contract footer QR', () => {
  it('uses a fixed non-sensitive pending message and a complete QR matrix', () => {
    expect(contractPendingQrPayload).toBe(
      'ONLINE CONTRACT VIEW - PENDING SERVER SETUP',
    );
    expect(contractPendingQrPayload).not.toMatch(
      /https?:|localhost|SAMPLE-001/,
    );
    expect(contractPendingQrRows).toHaveLength(29);
    for (const row of contractPendingQrRows) expect(row).toMatch(/^[01]{29}$/);
    const html = contractPendingQrHtml();
    expect(html).toContain('viewBox="0 0 37 37"');
    expect(html).toContain('fill="#000"');
    expect(html).toContain('data-qr-state="pending-server"');
    expect(html).toContain('مشاهده آنلاین پس از راه‌اندازی سرور');
    expect(html).not.toMatch(/<script|<image|href=|src=/);
  });

  it('places QR first in the RTL footer, keeping contacts and prior notices', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    const footer = html.split('<footer>')[1]!.split('</footer>')[0]!;
    expect(footer.indexOf('class="footer-qr"')).toBeLessThan(
      footer.indexOf('class="footer-contact"'),
    );
    expect(html).toContain(
      'direction:rtl;align-items:center;justify-content:space-between',
    );
    expect(footer).toContain('Nystkt.ir');
    expect(footer).toContain('021-72075000');
    expect(footer).toContain('support@niyayeshseir.com');
    expect(html).toContain('بدون قبض رسید صندوق');
    expect(html).not.toContain('برای اعتبارسنجی');
    expect(html.match(/data-qr-state=/g)).toHaveLength(1);
  });
});
