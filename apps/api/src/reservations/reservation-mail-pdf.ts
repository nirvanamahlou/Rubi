import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type SignedReservationPdf = { bytes: Buffer; signature: string };
export function verifyReservationPdf(
  pdf: SignedReservationPdf | undefined,
  intakeId: string,
  version: number,
  hotelStayKey: string | undefined,
  secret: string | undefined,
) {
  if (
    !secret ||
    secret.length < 32 ||
    !pdf ||
    pdf.bytes.length < 5 ||
    pdf.bytes.length > 10_000_000 ||
    pdf.bytes.subarray(0, 5).toString() !== '%PDF-' ||
    !/^[a-f0-9]{64}$/.test(pdf.signature)
  )
    throw new Error('INVALID_SIGNED_PDF');
  const digest = createHash('sha256').update(pdf.bytes).digest('hex');
  const expected = createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'reservation-pdf-v1',
        intakeId,
        version,
        hotelStayKey ?? '',
        digest,
      ]),
    )
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(pdf.signature, 'hex')))
    throw new Error('INVALID_SIGNED_PDF');
  return pdf.bytes;
}
