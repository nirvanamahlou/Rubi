export const DOWNLOAD_OBJECT_URL_TTL_MS = 60_000;

export function downloadFile(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(
    () => window.URL.revokeObjectURL(url),
    DOWNLOAD_OBJECT_URL_TTL_MS,
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  try {
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
  }
}
