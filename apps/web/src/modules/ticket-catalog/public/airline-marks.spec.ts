import { describe, it, expect, vi } from 'vitest';
import { readTicketAirlineMarks } from './airline-marks';
describe('airline display logos', () => {
  it('uses the exact airline reference logo without Documents catalogue privileges', async () => {
    const get = vi.fn(async (path: string) =>
      path.includes('/logo')
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'image/png' },
          })
        : Response.json({
            data: [
              {
                id: 'airline-id',
                name: 'Iran Airtour',
                code: 'B9',
                attributes: { englishName: 'Iran Airtour' },
              },
            ],
          }),
    );
    const marks = await readTicketAirlineMarks(['IRAN AIR TOUR'], get);
    expect(marks['IRAN AIR TOUR']?.logoDataUrl).toBe(
      'data:image/png;base64,AQID',
    );
    expect(get).toHaveBeenCalledWith('/master-data/airlines/airline-id/logo');
    expect(
      get.mock.calls.some(([path]) => path.startsWith('/documents/')),
    ).toBe(false);
  });
  it('keeps the carrier name when its logo read is denied', async () => {
    const get = vi.fn(async (path: string) =>
      path.includes('/logo')
        ? new Response(null, { status: 403 })
        : Response.json({
            data: [
              {
                id: 'airline-id',
                name: 'Test Air',
                code: 'TA',
                attributes: {},
              },
            ],
          }),
    );
    expect(await readTicketAirlineMarks(['Test Air'], get)).toEqual({
      'Test Air': { name: 'Test Air', code: 'TA' },
    });
  });
});
