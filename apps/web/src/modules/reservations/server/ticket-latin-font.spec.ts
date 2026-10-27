import { expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ticketDocumentHtml,
  TICKET_LATIN_FONT_URL,
} from '@/components/travel/flight-ticket-layout';
import { prepareTicketHtml, renderTicketPdf } from './ticket-pdf';
import { readTicketBrandAsset, readTicketLatinFont } from './ticket-pdf-assets';
async function fixture() {
  const logo = await readTicketBrandAsset('niyayesh-seir-full.png');
  return ticketDocumentHtml(
    [
      {
        issued: true,
        contractNumber: 'TEST-120128',
        eTicketNumber: '100000',
        issuedAt: '2026-10-27T10:00:00Z',
        passengerName: 'SYNTHETIC TRAVELER',
        offers: [
          {
            originId: 'teh',
            destinationId: 'izmir',
            departureAt: '2026-08-14T00:30:00Z',
            arrivalAt: '2026-08-14T03:30:00Z',
            carrierName: 'IRAN AIRTOUR',
            serviceNumber: '9740',
            cabinClassCode: 'ECONOMY',
            direction: 'OUTBOUND',
            baggageKg: '20',
            originAirport: {
              code: 'IKA',
              name: 'Imam Khomeini International Airport',
              cityName: 'TEHRAN',
            },
            destinationAirport: {
              code: 'ADB',
              name: 'Izmir Adnan Menderes Airport',
              cityName: 'IZMIR',
            },
          },
          {
            originId: 'izmir',
            destinationId: 'teh',
            departureAt: '2026-08-21T04:45:00Z',
            arrivalAt: '2026-08-21T08:30:00Z',
            carrierName: 'IRAN AIRTOUR',
            serviceNumber: '9741',
            cabinClassCode: 'ECONOMY',
            direction: 'RETURN',
            baggageKg: '20',
            originAirport: {
              code: 'ADB',
              name: 'Izmir Adnan Menderes Airport',
              cityName: 'IZMIR',
            },
            destinationAirport: {
              code: 'IKA',
              name: 'Imam Khomeini International Airport',
              cityName: 'TEHRAN',
            },
          },
        ],
        transferDirections: [],
      },
    ],
    { teh: 'TEHRAN', izmir: 'IZMIR' },
    {
      name: 'Niyayesh Seir',
      logoDataUrl: `data:image/png;base64,${logo.toString('base64')}`,
    },
  );
}
it('embeds the repository Latin font before PDF rendering independently of the selected UI language', async () => {
  const html = await fixture();
  for (const language of ['fa', 'en'] as const) {
    const prepared = await prepareTicketHtml(html, language);
    expect(prepared).toContain('url("data:font/woff2;base64,');
    expect(prepared).not.toContain(`url("${TICKET_LATIN_FONT_URL}")`);
    expect(prepared).toContain('TEST-120128');
    expect(prepared).toContain('9740');
    expect(prepared).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  }
});
it('fails explicitly when the bundled Latin font is missing rather than falling back to shaped digits', async () => {
  await expect(
    readTicketLatinFont('/missing', async () => {
      throw Error('absent');
    }),
  ).rejects.toThrow('PDF_LATIN_FONT_UNAVAILABLE');
});
it.runIf(process.env.TICKET_PDF_RUNTIME_SMOKE === '1')(
  'renders a synthetic ticket PDF with English numerals and arrival/departure headings',
  async () => {
    const html = await fixture();
    const bytes = await renderTicketPdf(html, 'fa');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    if (process.env.TICKET_LATIN_QA_DIR) {
      await mkdir(process.env.TICKET_LATIN_QA_DIR, { recursive: true });
      await writeFile(
        join(process.env.TICKET_LATIN_QA_DIR, 'ticket.pdf'),
        bytes,
      );
      await writeFile(
        join(process.env.TICKET_LATIN_QA_DIR, 'ticket.html'),
        await prepareTicketHtml(html, 'fa'),
      );
    }
  },
  45000,
);
