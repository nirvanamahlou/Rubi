export type CapacityHoldRow = {
  id: string;
  quantity: number;
  requesterName?: string | null;
  requesterPhone?: string | null;
  siteCode: string | null;
  externalId: string | null;
  expiresAt: string;
  paymentPendingAt: string | null;
  createdAt: string;
  remainingSeconds: number | null;
};
export type CapacityHoldPage = {
  data: CapacityHoldRow[];
  serverNow: string;
  hasMore: boolean;
  nextCursor: string | null;
};
export type CapacityHoldLoader = (
  offerId: string,
  cursor?: string,
  signal?: AbortSignal,
) => Promise<CapacityHoldPage>;

/** Countdown is anchored to the server's timestamp and monotonic elapsed time, never the PC clock. */
export function holdSecondsRemaining(
  hold: Pick<CapacityHoldRow, 'expiresAt' | 'paymentPendingAt'>,
  serverNow: string,
  elapsedMs: number,
): number | null {
  if (hold.paymentPendingAt) return null;
  const deadline = Date.parse(hold.expiresAt);
  const anchor = Date.parse(serverNow);
  if (!Number.isFinite(deadline) || !Number.isFinite(anchor)) return null;
  return Math.max(
    0,
    Math.ceil((deadline - anchor - Math.max(0, elapsedMs)) / 1000),
  );
}
export function holdClock(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60).toLocaleString('fa-IR')}:${(value % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
}

export async function readHoldPages(
  load: CapacityHoldLoader,
  offerId: string,
  pages: number,
  signal: AbortSignal,
) {
  const rows = new Map<string, CapacityHoldRow>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let first: { serverNow: string; receivedAt: number } | undefined;
  let last: CapacityHoldPage | undefined;
  for (let page = 0; page < pages; page++) {
    signal.throwIfAborted();
    const result = await load(offerId, cursor, signal);
    signal.throwIfAborted();
    if (
      !Number.isFinite(Date.parse(result.serverNow)) ||
      result.hasMore !== Boolean(result.nextCursor) ||
      result.data.some(
        (row) =>
          !row.id ||
          !Number.isSafeInteger(row.quantity) ||
          row.quantity < 1 ||
          !Number.isFinite(Date.parse(row.expiresAt)),
      )
    ) {
      throw new Error('پاسخ فهرست رزروهای ظرفیت معتبر نیست.');
    }
    first ??= { serverNow: result.serverNow, receivedAt: performance.now() };
    for (const row of result.data) rows.set(row.id, row);
    last = result;
    if (!result.nextCursor) break;
    if (cursors.has(result.nextCursor))
      throw new Error('پاسخ فهرست رزروهای ظرفیت معتبر نیست.');
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  if (!first || !last) throw new Error('پاسخ فهرست رزروهای ظرفیت معتبر نیست.');
  return { ...first, data: [...rows.values()], hasMore: last.hasMore };
}
