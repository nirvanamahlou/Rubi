import { describe, expect, it } from 'vitest';

import { resolveTicketPdfRuntime } from './ticket-pdf';

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
});
