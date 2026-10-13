/** Verify the fixed service policy against the returned authorized evidence. */
export function explainPersonal(
  item: { dueAt: string | null; sourcePriority?: string | undefined },
  observedAt: string,
) {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const day = (value: string) => {
    const p = Object.fromEntries(
      format.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
    );
    return (
      Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86400000
    );
  };
  const days = item.dueAt ? day(item.dueAt) - day(observedAt) : null;
  const reason:
    'ASSIGNED' | 'OVERDUE' | 'TODAY' | 'NEXT_THREE_DAYS' | 'THIS_WEEK' =
    days === null
      ? 'ASSIGNED'
      : days < 0
        ? 'OVERDUE'
        : days === 0
          ? 'TODAY'
          : days <= 3
            ? 'NEXT_THREE_DAYS'
            : 'THIS_WEEK';
  const rank =
    days !== null && days <= 0 ? 0 : days !== null && days <= 3 ? 1 : 2;
  const recorded =
    item.sourcePriority === 'URGENT'
      ? 0
      : item.sourcePriority === 'HIGH'
        ? 1
        : 2;
  return {
    reason,
    priority: (['HIGH', 'MEDIUM', 'LOW'] as const)[Math.min(rank, recorded)]!,
  };
}
