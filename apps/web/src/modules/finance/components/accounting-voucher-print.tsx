'use client';

import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { voucherPrintRows } from '../accounting-voucher-display';

export function printVouchers(
  book: AccountingSnapshotV1,
  journals: AccountingJournalV1[],
) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.documentElement.dir = 'rtl';
  doc.documentElement.lang = 'fa';
  const style = doc.createElement('style');
  style.textContent =
    'body{font:13px Tahoma,sans-serif}section:not(:last-child){break-after:page}table{width:100%;border-collapse:collapse}td{padding:5px;border:1px solid #aaa}tr{break-inside:avoid}';
  doc.head.appendChild(style);
  for (const j of journals) {
    const section = doc.createElement('section');
    const table = doc.createElement('table');
    section.appendChild(table);
    doc.body.appendChild(section);
    for (const row of voucherPrintRows(book, j)) {
      const tr = table.insertRow();
      for (const value of row) {
        tr.insertCell().textContent = value;
      }
    }
  }
  win.addEventListener('afterprint', () => frame.remove(), { once: true });
  win.focus();
  win.print();
}
export function AccountingVoucherPrint({
  book,
  items,
  onClose,
}: {
  book: AccountingSnapshotV1;
  items: AccountingJournalV1[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={items.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-6xl overflow-auto">
        <DialogTitle>چاپ سند</DialogTitle>
        {items.map((j) => (
          <table key={j.id} className="w-full border text-xs">
            <tbody>
              {voucherPrintRows(book, j).map((r, i) => (
                <tr key={i}>
                  {r.map((v, k) => (
                    <td className="border p-2" key={k}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        <button type="button" onClick={() => printVouchers(book, items)}>
          چاپ
        </button>
      </DialogContent>
    </Dialog>
  );
}
