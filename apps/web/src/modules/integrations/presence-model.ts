import type { SitePresenceV1 } from './api/client';
export function validatePresence(value: SitePresenceV1, siteId: string) {
  if (
    value.schemaVersion !== 1 ||
    value.registrySystemId !== siteId ||
    !['ACTIVE', 'NOT_CONFIGURED'].includes(value.state) ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    !Number.isInteger(value.activeWindowSeconds) ||
    value.activeWindowSeconds < 10 ||
    value.activeWindowSeconds > 300 ||
    !Array.isArray(value.nodes) ||
    value.nodes.length === 0 ||
    value.nodes.length > 60 ||
    !Array.isArray(value.edges) ||
    value.edges.length > 150
  )
    throw Error('قرارداد مانیتورینگ سایت معتبر نیست.');
  const ids = new Set<string>();
  let total = 0;
  for (const node of value.nodes) {
    if (
      ids.has(node.id) ||
      !/^[a-z0-9-]{1,40}$/.test(node.id) ||
      typeof node.kind !== 'string' ||
      node.kind.length > 40 ||
      typeof node.title !== 'string' ||
      node.title.length > 100 ||
      (node.column !== null &&
        (!Number.isInteger(node.column) ||
          node.column < 0 ||
          node.column > 8)) ||
      (node.row !== null &&
        (!Number.isInteger(node.row) || node.row < 0 || node.row > 6)) ||
      (node.column === null) !== (node.row === null)
    )
      throw Error('نقشهٔ بخش‌های سایت معتبر نیست.');
    ids.add(node.id);
    if (value.state === 'ACTIVE') {
      if (
        typeof node.count !== 'number' ||
        !Number.isSafeInteger(node.count) ||
        node.count < 0
      )
        throw Error('شمارش حضور معتبر نیست.');
      total += node.count;
    }
  }
  if (value.edges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to)))
    throw Error('ارتباط بخش‌های سایت معتبر نیست.');
  if (value.state === 'ACTIVE' && value.total !== total)
    throw Error('مجموع حضور بخش‌ها یکسان نیست.');
  return value;
}
export function presenceLayout(nodes: SitePresenceV1['nodes']) {
  const positioned = nodes.filter((node) => node.column !== null);
  return {
    width: (Math.max(0, ...positioned.map((n) => n.column!)) + 1) * 184 - 22,
    height: (Math.max(0, ...positioned.map((n) => n.row!)) + 1) * 104,
  };
}
