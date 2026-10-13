import {
  FILTER_KEYS,
  resolveReportFilters,
  filterQuery,
  validFilteredSource,
  projectFilteredSource,
} from './report-filters.mjs';
import { ServiceError } from './errors.mjs';
import { personalFollowUps } from './personal-source.mjs';
import { validSalesSource, projectSalesSource } from './sales-source.mjs';
import {
  validBalanceSource,
  projectBalanceSource,
} from './balances-source.mjs';
import {
  validConversionSource,
  projectConversionSource,
} from './conversion-source.mjs';

const errors = Object.freeze([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_TOOL_INPUT',
  'INVALID_SOURCE',
  'SOURCE_TIMEOUT',
  'SOURCE_TOO_LARGE',
  'SOURCE_NOT_CONNECTED',
  'SOURCE_CAP_EXCEEDED',
  'SOURCE_NOT_READY',
  'SOURCE_UNAVAILABLE',
]);
const inputSchema = Object.freeze({
  type: 'object',
  properties: Object.freeze({}),
  additionalProperties: false,
});
const personal = (id, path, key, limit, description) => ({
  id,
  path,
  key,
  limit,
  description,
  domain: 'personal',
  scope: 'SELF',
  base: 'core',
  permissions: [],
  identitySource: id,
  validate: (body) =>
    Boolean(body && Array.isArray(body[key]) && body[key].length <= limit),
  project: (body, now) => ({
    followUps: personalFollowUps(id, body[key], now),
    truncated: body[key].length === limit,
  }),
});
const definitions = [
  {
    id: 'sales.filter-options',
    version: 2,
    domain: 'sales',
    scope: 'AUTHORIZED_BRANCHES',
    description: 'Permitted branches and bounded primary-route city choices',
    base: 'reports',
    path: '/sales/assistant/filter-options',
    permissions: ['sales.contracts.read.all'],
    validate: (body) =>
      body?.version === 2 &&
      body.source === 'sales.assistant.filter-options.v2' &&
      typeof body.incomplete === 'boolean' &&
      typeof body.observedAt === 'string' &&
      Number.isFinite(Date.parse(body.observedAt)) &&
      [body.cities, body.branches].every(
        (rows) =>
          Array.isArray(rows) &&
          rows.length <= 1000 &&
          new Set(rows.map((row) => row?.id)).size === rows.length &&
          rows.every(
            (row) =>
              row &&
              /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.id) &&
              typeof row.name === 'string' &&
              row.name.trim().length > 0 &&
              row.name.length <= 200,
          ),
      ),
    project: (body) => ({
      version: 2,
      source: body.source,
      observedAt: body.observedAt,
      incomplete: body.incomplete,
      cities: body.cities.map(({ id, name }) => ({ id, name })),
      branches: body.branches.map(({ id, name }) => ({ id, name })),
    }),
  },
  personal(
    'calendar',
    '/workbench/calendar',
    'data',
    1000,
    'Personal calendar follow-ups',
  ),
  personal(
    'notes',
    '/workbench/notes',
    'data',
    500,
    'Personal scheduled note reminders',
  ),
  personal(
    'procurement',
    '/workbench/procurement-follow-ups',
    'items',
    100,
    'Assigned procurement follow-ups',
  ),
  {
    id: 'sales.weekly',
    description: 'Confirmed discounted contractual sales by currency',
    domain: 'sales',
    scope: 'ALL_AUTHORIZED_SALES',
    base: 'reports',
    path: '/sales/assistant/weekly',
    permissions: ['sales.contracts.read.all'],
    validate: validSalesSource,
    project: projectSalesSource,
  },
  {
    id: 'sales.contract-balances',
    description: 'Current contractual balances, not accounting receivables',
    domain: 'sales',
    scope: 'ALL_AUTHORIZED_SALES',
    base: 'reports',
    path: '/sales/assistant/contract-balances',
    permissions: ['sales.contracts.read.all', 'sales.payments.read'],
    validate: validBalanceSource,
    project: projectBalanceSource,
  },
  {
    id: 'customer-affairs.call-conversion',
    description: 'Logged-call lead conversion within authorized branches',
    domain: 'customer-affairs',
    scope: 'AUTHORIZED_BRANCHES',
    base: 'reports',
    path: '/customer-affairs/assistant/call-conversion',
    permissions: ['sales.contracts.read.all', 'customer_affairs.lead.read'],
    validate: validConversionSource,
    project: projectConversionSource,
  },
];

const filteredDefinitions = [
  ['sales.weekly', 'sales.report.v2', '/sales/assistant/report', 'sales'],
  [
    'sales.contract-balances',
    'sales.contract-balances.v2',
    '/sales/assistant/contract-balances/filtered',
    'balances',
  ],
  [
    'customer-affairs.call-conversion',
    'customer-affairs.call-conversion.v2',
    '/customer-affairs/assistant/call-conversion/filtered',
    'conversion',
  ],
];
for (const [original, id, path, kind] of filteredDefinitions) {
  definitions.push({
    ...definitions.find((tool) => tool.id === original),
    id,
    path,
    version: 2,
    filtered: true,
    validate: (body) => validFilteredSource(body, kind),
    project: (body) => projectFilteredSource(body, kind),
    matches: (body, input) =>
      FILTER_KEYS.every((key) => (input[key] ?? null) === body.filters[key]),
  });
}
const filteredInputSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze(
    Object.fromEntries(
      FILTER_KEYS.map((key) => [key, Object.freeze({ type: 'string' })]),
    ),
  ),
});

// Internal executable contracts, never model-controlled configuration.
export const TOOLS = Object.freeze(
  definitions.map((definition) =>
    Object.freeze({
      ...definition,
      version: definition.version ?? 1,
      method: 'GET',
      sideEffects: false,
      inputSchema: definition.filtered ? filteredInputSchema : inputSchema,
      permissions: Object.freeze(definition.permissions),
      errors,
      limits: Object.freeze({ timeoutMs: 2500, maxResponseBytes: 512 * 1024 }),
    }),
  ),
);
export const PERSONAL_TOOLS = Object.freeze(
  TOOLS.filter((tool) => tool.scope === 'SELF'),
);
const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));
if (
  byId.size !== TOOLS.length ||
  TOOLS.some(
    (tool) =>
      tool.method !== 'GET' ||
      tool.sideEffects !== false ||
      typeof tool.validate !== 'function' ||
      typeof tool.project !== 'function',
  )
)
  throw new Error('Invalid assistant tool registry');

export function getTool(id) {
  const tool = byId.get(id);
  if (!tool) throw new ServiceError(404, 'UNKNOWN_TOOL');
  return tool;
}

export function validateToolInput(input, id, now) {
  if (id && getTool(id).filtered)
    return filterQuery(resolveReportFilters(input, now));
  if (
    !input ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).length !== 0
  )
    throw new ServiceError(400, 'INVALID_TOOL_INPUT');
}
