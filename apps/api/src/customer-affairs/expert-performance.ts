export const expertMetrics = [
  'inboundAnswered',
  'outboundAttempts',
  'outboundConnected',
  'uniqueContacts',
  'open',
  'overdue',
  'completion',
] as const;
export type ExpertMetric = (typeof expertMetrics)[number];
export type ExpertDetail = {
  at: string | null;
  kind: string;
  result: string;
  extension?: string | undefined;
  shared?: boolean;
};
export type ExpertCallFact = {
  id: string;
  contactId: string;
  knownPhone: boolean;
  at: string;
  direction: string;
  connected: boolean;
  complete: boolean;
  actors: string[];
  extension?: string | undefined;
};
export type ExpertTaskFact = { ownerId: string; dueAt: string | null };
export function expertPerformance(
  staff: { id: string; name: string; extensions: string[] }[],
  calls: ExpertCallFact[],
  tasks: ExpertTaskFact[],
  now: string,
  allowed: string[] | null,
) {
  calls = [
    ...new Map(
      calls.map((c) => [c.id, { ...c, actors: [...new Set(c.actors)] }]),
    ).values(),
  ];
  const visible = (id: string) => allowed === null || allowed.includes(id);
  const ids = new Set(
    [
      ...staff.map((s) => s.id),
      ...calls.flatMap((c) => c.actors),
      ...tasks.map((t) => t.ownerId),
    ].filter(visible),
  );
  const details = new Map<string, Record<ExpertMetric, ExpertDetail[]>>();
  const rows = [...ids]
    .map((id) => {
      const roster = staff.filter((s) => s.id === id);
      const own = calls.filter((c) => c.actors.includes(id));
      const d: Record<ExpertMetric, ExpertDetail[]> = {
        inboundAnswered: [],
        outboundAttempts: [],
        outboundConnected: [],
        uniqueContacts: [],
        open: [],
        overdue: [],
        completion: [],
      };
      const contacts = new Set<string>();
      for (const c of own) {
        const item = {
          at: c.at,
          kind: c.direction,
          result: c.connected ? 'CONNECTED' : 'NOT_CONNECTED',
          extension: c.extension,
          shared: c.actors.length > 1,
        };
        if (c.direction === 'INBOUND' && c.connected)
          d.inboundAnswered.push(item);
        if (c.direction === 'OUTBOUND') {
          d.outboundAttempts.push(item);
          if (c.connected) d.outboundConnected.push(item);
        }
        if (c.knownPhone && !contacts.has(c.contactId)) {
          contacts.add(c.contactId);
          d.uniqueContacts.push(item);
        }
        d.completion.push({
          ...item,
          result: c.complete ? 'COMPLETE' : 'INCOMPLETE',
        });
      }
      for (const t of tasks.filter((t) => t.ownerId === id)) {
        const item = { at: t.dueAt, kind: 'FOLLOW_UP', result: 'OPEN' };
        d.open.push(item);
        if (t.dueAt && t.dueAt < now) d.overdue.push(item);
      }
      details.set(id, d);
      return {
        id,
        name: roster[0]?.name ?? 'کارشناس خارج از فهرست فعلی',
        extensions: [
          ...new Set([
            ...roster.flatMap((s) => s.extensions),
            ...own.flatMap((c) => (c.extension ? [c.extension] : [])),
          ]),
        ].sort(),
        inboundAnswered: d.inboundAnswered.length,
        outboundAttempts: d.outboundAttempts.length,
        outboundConnected: d.outboundConnected.length,
        uniqueContacts: d.uniqueContacts.length,
        open: d.open.length,
        overdue: d.overdue.length,
        total: own.length,
        incomplete: own.filter((c) => !c.complete).length,
        completionRate: own.length
          ? own.filter((c) => c.complete).length / own.length
          : null,
        shared: own.some((c) => c.actors.length > 1),
      };
    })
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        b.open - a.open ||
        b.incomplete - a.incomplete ||
        a.name.localeCompare(b.name, 'fa') ||
        a.id.localeCompare(b.id),
    );
  return {
    rows,
    details,
    unattributed: calls.filter((c) => !c.actors.some(visible)).length,
  };
}
