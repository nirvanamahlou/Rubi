/** Deterministic personal rules. No model, persistence or corporate balance rules. */
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function tehranDay(value) {
  const parts = Object.fromEntries(
    dayFormat.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
  return (
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) /
    86400000
  );
}
export function personalRule(item, observedAt) {
  const days = item.dueAt
    ? tehranDay(item.dueAt) - tehranDay(observedAt)
    : null;
  const reason =
    days === null
      ? 'ASSIGNED'
      : days < 0
        ? 'OVERDUE'
        : days === 0
          ? 'TODAY'
          : days <= 3
            ? 'NEXT_THREE_DAYS'
            : 'THIS_WEEK';
  const dateRank =
    days !== null && days <= 0 ? 0 : days !== null && days <= 3 ? 1 : 2;
  const sourceRank =
    item.sourcePriority === 'URGENT'
      ? 0
      : item.sourcePriority === 'HIGH'
        ? 1
        : 2;
  return {
    ruleId: 'PERSONAL_DUE_V2',
    reason,
    priority: ['HIGH', 'MEDIUM', 'LOW'][Math.min(dateRank, sourceRank)],
  };
}
export function comparePersonal(a, b, observedAt) {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return (
    rank[personalRule(a, observedAt).priority] -
      rank[personalRule(b, observedAt).priority] ||
    (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') ||
    a.id.localeCompare(b.id)
  );
}
export function recommendations(snapshot) {
  return snapshot.followUps
    .filter((item) =>
      snapshot.sources.some(
        (s) => s.id === item.source && s.status === 'READY' && s.asOf,
      ),
    )
    .map((item) => ({
      followUpId: item.id,
      ...personalRule(item, snapshot.generatedAt),
      id: `${item.id}:PERSONAL_DUE_V2`,
      source: item.source,
      observedAt: snapshot.sources.find((s) => s.id === item.source).asOf,
    }));
}
