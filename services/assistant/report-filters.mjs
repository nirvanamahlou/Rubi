import { ServiceError } from './errors.mjs';
import { validSalesSource, projectSalesSource } from './sales-source.mjs';
import {
  validBalanceSource,
  projectBalanceSource,
} from './balances-source.mjs';
import {
  validConversionSource,
  projectConversionSource,
} from './conversion-source.mjs';

export const FILTER_KEYS = Object.freeze([
  'startDate',
  'endDate',
  'originId',
  'destinationId',
  'branchId',
]);
const dayMs = 86400000;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fail = () => {
  throw new ServiceError(400, 'INVALID_REPORT_FILTER');
};
export function civilDate(value) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const shift = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);
export function resolveReportFilters(input, now = new Date()) {
  if (
    !input ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).some((key) => !FILTER_KEYS.includes(key)) ||
    (input.startDate === undefined) !== (input.endDate === undefined)
  )
    fail();
  const today = civilDate(now);
  const startDate = input.startDate ?? shift(today, -7);
  const endDate = input.endDate ?? shift(today, -1);
  for (const value of [startDate, endDate]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail();
    const date = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      fail();
  }
  const days = (Date.parse(endDate) - Date.parse(startDate)) / dayMs + 1;
  if (days < 1 || days > 90 || endDate >= today) fail();
  const result = { startDate, endDate };
  for (const key of ['originId', 'destinationId', 'branchId']) {
    if (
      input[key] !== undefined &&
      (typeof input[key] !== 'string' || !uuid.test(input[key]))
    )
      fail();
    result[key] = input[key]?.toLowerCase() ?? null;
  }
  return result;
}
export function filterQuery(filters) {
  return Object.fromEntries(
    FILTER_KEYS.filter((key) => filters[key] != null).map((key) => [
      key,
      filters[key],
    ]),
  );
}
export function parseFilterSearch(search, now) {
  const params = new URLSearchParams(search);
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) fail();
  return filterQuery(resolveReportFilters(Object.fromEntries(params), now));
}

const definitions = {
  sales: [
    'sales.assistant.report.v2',
    'sales.assistant.weekly.v1',
    validSalesSource,
    projectSalesSource,
  ],
  balances: [
    'sales.assistant.contract-balances.v2',
    'sales.assistant.contract-balances.v1',
    validBalanceSource,
    projectBalanceSource,
  ],
  conversion: [
    'customer-affairs.assistant.call-conversion.v2',
    'customer-affairs.assistant.call-conversion.v1',
    validConversionSource,
    projectConversionSource,
  ],
};
export function validFilteredSource(value, kind) {
  try {
    const [source, legacySource, validate] = definitions[kind];
    if (
      value?.version !== 2 ||
      value.source !== source ||
      !value.filters ||
      Object.keys(value.filters).length !== FILTER_KEYS.length
    )
      return false;
    const filters = resolveReportFilters(
      filterQuery(value.filters),
      new Date(value.observedAt),
    );
    if (!FILTER_KEYS.every((key) => value.filters[key] === filters[key]))
      return false;
    const days =
      (Date.parse(filters.endDate) - Date.parse(filters.startDate)) / dayMs + 1;
    if (!validate({ ...value, version: 1, source: legacySource }, days))
      return false;
    if (kind === 'balances') return value.dateBasis === 'CURRENT_AS_OF_REQUEST';
    if (kind === 'conversion' && (filters.originId || filters.destinationId))
      return false;
    return (
      civilDate(value.current.startUtc) === filters.startDate &&
      civilDate(value.current.endUtc) === shift(filters.endDate, 1) &&
      civilDate(value.previous.startUtc) === shift(filters.startDate, -days) &&
      [
        value.current.startUtc,
        value.current.endUtc,
        value.previous.startUtc,
      ].every((at) => civilDate(new Date(Date.parse(at) - 1)) !== civilDate(at))
    );
  } catch {
    return false;
  }
}
export function projectFilteredSource(value, kind) {
  return {
    ...definitions[kind][3](value),
    version: 2,
    filters: Object.fromEntries(
      FILTER_KEYS.map((key) => [key, value.filters[key]]),
    ),
    ...(kind === 'balances' ? { dateBasis: 'CURRENT_AS_OF_REQUEST' } : {}),
  };
}
