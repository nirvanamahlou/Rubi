/** Bank-uncertain checkout holds remain inventory until an authenticated result resolves them. */
export function liveCapacityHolds(now = new Date()) {
  return {
    status: 'ACTIVE',
    OR: [
      { expiresAt: { gt: now } },
      { checkoutSessionId: { not: null }, paymentPendingAt: { not: null } },
    ],
  };
}
