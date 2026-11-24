import { reportDefinitions } from './report-search-index.mjs';
import { boundedAgentJson } from './agent-provider.mjs';
import { ServiceError } from './errors.mjs';

const normalize = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064b-\u065f]/gu, '')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\u200c\s]+/gu, ' ')
    .trim();
const stop = new Set([
  'از',
  'به',
  'در',
  'چه',
  'را',
  'گزارش',
  'گزارشهای',
  'برای',
  'های',
  'کدام',
  'منبع',
  'داده',
  'است',
  'تعداد',
  'درباره',
  'روی',
  'مورد',
  'report',
  'source',
  'the',
  'and',
]);
export function reportMatches(question, entries) {
  const words = [
    ...new Set(
      normalize(question)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 1 && !stop.has(w)),
    ),
  ];
  return entries
    .map((entry) => {
      const title = normalize(entry.title);
      const code = entry.code.split('_');
      const metadata = localDefinition(entry);
      const keywords = metadata
        ? normalize(
            [
              metadata.keywords,
              ...metadata.measures,
              ...metadata.dimensions,
            ].join(' '),
          )
        : '';
      return {
        entry,
        score: words.reduce(
          (score, word) =>
            score +
            (title.includes(word) || code.includes(word)
              ? 3
              : Number(keywords.includes(word))),
          0,
        ),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.entry);
}

function localDefinition(row) {
  const local = Object.hasOwn(reportDefinitions, row.code)
    ? reportDefinitions[row.code]
    : null;
  return local && local.approvedView === row.approvedView ? local : null;
}

// Report metadata remains scoped by the native catalog ACL. No row data or grants are inferred here.
export function createReportCatalog({
  base,
  cookie,
  signal,
  fetcher,
  modules,
}) {
  const exposed = new Map();
  const allowedModules =
    modules === undefined
      ? null
      : new Set(
          modules
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        );
  async function read() {
    let response;
    try {
      response = await fetcher(base + '/reports/catalog', {
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        headers: { cookie, accept: 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
    } catch {
      throw new ServiceError(503, 'AGENT_SOURCE_UNAVAILABLE');
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 403 && !exposed.size) return [];
      throw new ServiceError(
        response.status === 401 || response.status === 403
          ? response.status
          : 503,
        'AGENT_SOURCE_UNAVAILABLE',
      );
    }
    const rows = await boundedAgentJson(response);
    if (!Array.isArray(rows) || rows.length > 500)
      throw new ServiceError(502, 'INVALID_AGENT_CATALOG');
    return rows
      .filter(
        (row) =>
          row?.producerStatus === 'READY' &&
          (!allowedModules ||
            allowedModules.has(String(row.approvedView ?? '').split('.')[0])),
      )
      .map((row) => {
        if (
          typeof row.code !== 'string' ||
          !/^\w{1,100}$/.test(row.code) ||
          typeof row.title !== 'string' ||
          row.title.length > 500 ||
          typeof row.grain !== 'string' ||
          row.grain.length > 100 ||
          !Number.isSafeInteger(row.version)
        )
          throw new ServiceError(502, 'INVALID_AGENT_CATALOG');
        return {
          code: row.code,
          title: row.title,
          grain: row.grain,
          version: row.version,
          approvedView: row.approvedView,
        };
      });
  }
  function remember(row) {
    const signature = JSON.stringify(row);
    if (exposed.has(row.code) && exposed.get(row.code) !== signature)
      throw new ServiceError(403, 'AGENT_CONTEXT_CHANGED');
    exposed.set(row.code, signature);
    return { id: 'report:' + row.code, description: row.title };
  }
  return {
    async search(query, limit) {
      if (limit <= 0) return [];
      return reportMatches(query, await read())
        .slice(0, limit)
        .map(remember);
    },
    async describe(id) {
      const row = (await read()).find((item) => 'report:' + item.code === id);
      if (!row) throw new ServiceError(403, 'SOURCE_NOT_ALLOWED');
      const local = localDefinition(row);
      return {
        ...remember(row),
        ...(local
          ? {
              dateBasis: local.dateBasis,
              dimensions: local.dimensions,
              measures: local.measures,
              filters: local.filters,
            }
          : {}),
        grain: row.grain,
        version: row.version,
        access:
          'Native Reports panel only; never a SQL table or numerical evidence.',
      };
    },
    async revalidate() {
      if (!exposed.size) return;
      const current = new Map(
        (await read()).map((row) => [row.code, JSON.stringify(row)]),
      );
      if ([...exposed].some(([id, signature]) => current.get(id) !== signature))
        throw new ServiceError(403, 'AGENT_CONTEXT_CHANGED');
    },
  };
}
