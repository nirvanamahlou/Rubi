import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord, SalesContractDetail } from '@rubi/contracts';

import {
  ReservationReceipts,
  reservationReceiptRows,
} from './reservation-receipts';

describe('reservation receipts', () => {
  it('projects recorded payment facts without inventing missing bank data', () => {
    const contract = {
      payments: [
        {
          id: 'payment-1',
          amount: '1250000',
          currencyCode: 'IRR',
          dueAt: '2026-09-12T08:30:00.000Z',
          method: 'CHECK',
          status: 'FINANCE_CONFIRMED',
          description: 'قسط اول',
          paymentReference: 'TRACK-10',
          check: {
            bankId: 'bank-1',
            secureIdentifier: 'opaque',
            ownerName: 'Sample',
            dueDate: '2026-09-12',
          },
          createdByUserId: 'user-1',
          createdByName: 'کارشناس نمونه',
          createdAt: '2026-09-11T07:00:00.000Z',
          financeConfirmedAt: '2026-09-12T09:00:00.000Z',
        },
        {
          id: 'payment-2',
          amount: '50',
          currencyCode: 'USD',
          dueAt: '2026-09-13T00:00:00.000Z',
          method: 'BANK_TRANSFER',
          status: 'PENDING_FINANCE_CONFIRMATION',
          createdByUserId: 'user-2',
          createdByName: null,
          createdAt: '2026-09-12T10:00:00.000Z',
          financeConfirmedAt: null,
        },
      ],
    } as unknown as SalesContractDetail;
    const banks = [
      { id: 'bank-1', name: 'بانک نمونه' },
    ] as unknown as MasterDataRecord[];

    const rows = reservationReceiptRows(contract, banks);
    expect(rows[0]).toMatchObject({
      method: 'چک',
      status: 'تأییدشده مالی',
      amount: '1,250,000',
      currency: 'IRR',
      registeredBy: 'کارشناس نمونه',
      bank: 'بانک نمونه',
      reference: 'TRACK-10',
    });
    expect(rows[1]).toMatchObject({
      method: 'انتقال بانکی',
      transferAt: 'ثبت نشده',
      registeredBy: 'ثبت نشده',
      bank: 'ثبت نشده',
    });
  });

  it('starts by loading the selected contract receipts', () => {
    const html = renderToStaticMarkup(
      <ReservationReceipts contractId="contract-1" />,
    );
    expect(html).toContain('در حال دریافت سوابق دریافت‌ها');
  });
});
