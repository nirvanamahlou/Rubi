export const XLS_MIME = 'application/vnd.ms-excel';
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const RECEIPT_FILE_ACCEPT =
  '.pdf,.jpg,.jpeg,.jfif,.png,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const RECEIPT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  XLS_MIME,
  XLSX_MIME,
];
const byExtension: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  xls: XLS_MIME,
  xlsx: XLSX_MIME,
};
/** Browser MIME aliases are normalized; server byte inspection remains authoritative. */
export function attachmentMimeType(name: string, mime: string): string {
  const expected = byExtension[name.split('.').at(-1)?.toLowerCase() ?? ''];
  if (!expected) return mime;
  if (!mime || mime === 'application/octet-stream') return expected;
  if (expected === 'image/jpeg' && ['image/jfif', 'image/pjpeg'].includes(mime))
    return expected;
  if (
    expected === XLS_MIME &&
    ['application/msexcel', 'application/x-msexcel'].includes(mime)
  )
    return expected;
  if (expected === XLSX_MIME && mime === 'application/zip') return expected;
  return mime;
}
export function receiptFileSupported(name: string, mime: string): boolean {
  const expected = byExtension[name.split('.').at(-1)?.toLowerCase() ?? ''];
  return !!expected && expected === attachmentMimeType(name, mime);
}
/** XLS and XLSX are the same configured Excel family, not a policy bypass. */
export function documentMimeTypes(types: readonly string[]): string[] {
  return [
    ...new Set([...types, ...(types.includes(XLSX_MIME) ? [XLS_MIME] : [])]),
  ];
}
