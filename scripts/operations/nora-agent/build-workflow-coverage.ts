import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { USER_ACCESS_SCREENS } from '../../../packages/contracts/src/iam/user-access';
import { assistantGuideCatalogues } from '../../../apps/web/src/modules/assistant/assistant-guide-registry';

type Row = {
  owner?: string;
  id: string;
  need: string;
  panel: string;
  scope: string;
  source: string;
  connection: 'connected' | 'needs-connection';
  acceptance: string;
  guide?: string;
  roles?: string[];
  cases?: string[];
  definition?: string;
};
type AtlasRow = {
  kind?: string;
  id: string;
  title: string;
  source?: string;
  permission?: string;
  approvedView?: string;
  projection?: string;
  access?: string;
  availability?: string;
  businessDefinition?: string;
  description?: string;
  periods?: string[];
  ownerModules?: string[];
  redirect?: string;
  owner?: string;
  kpiIds?: string[];
};
const read = (path: string) =>
  readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const dir = 'docs/assistant';
const data: AtlasRow[] = read(dir + '/data-atlas/index.jsonl')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const cases: {
  id: string;
  role: string;
  question: string;
  expectedGuides: string[];
}[] = read(dir + '/role-guide-acceptance.jsonl')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const rows = new Map<string, Row>();
const guideRefs = new Set<string>();
const sources = new Set<string>();
function add(row: Row) {
  if (rows.has(row.id)) throw new Error('Duplicate coverage id ' + row.id);
  rows.set(row.id, row);
}

// Guide roles below are acceptance audiences. Effective access is evaluated by the session.
for (const [module, guide] of Object.entries(assistantGuideCatalogues)) {
  const path = dir + '/guides/' + module + '.md';
  const markdown = read(path);
  sources.add(path);
  const metadata = new Map(
    [...markdown.matchAll(/<!-- nora-guide (.+?) -->/g)].map((match) => {
      const item: {
        id: string;
        sources?: string[];
        source?: string;
        permission?: string;
      } = JSON.parse(match[1]);
      return [item.id, item];
    }),
  );
  for (const topic of guide.topics) {
    const ref = module + '/' + topic.id;
    const meta = metadata.get(topic.id);
    if (!meta) throw new Error('Guide missing authored section ' + ref);
    for (const source of [
      ...(meta.sources ?? []),
      ...(meta.source ? [meta.source] : []),
    ])
      sources.add(source);
    const scenarios = cases.filter((c) => c.expectedGuides.includes(ref));
    guideRefs.add(ref);
    add({
      owner: module,
      id: 'guide/' + ref,
      need: topic.title,
      panel: topic.href,
      scope: ['canViewRoute', meta.permission].filter(Boolean).join(' + '),
      source: path + '#' + topic.id,
      connection: 'connected',
      acceptance: 'follow-steps-in-panel',
      guide: ref,
      ...(scenarios.length
        ? {
            roles: [...new Set(scenarios.map((c) => c.role))],
            cases: scenarios.map((c) => c.id),
          }
        : {}),
    });
  }
}

// Screen inventory stays separate from topics: a link to a parent panel proves nothing about a tab.
for (const screen of USER_ACCESS_SCREENS) {
  const query = new URLSearchParams(screen.query);
  add({
    id: 'screen/' + screen.id,
    need: screen.title,
    panel: screen.route + (query.size ? '?' + query.toString() : ''),
    scope: 'canViewScreen ' + screen.id,
    source: 'packages/contracts/src/iam/user-access.ts',
    definition: [screen.group, screen.tab].filter(Boolean).join('/'),
    owner: screen.group,
    connection: 'needs-connection',
    acceptance: 'verify-screen-workflows',
  });
}
const nativeMetrics = new Map(
  data.filter((r) => r.kind === 'native-metric').map((r) => [r.id, r]),
);
for (const item of data) {
  if (item.kind === 'page') {
    if (!item.source?.includes('/(crm)/')) continue;
    add({
      id: 'page' + item.id,
      need: item.id,
      panel: item.id,
      owner: item.ownerModules?.join(',') ?? 'web',
      scope: 'canViewRoute + effective screen grants',
      source: item.source,
      definition: item.redirect ?? item.ownerModules?.join(','),
      connection: 'needs-connection',
      acceptance: 'verify-screen-workflows',
    });
  } else if (item.kind === 'report') {
    add({
      owner: item.owner,
      id: 'report/' + item.id,
      need: item.title,
      panel: '/reports?report=' + item.id,
      source: item.approvedView ?? item.id,
      scope: item.permission ?? 'native-report ACL',
      definition: item.description,
      connection: 'needs-connection',
      acceptance: 'compare-executed-report-with-panel',
    });
    if (item.availability === 'READY')
      add({
        owner: item.owner,
        id: 'discover/' + item.id,
        need: item.title,
        panel: '/reports?report=' + item.id,
        source: 'services/assistant/report-catalog.mjs',
        scope: item.permission ?? 'native-report ACL',
        definition: item.approvedView,
        connection: 'connected',
        acceptance: 'discover-authorized-report',
      });
  } else if (item.kind === 'native-metric' || item.kind === 'kpi') {
    const native = nativeMetrics.get(item.id);
    add({
      owner: item.owner ?? 'Reporting',
      id: item.kind + '/' + item.id,
      need: item.title,
      panel: '/dashboard',
      source: native
        ? 'GET /reports/nora/metric?id=' + item.id
        : (item.projection ?? item.id),
      definition:
        item.businessDefinition ??
        [item.source, item.periods?.join(',')].filter(Boolean).join(' / '),
      scope:
        item.permission ?? 'native metric ACL + effective actor and company',
      connection: native ? 'connected' : 'needs-connection',
      acceptance: 'compare-value-period-currency-and-population',
    });
  }
}
const readers = [
  [
    'workbench/request-status',
    'workbench-request-guide',
    'describeWorkbenchRequest',
  ],
  [
    'call-center/call-center-request',
    'call-center-request-guide',
    'readCallCenterRequestStatus',
  ],
  [
    'call-center/call-center-overview',
    'call-center-request-guide',
    'readCallCenterMetric',
  ],
  [
    'finance-delivery/status',
    'finance-delivery-guide',
    'readFinanceDeliveryStatus',
  ],
  ['b2b/metrics', 'b2b-guide', 'readB2bGuide'],
  ['b2c/metrics', 'customer-guides', 'readCustomerGuide'],
  ['purchase/dashboard', 'purchase-guides', 'readPurchaseGuide'],
  ['documents/overview', 'document-guides', 'readDocumentGuide'],
  ['flight-pricing/overview', 'flight-pricing-guide', 'readFlightPricing'],
  ['master-data/currencies', 'master-data-guide', 'readMasterDataGuide'],
  ['flight-capacity/capacity', 'flight-capacity-guide', 'readFlightCapacity'],
  [
    'reservation-report/cards',
    'reservation-report-guide',
    'readReservationReportAnswer',
  ],
  [
    'correspondence/incoming',
    'correspondence-guide',
    'readCorrespondenceStatus',
  ],
  ['petty-cash/fund', 'petty-cash-guide', 'readPettyCashGuide'],
  ['tour/overview', 'tour-guide', 'readTourGuideStatus'],
  [
    'hotel-purchase-rates/hotel-purchase-existing',
    'hotel-purchase-guide',
    'readHotelPurchaseGuidePack',
  ],
];
for (const [guide, file, symbol] of readers) {
  const source = 'apps/web/src/modules/assistant/' + file + '.ts';
  const topic = rows.get('guide/' + guide);
  if (!topic || !read(source).includes('function ' + symbol + '('))
    throw new Error('Missing reader or guide for ' + guide);
  sources.add(source);
  add({
    owner: topic.owner,
    id: 'reader/' + guide,
    need: topic.need,
    panel: topic.panel,
    source: source + '#' + symbol,
    guide,
    scope: 'same authorized reader and company as panel',
    connection: 'connected',
    acceptance: 'compare-permitted-records-with-panel',
  });
}
for (const [id, need, panel, source, scope] of [
  [
    'rolling-sales',
    'مبلغ فروش دو هفته اخیر و فهرست قراردادهای مشمول',
    '/sales',
    'apps/api/src/sales/assistant-agent/rolling-sales.ts',
    'native sales row and company scope',
  ],
  [
    'settled-vouchers',
    'قراردادهای تسویه‌شده و اقامت‌های دارای کسری واچر',
    '/reservations',
    'apps/api/src/reporting/settled-vouchers.controller.ts',
    'intersection of native sales, finance and reservations scopes',
  ],
]) {
  sources.add(source);
  add({
    id: 'workflow/' + id,
    owner: id === 'rolling-sales' ? 'Sales' : 'Sales/Finance/Reservations',
    need,
    panel,
    source,
    scope,
    connection: 'connected',
    acceptance: 'compare-permitted-records-with-panel',
  });
}
sources.add('packages/contracts/src/iam/user-access.ts');
sources.add('packages/contracts/src/iam/user-access-controls.ts');
sources.add('services/assistant/report-catalog.mjs');
sources.add('apps/api/src/reporting/nora-metrics.controller.ts');
sources.add('apps/api/src/reporting/nora-owner-metrics.ts');
sources.add('apps/web/src/modules/assistant/operational-metric-catalog.ts');
sources.add(dir + '/role-guide-acceptance.jsonl');
const byRole = new Map<string, number>();
const caseIds = new Set<string>();
for (const entry of cases) {
  if (
    !entry.question ||
    !entry.role ||
    !entry.expectedGuides.length ||
    caseIds.has(entry.id)
  )
    throw new Error('Invalid role case ' + entry.id);
  for (const ref of entry.expectedGuides) {
    if (!guideRefs.has(ref)) throw new Error('Unknown acceptance guide ' + ref);
  }
  caseIds.add(entry.id);
  byRole.set(entry.role, (byRole.get(entry.role) ?? 0) + 1);
}
if (byRole.size !== 11 || [...byRole.values()].some((count) => count !== 20))
  throw new Error('Expected 20 prompts for each of the 11 audited roles');
const sorted = [...rows.values()].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
);
const hashes = Object.fromEntries(
  [...sources]
    .sort()
    .map((s) => [s, createHash('sha256').update(read(s)).digest('hex')]),
);
const file = dir + '/workflow-coverage.jsonl';
const serialized =
  [{ version: 1, sourceFingerprints: hashes }, ...sorted]
    .map((r) => JSON.stringify(r))
    .join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (read(file) !== serialized)
    throw new Error(
      'Stale workflow coverage. Review changed workflows and rebuild ' + file,
    );
} else if (process.argv.includes('--table')) {
  const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
  console.log('|شناسه|کار کاربر|مسیر پنل|مجوز|منبع|وضعیت اتصال|آزمون|');
  console.log('|---|---|---|---|---|---|---|');
  for (const row of sorted)
    console.log(
      '|' +
        [
          row.id,
          row.need,
          row.panel,
          row.scope,
          row.source,
          row.connection,
          row.acceptance,
        ]
          .map(escape)
          .join('|') +
        '|',
    );
} else {
  writeFileSync(file, serialized);
}
