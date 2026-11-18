import { salesApi, SalesApiError } from '../api/client';
import type { SalesContractCreateRequest } from '@nora/contracts';
import { browserRandomUuid } from '@/lib/browser-random-uuid';

export type Attempt = { key: string; digest: string };
// Store only a digest and a command key, with the same tab/account scope as the draft.
export async function submitOrRecover(
  payload: SalesContractCreateRequest,
  scope: string | null,
  memory: { current: Attempt | null },
) {
  const encoded = JSON.stringify(payload);
  const hashing = globalThis.crypto?.subtle;
  const digest = hashing
    ? Array.from(
        new Uint8Array(
          await hashing.digest('SHA-256', new TextEncoder().encode(encoded)),
        ),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('')
    : encoded;
  const storageKey = scope && hashing ? scope + ':submission' : null;
  const raw = storageKey ? sessionStorage.getItem(storageKey) : null;
  const prior: Attempt | null = raw
    ? (JSON.parse(raw) as Attempt)
    : memory.current;
  if (prior) {
    const result = await salesApi.submissionStatus(prior.key);
    if (result.data) {
      if (prior.digest !== digest)
        throw new Error(
          'درخواست قبلی ثبت شده است: ' +
            result.data.contractNumber +
            '؛ تغییرات را از همان پرونده انجام دهید.',
        );
      return salesApi.detail(result.data.id);
    }
    if (prior.digest !== digest)
      throw new Error(
        'نتیجه ثبت قبلی هنوز قطعی نیست. برای جلوگیری از ثبت تکراری، همان پیش‌نویس اولیه را بررسی کنید.',
      );
  }
  const attempt = prior ?? { key: browserRandomUuid(), digest };
  memory.current = attempt;
  if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  try {
    return await salesApi.create(payload, attempt.key);
  } catch (error) {
    if (
      error instanceof SalesApiError &&
      error.status > 0 &&
      error.status < 500 &&
      ![401, 403, 408, 409].includes(error.status)
    ) {
      memory.current = null;
      if (storageKey) sessionStorage.removeItem(storageKey);
      throw error;
    }
    const saved = await salesApi.submissionStatus(attempt.key);
    if (!saved.data)
      throw new Error(
        'نتیجه ثبت این درخواست هنوز روی سرور دیده نمی‌شود. برای بررسی دوباره، همان فرم را بدون تغییر نگه دارید.',
      );
    return salesApi.detail(saved.data.id);
  }
}
