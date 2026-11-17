import { createHmac, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
export type CheckoutFailureProof = {
  version: 1;
  terminalId: string;
  checkedAt: string;
  bankReference: string;
  bankOutcome: 'NOT_PAID' | 'REVERSED_CONFIRMED';
  signature: string;
};
/** Only a durable server-verified final bank outcome authorizes release, never a redirect flag. */
export function verifyCheckoutFailure(
  site: string,
  externalId: string,
  attemptKey: string,
  proof: CheckoutFailureProof,
  actor: AuthenticatedActor,
  raw = process.env.SITE_GATEWAY_SETTLEMENTS ?? '{}',
) {
  let binding:
    | { userId: string; branchId: string; terminalId: string; secret: string }
    | undefined;
  try {
    const values: unknown = JSON.parse(raw);
    if (
      values &&
      typeof values === 'object' &&
      !Array.isArray(values) &&
      Object.hasOwn(values, site)
    )
      binding = (values as Record<string, typeof binding>)[site];
  } catch {
    /* fail closed */
  }
  if (
    !binding ||
    binding.userId !== actor.userId ||
    !actor.branchIds.includes(binding.branchId) ||
    typeof binding.secret !== 'string' ||
    binding.secret.length < 64
  )
    throw new ForbiddenException('اتصال نتیجه بانک تنظیم نشده است.');
  if (
    !proof ||
    proof.version !== 1 ||
    proof.terminalId !== binding.terminalId ||
    !['NOT_PAID', 'REVERSED_CONFIRMED'].includes(proof.bankOutcome) ||
    typeof proof.bankReference !== 'string' ||
    proof.bankReference.length > 100 ||
    typeof proof.checkedAt !== 'string' ||
    !Number.isFinite(Date.parse(proof.checkedAt)) ||
    Date.parse(proof.checkedAt) > Date.now() + 60000 ||
    typeof proof.signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(proof.signature)
  )
    throw new BadRequestException('نتیجه قطعی بانک معتبر نیست.');
  const message = JSON.stringify([
    'checkout-hold-result-v1',
    site,
    externalId,
    attemptKey,
    'FAILED',
    proof.terminalId,
    proof.checkedAt,
    proof.bankReference,
    proof.bankOutcome,
  ]);
  const expected = createHmac('sha256', binding.secret)
    .update(message)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(proof.signature, 'hex')))
    throw new ForbiddenException('امضای نتیجه بانک معتبر نیست.');
}
