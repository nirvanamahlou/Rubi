import { expect, it } from 'vitest';
import { reservationFormQr } from './reservation-form-qr';
import { reservationQrGolden } from './reservation-qr-golden';
it('encodes the form URL with independent ReportLab version 4-L byte-mode mask-0 modules', () => {
  const svg = reservationFormQr(
    'https://niyayehseir.com/r/00000000-0000-4000-8000-000000000001',
  )!;
  const coords = new Set(
    [...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(
      (m) => `${Number(m[1]) - 4},${Number(m[2]) - 4}`,
    ),
  );
  const rows = Array.from({ length: 33 }, (_, y) =>
    Array.from({ length: 33 }, (_, x) =>
      coords.has(`${x},${y}`) ? '1' : '0',
    ).join(''),
  );
  expect(rows).toEqual(reservationQrGolden);
  expect(reservationFormQr('')).toBeNull();
  expect(reservationFormQr('x'.repeat(79))).toBeNull();
});
