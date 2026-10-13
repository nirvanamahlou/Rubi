import { recommendations } from './recommendations.mjs';
/** Fixed read capabilities; neither prompts nor scope selectors are accepted. */
export const ACTIONS = Object.freeze({
  'daily-summary': Object.freeze({ kind: 'PERSONAL', sideEffects: false }),
  'sales-analysis': Object.freeze({
    kind: 'SALES_READ',
    sideEffects: false,
    reason: 'SALES_SOURCE_UNAVAILABLE',
  }),
  'receivables-follow-up': Object.freeze({
    kind: 'BUSINESS_GATE',
    sideEffects: false,
    reason: 'RECEIVABLES_SOURCE_PENDING',
  }),
});

export function actionFromPath(path) {
  if (typeof path !== 'string') return null;
  const prefix = '/v1/assistant/actions/';
  if (!path.startsWith(prefix)) return null;
  const action = path.slice(prefix.length);
  return Object.hasOwn(ACTIONS, action) ? action : null;
}

export function dailySummary(snapshot) {
  const counts = {
    visible: snapshot.followUps.length,
    overdue: 0,
    dueSoon: 0,
    assigned: 0,
  };
  for (const item of snapshot.followUps) {
    if (item.reason === 'OVERDUE') counts.overdue++;
    else if (item.reason === 'DUE_SOON') counts.dueSoon++;
    else counts.assigned++;
  }
  return {
    version: 1,
    action: 'daily-summary',
    status: snapshot.sources.every((source) => source.status === 'READY')
      ? 'READY'
      : 'PARTIAL',
    scope: 'SELF',
    // Counts describe the visible bounded evidence, never the complete ERP queue.
    coverage: { horizonDays: 7, limit: 30, includesOverdue: true },
    counts,
    policyVersion: 2,
    recommendations: recommendations(snapshot),
    snapshot,
  };
}

export function blockedAction(action, observedAt) {
  return {
    version: 1,
    action,
    status: 'BLOCKED',
    scope: 'NONE',
    reason: ACTIONS[action].reason,
    observedAt,
  };
}
