import { parse, toSql } from 'pgsql-ast-parser';
import { AGENT_SOURCES, type AgentSource } from './catalog';

const functions = new Set([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'coalesce',
  'nullif',
  'round',
  'abs',
  'lower',
  'upper',
  'date_trunc',
  'date_part',
  'length',
  'now',
]);
const expressions = new Set([
  'ref',
  'integer',
  'numeric',
  'string',
  'boolean',
  'null',
  'binary',
  'unary',
  'call',
  'cast',
  'case',
  'ternary',
  'list',
  'select',
  'union',
  'union all',
  'with',
]);
const operators = new Set([
  '=',
  '!=',
  '<>',
  '<',
  '>',
  '<=',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  'AND',
  'OR',
  'NOT',
  'LIKE',
  'ILIKE',
  'NOT LIKE',
  'NOT ILIKE',
  'IN',
  'NOT IN',
  'IS',
  'IS NOT',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'NOT BETWEEN',
  'AT TIME ZONE',
]);
const casts = new Set([
  'text',
  'numeric',
  'decimal',
  'integer',
  'bigint',
  'int',
  'date',
  'timestamp',
  'timestamptz',
  'uuid',
  'timestamp with time zone',
  'timestamp without time zone',
]);

export function validateAgentSql(
  sql: unknown,
  sources: readonly AgentSource[],
) {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 12000)
    throw new Error('INVALID_SQL');
  const statements = parse(sql);
  if (statements.length !== 1) throw new Error('READ_ONLY_SQL_REQUIRED');
  const used = new Set<AgentSource>();
  let nodes = 0;
  function walk(value: unknown, ctes: Set<string>): void {
    if (++nodes > 2500) throw new Error('SQL_TOO_COMPLEX');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, ctes));
      return;
    }
    const node = value as Record<string, unknown>;
    const type = node.type;
    if (type === 'with') {
      const names = new Set(ctes);
      for (const binding of node.bind as Array<{
        alias: { name: string };
        statement: unknown;
      }>) {
        if (
          Object.hasOwn(AGENT_SOURCES, binding.alias.name) ||
          names.has(binding.alias.name)
        )
          throw new Error('INVALID_CTE');
        walk(binding.statement, names);
        names.add(binding.alias.name);
      }
      walk(node.in, names);
      return;
    }
    if (type === 'table') {
      const name = node.name as { name: string; schema?: string };
      if (name.schema && name.schema !== 'nora_agent')
        throw new Error('SOURCE_NOT_ALLOWED');
      if (name.schema || !ctes.has(name.name)) {
        if (!sources.includes(name.name as AgentSource))
          throw new Error('SOURCE_NOT_ALLOWED');
        used.add(name.name as AgentSource);
        // Always bind model source names to the trusted reporting schema.
        name.schema = 'nora_agent';
      }
      if (node.join) {
        const join = node.join as {
          type: string;
          on?: unknown;
          using?: unknown;
        };
        if (
          ![
            'INNER JOIN',
            'LEFT JOIN',
            'RIGHT JOIN',
            'FULL JOIN',
            'CROSS JOIN',
          ].includes(join.type)
        )
          throw new Error('JOIN_NOT_ALLOWED');
        walk(join.on, ctes);
        walk(join.using, ctes);
      }
      return;
    }
    if (
      type === 'statement' ||
      type === 'with recursive' ||
      (typeof type === 'string' && !expressions.has(type))
    )
      throw new Error('SQL_NODE_NOT_ALLOWED');
    if (
      node.into ||
      node.for ||
      node.forUpdate ||
      node.with ||
      node.over ||
      node.filter ||
      node.collate
    )
      throw new Error('SQL_FEATURE_NOT_ALLOWED');
    if (type === 'ref') {
      const name = node.name as string;
      // Alias references are resolved by PostgreSQL. They cannot grant access to
      // private columns because only curated views are reachable.
      if (name !== '*' && !/^[a-z_][a-z0-9_]{0,62}$/.test(name))
        throw new Error('INVALID_COLUMN');
      const table = node.table as { schema?: string } | undefined;
      if (table?.schema && table.schema !== 'nora_agent')
        throw new Error('SOURCE_NOT_ALLOWED');
    }
    if (type === 'call') {
      const fn = node.function as { name: string; schema?: string };
      if (fn.schema || !functions.has(fn.name.toLowerCase()))
        throw new Error('FUNCTION_NOT_ALLOWED');
    }
    if (
      (type === 'binary' || type === 'unary') &&
      !operators.has(String(node.op).toUpperCase())
    )
      throw new Error('OPERATOR_NOT_ALLOWED');
    if (type === 'cast') {
      const target = node.to as {
        name?: string;
        schema?: string;
        type?: string;
        config?: unknown;
      };
      if (
        target.schema ||
        !casts.has(target.name ?? '') ||
        target.type === 'array'
      )
        throw new Error('CAST_NOT_ALLOWED');
    }
    for (const [key, child] of Object.entries(node)) {
      if (
        key === 'type' ||
        (type === 'call' && key === 'function') ||
        (type === 'cast' && key === 'to') ||
        (type === 'ref' && key === 'table')
      )
        continue;
      walk(child, ctes);
    }
  }
  const root = statements[0]!;
  if (!['select', 'with', 'union', 'union all'].includes(root.type))
    throw new Error('READ_ONLY_SQL_REQUIRED');
  walk(root, new Set());
  if (!used.size) throw new Error('SOURCE_REQUIRED');
  // Conservative semantic guardrails for the first release. Money totals must
  // retain their currency dimension; join fanout is handled with separate
  // queries, not model assumptions about many-side cardinality.
  if (used.has('amounts') || used.has('payments')) {
    function contains(
      value: unknown,
      predicate: (node: Record<string, unknown>) => boolean,
    ): boolean {
      if (!value || typeof value !== 'object') return false;
      if (Array.isArray(value))
        return value.some((item) => contains(item, predicate));
      const node = value as Record<string, unknown>;
      return (
        predicate(node) ||
        Object.values(node).some((item) => contains(item, predicate))
      );
    }
    function checkMoney(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(checkMoney);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.type === 'select') {
        const hasSum = contains(
          node.columns,
          (entry) =>
            entry.type === 'call' &&
            ['sum', 'avg', 'min', 'max'].includes(
              String((entry.function as { name?: string })?.name).toLowerCase(),
            ),
        );
        if (hasSum) {
          if (
            !contains(
              node.groupBy,
              (entry) => entry.type === 'ref' && entry.name === 'currency_code',
            )
          )
            throw new Error('CURRENCY_GROUP_REQUIRED');
          if (
            used.has('passengers') ||
            used.has('services') ||
            (used.has('amounts') && used.has('payments'))
          )
            throw new Error('MONEY_FANOUT_REQUIRES_SEPARATE_QUERY');
        }
      }
      Object.values(node).forEach(checkMoney);
    }
    checkMoney(root);
  }
  return { sql: toSql.statement(root), sources: [...used] };
}
