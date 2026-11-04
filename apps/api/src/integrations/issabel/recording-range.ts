import { HttpException } from '@nestjs/common';

/** One RFC byte range only; bounds are checked before decrypting audio. */
export function recordingRange(header: string | undefined, size: number) {
  const fail = (): never => {
    throw new HttpException('Unsatisfiable audio range.', 416);
  };
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || header.length > 80) return fail();
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  )
    return fail();
  const start = first ?? Math.max(0, size - (last ?? 0));
  const end = first === null ? size - 1 : Math.min(last ?? size - 1, size - 1);
  if (start >= size || start > end || (first === null && last === 0))
    return fail();
  return { start, end, partial: true };
}
