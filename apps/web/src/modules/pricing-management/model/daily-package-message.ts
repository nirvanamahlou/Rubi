export interface DailyPackageMessage {
  type: 'rubi-daily-package-publish';
  requestId: string;
  title: string;
  blob: Blob;
}

export function dailyPackageMessage(
  value: unknown,
): DailyPackageMessage | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<DailyPackageMessage>;
  if (
    data.type !== 'rubi-daily-package-publish' ||
    typeof data.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(data.requestId) ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.length > 200 ||
    !(data.blob instanceof Blob) ||
    data.blob.type !== 'application/pdf' ||
    data.blob.size < 1 ||
    data.blob.size > 25 * 1024 * 1024
  )
    return null;
  return data as DailyPackageMessage;
}

export function dailyPackageEvent(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  origin: string,
  source: Window | null | undefined,
) {
  return source && event.origin === origin && event.source === source
    ? dailyPackageMessage(event.data)
    : null;
}
