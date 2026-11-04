import { expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { FlightLoadContractsV1 } from '@nora/contracts';
import { emptyFlightComposition } from './flight-load.service';
import { flightLoadWorkbook } from './flight-load.xlsx';
it('creates a real RTL XLSX with safe text, numeric totals and Tehran Gregorian flight dates', () => {
  const c = { ...emptyFlightComposition(), adults: 2, passengers: 2, seats: 2 };
  const r = {
    version: 1,
    offerId: 'offer',
    totals: { ...c, contracts: 1 },
    data: [
      {
        ...c,
        id: 'contract',
        contractNumber: '00120',
        customerName: '=HYPERLINK("x") & <buyer>',
        status: 'CONFIRMED',
        direction: 'OUTBOUND',
        originName: 'Origin',
        destinationName: 'Destination',
        departureAt: '2099-01-02T23:30:00Z',
        outboundAt: '2099-01-02T23:30:00Z',
        returnAt: null,
        carrierName: 'Air',
        serviceNumber: '0012',
        cabinClassCode: 'ECONOMY',
      },
    ],
  } as FlightLoadContractsV1;
  const files = unzipSync(flightLoadWorkbook(r)),
    sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
  expect(files['xl/workbook.xml']).toBeDefined();
  expect(sheet).toContain('rightToLeft="1"');
  expect(sheet).toContain('00120');
  expect(sheet).toContain('2099-01-03');
  expect(sheet).toContain('=HYPERLINK(&quot;x&quot;) &amp; &lt;buyer&gt;');
  expect(sheet).not.toContain('<f>');
  expect(sheet).toContain('<c r="Q3" t="n"><v>2</v></c>');
  expect(sheet).toContain('autoFilter ref="A1:Q2"');
});
