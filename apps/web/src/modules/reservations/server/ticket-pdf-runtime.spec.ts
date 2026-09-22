import { describe, expect, it } from 'vitest';

import { readTicketBrandAsset } from './ticket-pdf-assets';
import { renderTicketPdf, resolveTicketPdfRuntime } from './ticket-pdf';

describe('ticket PDF runtime discovery', () => {
  it('finds installed Chrome and the user-installed Nazanin font without shell variables', async () => {
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const font =
      'C:\\Users\\test\\AppData\\Local\\Microsoft\\Windows\\Fonts\\BNazanin.ttf';
    const readable = new Set([chrome, font]);
    await expect(
      resolveTicketPdfRuntime(
        {
          ProgramFiles: 'C:\\Program Files',
          LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
        },
        async (path) => readable.has(path),
      ),
    ).resolves.toEqual({ chromePath: chrome, fontPath: font });
  });

  it('uses Edge when Chrome is absent and keeps a missing custom font optional', async () => {
    const edge =
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    await expect(
      resolveTicketPdfRuntime(
        { 'ProgramFiles(x86)': 'C:\\Program Files (x86)' },
        async (path) => path === edge,
      ),
    ).resolves.toEqual({ chromePath: edge, fontPath: null });
  });

  it.runIf(process.env.TICKET_PDF_RUNTIME_SMOKE === '1')(
    'renders a real PDF with the repository brand asset',
    async () => {
      const logo = await readTicketBrandAsset('niyayesh-seir-full.png');
      const pdf = await renderTicketPdf(
        '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4}</style></head><body>' +
          `<img src="data:image/png;base64,${logo.toString('base64')}">` +
          '<p>Ticket PDF smoke</p></body></html>',
      );

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1_000);
    },
    45_000,
  );
});
