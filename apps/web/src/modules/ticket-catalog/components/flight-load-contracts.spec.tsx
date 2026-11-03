import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { FlightLoadContractsV1 } from '@nora/contracts';
import { FlightLoadContractsTable } from './flight-load-contracts';
const composition = {
  adults: 2,
  children2To6: 1,
  children6To12: 0,
  childrenUnknownAge: 1,
  infants: 1,
  passengers: 5,
  seats: 4,
};
const report: FlightLoadContractsV1 = {
  version: 1,
  offerId: 'offer',
  totals: { ...composition, contracts: 1 },
  data: [
    {
      ...composition,
      id: 'contract',
      contractNumber: '00120',
      customerName: 'Synthetic buyer',
      status: 'CONFIRMED',
      direction: 'OUTBOUND',
      originId: 'a',
      destinationId: 'b',
      originName: 'Origin',
      destinationName: 'Destination',
      departureAt: '2099-01-02T23:30:00Z',
      outboundAt: '2099-01-02T23:30:00Z',
      returnAt: null,
      carrierName: 'Synthetic Air',
      serviceNumber: '0012',
      cabinClassCode: 'ECONOMY',
    },
  ],
};
it('renders contract identity, actual leg counts, unknown child ages, Gregorian local dates and safe contract link', () => {
  const html = renderToStaticMarkup(
    <FlightLoadContractsTable
      report={report}
      cityName={(id) => (id === 'a' ? 'مبدأ نمونه' : 'مقصد نمونه')}
    />,
  );
  expect(html).toContain('00120');
  expect(html).toContain('Synthetic buyer');
  expect(html).toContain('2099-01-03');
  expect(html).toContain('کودک با سن نامشخص');
  expect(html).toContain('تعداد صندلی');
  expect(html).toContain('/sales/contracts/contract/pdf');
  expect(html).toContain('noopener noreferrer');
  expect(html).not.toContain('undefined');
});
it('renders an explicit empty report with zero contracts', () => {
  const html = renderToStaticMarkup(
    <FlightLoadContractsTable
      report={{ ...report, data: [], totals: { ...composition, contracts: 0 } }}
      cityName={(id) => id}
    />,
  );
  expect(html).toContain('قراردادی برای این بلیت و تاریخ وجود ندارد.');
  expect(html).not.toContain('Synthetic buyer');
});
