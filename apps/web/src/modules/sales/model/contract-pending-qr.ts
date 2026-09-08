// Presentation placeholder explicitly requested before public-server deployment.
// ReportLab QR encoder: version 3, error correction L, mask selected by encoder.
// Payload is plain text, NOT a URL, access token, contract identity or verification.
// Replace this presentation seam only after secure server-side sharing is available.
export const contractPendingQrPayload =
  'ONLINE CONTRACT VIEW - PENDING SERVER SETUP';
export const contractPendingQrRows = [
  '11111110100110011010101111111',
  '10000010111011101000001000001',
  '10111010001110111101101011101',
  '10111010001000100001101011101',
  '10111010111101110000101011101',
  '10000010100100010100101000001',
  '11111110101010101010101111111',
  '00000000101110111011100000000',
  '11100110111001100110111110011',
  '00101001111001100001110101000',
  '00100111100100010011101111011',
  '10000100110001000010010011011',
  '00001011010111011011011010001',
  '10111101000010001111101110000',
  '10001110100011101111000100010',
  '10010001001110111101010110011',
  '00110111111001100000110011101',
  '01101100000001100000110011011',
  '11010110000100010001000101100',
  '00001101111001000110111011000',
  '11011010101111011100111111101',
  '00000000111010001010100011100',
  '11111110010011101101101010000',
  '10000010111110111010100010110',
  '10111010001001101010111111001',
  '10111010000001100010110111010',
  '10111010110100011001000111011',
  '10000010100001001010100110101',
  '11111110101111011000100011111',
] as const;

export function contractPendingQrHtml(): string {
  // Four-module quiet zone on all sides; vector modules stay sharp in print/PDF.
  const path = contractPendingQrRows
    .flatMap((row, y) =>
      [...row].flatMap((cell, x) =>
        cell === '1' ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [],
      ),
    )
    .join('');
  return `<div class="footer-qr" data-qr-state="pending-server"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" role="img" aria-label="QR غیرفعال؛ در انتظار راه‌اندازی سرور" shape-rendering="crispEdges"><rect width="37" height="37" fill="white"/><path d="${path}" fill="#000"/></svg><small>مشاهده آنلاین پس از راه‌اندازی سرور</small></div>`;
}
