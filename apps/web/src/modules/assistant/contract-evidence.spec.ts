import { expect, it } from 'vitest';
import type { SalesContractDetail } from '@nora/contracts';
import { ledgerEvidence } from './contract-ledger';
import { itineraryEvidence } from './contract-itinerary';
it('reconciles fractional payments within their currency and excludes void and rejected amounts', () => {
  const c = {
    balances: [
      { currencyCode: 'USD', amount: '10.0001', confirmedPaid: '12.0001' },
      { currencyCode: 'EUR', amount: '5', confirmedPaid: '0' },
    ],
    priceComponents: [],
    servicesDetail: [],
    passengersDetail: [],
    payments: [
      { currencyCode: 'USD', amount: '12.0001', status: 'FINANCE_CONFIRMED' },
      { currencyCode: 'USD', amount: '20', status: 'FINANCE_VOIDED' },
      { currencyCode: 'EUR', amount: '7', status: 'FINANCE_REJECTED' },
    ],
  } as unknown as SalesContractDetail;
  const lines = ledgerEvidence(c);
  expect(lines).toContain('اضافه‌وصول: 2 USD');
  expect(lines).toContain('اختلاف مبلغ قرارداد با مجموع برنامه معتبر: 5 EUR');
  expect(lines).toContain('اختلاف مبلغ قرارداد با مجموع برنامه معتبر: -2 USD');
});
it('identifies a duplicated unallocated traveller, overlapping accommodation and a subsequent gap', () => {
  const guest = { customerId: 'test-person', serviceClientKeys: [] };
  const stay = (d: string, e: string) => ({
    hotelNameSnapshot: 'test',
    checkInDate: d,
    checkOutDate: e,
  });
  const c = {
    passengersDetail: [guest, guest],
    servicesDetail: [{ clientKey: 'hotel', kind: 'HOTEL' }],
    hotelSelection: {
      ...stay('2026-11-01', '2026-11-07'),
      additionalStays: [
        stay('2026-11-02', '2026-11-03'),
        stay('2026-11-08', '2026-11-09'),
      ],
    },
  } as unknown as SalesContractDetail;
  const result = itineraryEvidence(c).join('\n');
  expect(result).toContain('مسافر 2 — شناسه مسافر تکراری');
  expect(result).toContain('مسافر 1 — خدمت تخصیص‌یافته ندارد');
  expect(result).toContain('هم‌پوشانی');
  expect(result).toContain('فاصله');
});
