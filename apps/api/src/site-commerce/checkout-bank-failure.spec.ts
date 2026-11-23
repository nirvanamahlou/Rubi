import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  verifyCheckoutFailure,
  type CheckoutFailureProof,
} from './checkout-bank-failure';
const actor = { userId: 'qa-user', branchIds: ['qa-branch'] } as never,
  secret = 'x'.repeat(64),
  attempt = 'qa-payment-attempt-1';
const config = JSON.stringify({
  qa: {
    userId: 'qa-user',
    branchId: 'qa-branch',
    terminalId: 'qa-terminal',
    secret,
  },
});
function signed() {
  const proof: CheckoutFailureProof = {
    version: 1,
    terminalId: 'qa-terminal',
    checkedAt: new Date().toISOString(),
    bankReference: 'qa-bank-result',
    bankOutcome: 'NOT_PAID',
    signature: '',
  };
  proof.signature = createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'checkout-hold-result-v1',
        'qa',
        'checkout',
        attempt,
        'FAILED',
        proof.terminalId,
        proof.checkedAt,
        proof.bankReference,
        proof.bankOutcome,
      ]),
    )
    .digest('hex');
  return proof;
}
describe('authenticated final bank failure capacity release', () => {
  it('accepts an exact server-signed definitive result', () =>
    expect(() =>
      verifyCheckoutFailure('qa', 'checkout', attempt, signed(), actor, config),
    ).not.toThrow());
  it('rejects another checkout, attempt, site or tampered amount-independent final outcome', () => {
    const proof = signed();
    for (const [site, order, key] of [
      ['qa', 'other', attempt],
      ['qa', 'checkout', 'other-attempt'],
      ['other', 'checkout', attempt],
    ])
      expect(() =>
        verifyCheckoutFailure(site!, order!, key!, proof, actor, config),
      ).toThrow();
    expect(() =>
      verifyCheckoutFailure(
        'qa',
        'checkout',
        attempt,
        { ...proof, bankOutcome: 'REVERSED_CONFIRMED' },
        actor,
        config,
      ),
    ).toThrow();
  });
  it('rejects generic local failure and unknown/bare browser facts', () => {
    for (const bankOutcome of ['failed', 'unknown', 'VERIFY_ERROR', 'OK'])
      expect(() =>
        verifyCheckoutFailure(
          'qa',
          'checkout',
          attempt,
          { ...signed(), bankOutcome } as CheckoutFailureProof,
          actor,
          config,
        ),
      ).toThrow();
    expect(() =>
      verifyCheckoutFailure(
        'qa',
        'checkout',
        attempt,
        { ...signed(), signature: '0'.repeat(64) },
        actor,
        config,
      ),
    ).toThrow();
  });
  it('never accepts the secret or branch from another principal', () =>
    expect(() =>
      verifyCheckoutFailure(
        'qa',
        'checkout',
        attempt,
        signed(),
        { userId: 'another', branchIds: ['qa-branch'] } as never,
        config,
      ),
    ).toThrow());
});
