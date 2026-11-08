import { createHash, createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyReservationPdf } from './reservation-mail-pdf';
const secret = 'synthetic-signing-key-32-bytes-long';
const bytes = Buffer.from('%PDF-1.4 synthetic');
const signature = createHmac('sha256', secret)
  .update(
    JSON.stringify([
      'reservation-pdf-v1',
      'intake',
      5,
      'hotel',
      createHash('sha256').update(bytes).digest('hex'),
    ]),
  )
  .digest('hex');
it('accepts only the exact server-rendered PDF bound to intake, version and scope', () => {
  expect(
    verifyReservationPdf({ bytes, signature }, 'intake', 5, 'hotel', secret),
  ).toEqual(bytes);
  for (const [id, version, scope] of [
    ['other', 5, 'hotel'],
    ['intake', 6, 'hotel'],
    ['intake', 5, 'other'],
  ] as const)
    expect(() =>
      verifyReservationPdf({ bytes, signature }, id, version, scope, secret),
    ).toThrow();
  expect(() =>
    verifyReservationPdf(
      { bytes: Buffer.from('%PDF-1.4 changed'), signature },
      'intake',
      5,
      'hotel',
      secret,
    ),
  ).toThrow();
});
it('rejects unsigned, missing, oversized or non-PDF input and missing signing configuration', () => {
  expect(() =>
    verifyReservationPdf(undefined, 'intake', 5, 'hotel', secret),
  ).toThrow();
  expect(() =>
    verifyReservationPdf({ bytes, signature }, 'intake', 5, 'hotel', undefined),
  ).toThrow();
  expect(() =>
    verifyReservationPdf(
      { bytes, signature: 'a'.repeat(64) },
      'intake',
      5,
      'hotel',
      secret,
    ),
  ).toThrow();
  expect(() =>
    verifyReservationPdf(
      { bytes: Buffer.from('<html>'), signature },
      'intake',
      5,
      'hotel',
      secret,
    ),
  ).toThrow();
  expect(() =>
    verifyReservationPdf(
      { bytes: Buffer.alloc(10_000_001), signature },
      'intake',
      5,
      'hotel',
      secret,
    ),
  ).toThrow();
});
