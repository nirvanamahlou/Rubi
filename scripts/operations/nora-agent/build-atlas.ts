import { apiInventory } from './atlas-api';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { reportCatalog } from '../../../apps/web/src/modules/reports/model/reporting';
import { dashboardMetricSource } from '../../../apps/api/src/reporting/reporting-dashboard-source-lineage';
import {
  dashboardKpis,
  dashboardPages,
} from '../../../apps/web/src/modules/dashboard/model/registry';
import { AGENT_SOURCES } from '../../../apps/api/src/sales/assistant-agent/catalog';

import { operationalMetrics } from '../../../apps/web/src/modules/assistant/operational-metric-catalog';

const dir = 'docs/assistant/data-atlas';
const domainMatrix: {
  family: string;
  title: string;
  owner: string;
  concept: string;
  sources: string[];
  status: string;
}[] = JSON.parse(readFileSync(join(dir, 'domains.json'), 'utf8'));
const ownerByFamily = new Map(
  domainMatrix.map((row) => [row.family, row.owner]),
);
const metricIds = new Set<string>(
  operationalMetrics.map((metric) => metric.id),
);
const reportingOwner = 'Reporting';
const verifiedJson: Record<
  string,
  { keys: string[]; source: string; symbol: string }
> = {
  'ReservationWorkflowRevision.state': {
    keys: ['supplierStatus'],
    source:
      'apps/api/src/reservations/reservation-reporting-cancellations.public.ts',
    symbol: 'readReservationReportingCancellations',
  },
};
const schema = readFileSync(
  'packages/database/prisma/schema.prisma',
  'utf8',
).replaceAll('\r\n', '\n');
const models = new Map<string, string>();
const columnHints = new Map<
  string,
  Record<string, { field: string; type: string }>
>();
const enums = new Map<string, string[]>();
const modelColumns = new Map<string, Set<string>>();
const scalars = new Set([
  'String',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
  'Unsupported',
]);
for (const match of schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
  enums.set(
    match[1],
    [...match[2].matchAll(/^\s*([A-Z_a-z]\w*)[^\n]*$/gm)].map(
      (value) => value[1],
    ),
  );
}
for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const table = match[2].match(/@@map\("([^"]+)"\)/)?.[1] ?? match[1];
  models.set(table, match[1]);
  const hints: Record<string, { field: string; type: string }> = {};
  const scalarColumns = new Set<string>();
  for (const field of match[2].matchAll(
    /^\s*(\w+)\s+([\w\[\]?]+)([^\n]*)$/gm,
  )) {
    const column = field[3].match(/\s@map\("([^"]+)"\)/)?.[1] ?? field[1];
    const type = field[2].replace(/[\[\]?]/g, '');
    if (scalars.has(type) || enums.has(type)) scalarColumns.add(column);
    if (enums.has(type) || type === 'Json' || column !== field[1])
      hints[column] = { field: field[1], type: field[2] };
  }
  columnHints.set(table, hints);
  modelColumns.set(table, scalarColumns);
}
const domains: [RegExp, string][] = [
  [/^(customer_affairs|call_center)/, 'customer-affairs'],
  [/^customer/i, 'customers'],
  [/^(accounting|tax_|seasonal)/i, 'accounting'],
  [/^(finance|treasury)/i, 'finance'],
  [/^(reservation)/i, 'reservations'],
  [/^(sales|floatingtour)/i, 'sales'],
  [/^(ticket|tour)/i, 'ticket-catalog'],
  [/^procurement/i, 'procurement'],
  [/^package/i, 'package-pricing'],
  [/^(master|branches)/, 'master-data'],
  [/^(iam|user_)/, 'iam'],
  [/^hr_/, 'hr'],
  [/^website/, 'site-commerce'],
  [/^legal_/, 'legal-entities'],
  [/^system_/, 'system-management'],
  [/^automation/, 'tasks'],
  [/^integration/, 'integrations'],
  [/^document/, 'documents'],
  [/^_prisma/, 'database'],
];
function domain(name: string) {
  return (
    domains.find(([pattern]) => pattern.test(name))?.[1] ?? name.split('_')[0]
  );
}
// A physical classification for maintainers. Access and financial semantics come from the producer.
function tableRole(
  name: string,
  columns: Record<string, string>,
  keys: string[],
) {
  const normalized = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  if (name === '_prisma_migrations') return 'migration-history';
  if (
    /(^|_)(histories|history|revisions?|versions?|audit|events?|logs?)(_|$)/.test(
      normalized,
    )
  )
    return 'history';
  if (
    /(^|_)(queues?|outbox|inbox|jobs?|deliveries|attempts?|locks?)(_|$)/.test(
      normalized,
    )
  )
    return 'processing';
  const fk = keys.filter((key) => key.startsWith('FOREIGN KEY'));
  if (fk.length >= 2 && Object.keys(columns).length <= fk.length + 3)
    return 'association';
  return 'operational';
}
const records: object[] = [...enums].map(([id, values]) => ({
  kind: 'prisma-enum',
  id,
  values,
  access: 'internal-only',
}));
const physical = readFileSync(join(dir, 'schema.jsonl'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
const profile = new Map<string, boolean>(
  readFileSync(join(dir, 'presence.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const row = JSON.parse(line);
      return [row.table, row.populated];
    }),
);
if (profile.size !== physical.filter((r) => r.schema === 'public').length)
  throw new Error('Physical schema and presence snapshot disagree');
for (const table of physical) {
  const native = table.schema === 'public';
  const family = native ? domain(table.name) : 'sales';
  const owner = ownerByFamily.get(family);
  if (!owner) throw new Error('Review the domain of ' + table.name);
  if (native && !profile.has(table.name))
    throw new Error('Missing presence snapshot for ' + table.name);
  if (!native) {
    const definition = AGENT_SOURCES[table.name as keyof typeof AGENT_SOURCES];
    if (
      !definition ||
      definition.columns.some((column) => !Object.hasOwn(table.columns, column))
    )
      throw new Error('Unexpected scoped view shape: ' + table.name);
  }
  for (const [column, type] of Object.entries(table.columns)) {
    if (!native || (type !== 'json' && type !== 'jsonb')) continue;
    const proof = verifiedJson[table.name + '.' + column];
    if (proof) {
      const producer = readFileSync(proof.source, 'utf8');
      if (
        !producer.includes(proof.symbol) ||
        proof.keys.some((key) => !producer.includes('.' + key))
      )
        throw new Error('Review JSON contract ' + table.name + '.' + column);
    }
    records.push({
      kind: 'json-field',
      id: table.name + '.' + column,
      owner,
      access: 'internal-only',
      status: proof ? 'محدود' : 'نیازمند تطبیق',
      ...(proof ?? {}),
    });
  }
  records.push({
    kind: native ? 'table' : 'sql-view',
    id: table.schema + '.' + table.name,
    family,
    owner,
    model: native ? (models.get(table.name) ?? null) : null,
    access: native ? 'internal-only' : 'scoped-reader',
    ...(native
      ? {
          roleHint: tableRole(table.name, table.columns, table.keys),
          ...(modelColumns.has(table.name)
            ? {
                schemaComparison: {
                  modelOnly: [...modelColumns.get(table.name)!].filter(
                    (column) => !Object.hasOwn(table.columns, column),
                  ),
                  serverOnly: Object.keys(table.columns).filter(
                    (column) => !modelColumns.get(table.name)!.has(column),
                  ),
                },
              }
            : {}),
          status: 'محدود',
          populatedAtAudit: profile.get(table.name),
          columnHints: columnHints.get(table.name),
        }
      : {
          status: 'قابل استفاده',
          definition: AGENT_SOURCES[table.name as keyof typeof AGENT_SOURCES],
        }),
  });
}
for (const [table, model] of models) {
  if (!physical.some((r) => r.schema === 'public' && r.name === table))
    records.push({
      kind: 'pending-schema',
      id: table,
      model,
      family: domain(table),
    });
}
for (const report of reportCatalog)
  records.push({
    kind: 'report',
    id: report.code,
    ...report,
    owner: reportingOwner,
    status:
      report.availability === 'READY' ? 'قابل استفاده' : 'مستند ولی متصل‌نشده',
    access: 'native-catalog-at-request',
  });
for (const kpi of dashboardKpis)
  records.push({
    kind: 'kpi',
    ...kpi,
    owner: reportingOwner,
    status: metricIds.has(kpi.id)
      ? 'قابل استفاده'
      : dashboardMetricSource[kpi.id]
        ? 'نیازمند تطبیق'
        : 'مستند ولی متصل‌نشده',
    projection: dashboardMetricSource[kpi.id] ?? null,
  });
for (const metric of operationalMetrics)
  records.push({
    kind: 'native-metric',
    id: metric.id,
    title: metric.label,
    unit: metric.unit,
    periods: 'snapshot' in metric ? ['current'] : ['today', 'week', 'month'],
    source: dashboardMetricSource[metric.id] ?? null,
    access: 'GET /reports/nora/metric',
  });
for (const page of dashboardPages)
  records.push({
    kind: 'dashboard',
    ...page,
    owner: 'Dashboard',
    status: 'نیازمند تطبیق',
    visualizations: page.visualizations.map((visual) => ({
      ...visual,
      owner: reportingOwner,
      status: 'نیازمند تطبیق',
    })),
  });
const routeRoot = 'apps/web/src/app';
function visit(dirPath: string) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true }).sort(
    (a, b) => (a.name < b.name ? -1 : 1),
  )) {
    const path = join(dirPath, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.name === 'page.tsx') {
      const route =
        '/' +
        relative(routeRoot, dirPath)
          .split(sep)
          .filter((s) => s && !s.startsWith('('))
          .join('/');
      const code = readFileSync(path, 'utf8');
      const redirect = code.match(/\bredirect\(\s*['"]([^'"]+)['"]/u)?.[1];
      const components = Array.from(
        code.matchAll(/from ['"](@\/components\/[^'"]+)['"]/g),
        (match) => match[1],
      );
      const modules = Array.from(
        code.matchAll(/from ['"](@\/modules\/[^'"]+)['"]/g),
        (m) => m[1],
      );
      records.push({
        kind: 'page',
        id: route,
        source: path.split(sep).join('/'),
        ...(redirect ? { redirect } : {}),
        components,
        modules,
        ownerModules: [
          ...new Set(
            modules.length
              ? modules.map((name) => name.split('/')[2])
              : [
                  redirect?.split('/')[1]?.split('?')[0] ||
                    components[0]?.split('/')[2] ||
                    'web',
                ],
          ),
        ],
        status: 'نیازمند تطبیق',
      });
    }
  }
}
visit(routeRoot);
records.push(...apiInventory('apps/api/src', models));
const identities = new Set(
  records.map((record) => ('id' in record ? record.id : undefined)),
);
for (const entry of domainMatrix) {
  if (entry.sources.some((source) => !identities.has(source)))
    throw new Error('Stale source in ' + entry.family);
  records.push({ kind: 'domain', id: entry.family, ...entry });
}
const content =
  [
    {
      version: 1,
      sourceFingerprints: Object.fromEntries(
        [
          'apps/api/src/reporting/reporting.catalog.ts',
          'apps/api/src/reporting/reporting-native-operational.ts',
          'apps/api/src/reporting/reporting-native-sales.ts',
          'apps/api/src/reporting/nora-metrics.controller.ts',
          'apps/api/src/reporting/nora-owner-metrics.ts',
          'apps/api/src/sales/assistant-agent/count-breakdown.ts',
          'apps/api/src/sales/assistant-agent/hotel-ranking.ts',
          'apps/api/src/reservations/reservation-reporting-cancellations.public.ts',
        ].map((path) => [
          path,
          createHash('sha256')
            .update(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'))
            .digest('hex'),
        ]),
      ),
      snapshotDate: '2026-11-24',
      prismaHash: createHash('sha256').update(schema).digest('hex'),
    },
    ...records,
  ]
    .map((row) => JSON.stringify(row))
    .join('\n') + '\n';
function generate(target: string, expected: string) {
  if (!process.argv.includes('--check')) return writeFileSync(target, expected);
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== expected) {
    throw new Error(
      'ERP source atlas drift in ' +
        target +
        '. Rebuild after reviewing the producer.',
    );
  }
}
generate(join(dir, 'index.jsonl'), content);
const reports = Object.fromEntries(
  reportCatalog.map((report) => [
    report.code,
    {
      approvedView: report.approvedView,
      dateBasis: report.dateBasis,
      dimensions: report.dimensions,
      measures: report.measures,
      filters: report.filters,
      keywords: [
        report.category,
        report.description,
        ...dashboardKpis
          .filter((kpi) => kpi.reportCode === report.code)
          .map((kpi) => kpi.title),
      ].join(' '),
    },
  ]),
);
generate(
  'services/assistant/report-search-index.mjs',
  '// Generated from the ERP report and dashboard registries.\n// prettier-ignore\nexport const reportDefinitions = ' +
    JSON.stringify(reports) +
    ';\n',
);
console.log(records.length + ' ERP metadata records');
