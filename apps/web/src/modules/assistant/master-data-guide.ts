import type { MasterDataResource } from '@nora/contracts';
import { MasterDataApiError, masterDataApi } from '../master-data/api/client';
import { getMasterDataDefinition } from '../master-data/model/catalog';
import { masterDataSections } from '../master-data/model/sections';
import copy from './master-data-guide-catalog.json';
import { normalizeQuestion } from './question-text';

export const masterDataGuideLink = { href: '/master-data', label: copy.label };
type Resource = keyof typeof copy.topics;
export const masterDataGuideTopics = masterDataSections.flatMap((section) =>
  section.resources.map((resource) => {
    const [aliases, text] = copy.topics[resource as Resource] ?? [];
    return {
      id: resource,
      section: section.slug,
      title: getMasterDataDefinition(resource).label,
      aliases: (aliases ?? '').split('|').filter(Boolean),
      text: text ?? '',
      href: '/master-data/' + section.slug,
    };
  }),
);
const special = copy.special.map(({ pattern, ...item }) => ({
  ...item,
  aliases: pattern.split('|'),
}));
const allTopics = [...masterDataGuideTopics, ...special];
type Topic = (typeof allTopics)[number];

export function resolveMasterDataQuestion(
  message: string,
  pathname: string,
  previous?: string,
) {
  const text = normalizeQuestion(message);
  const current = masterDataSections.find((section) =>
    pathname.startsWith('/master-data/' + section.slug),
  );
  const isPanel = pathname === '/master-data' || !!current;
  const prior = allTopics.find((topic) => topic.id === previous);
  if (prior && /^(بعدش|بعدش چی|مرحله بعد|بیشتر توضیح بده)$/.test(text))
    return { kind: 'guide' as const, topics: [prior], href: prior.href };
  if (
    /نرخ این قرارداد|مبلغ قرارداد|قیمت قرارداد|خرید هتل|خرید صندلی|تسویه قرارداد|پرونده ویزا.*وضعیت/.test(
      text,
    )
  )
    return;
  const candidates = allTopics
    .flatMap((topic) => {
      const terms = [topic.title, ...topic.aliases].map(normalizeQuestion);
      const weight = Math.max(
        0,
        ...terms
          .filter((term) => term && text.includes(term))
          .map((term) => term.length),
      );
      return weight ? [{ topic, weight }] : [];
    })
    .sort((a, b) => b.weight - a.weight);
  const winner = candidates[0]?.topic;
  const explicit =
    /اطلاعات پایه/.test(text) ||
    (!!winner && /مرجع|تعریف|کد دقیق|هتل.*در.*قرارداد.*نمی/.test(text));
  const distinctive = candidates[0] && candidates[0].weight >= 7;
  if (
    !isPanel &&
    !explicit &&
    (!distinctive ||
      !/چطور|چجور|چگونه|کجا|راهنما|چرا|تایید شد|وضعیت|فعاله|فعال است/.test(
        text,
      ) ||
      /تعداد|چند|مجموع|فروش امروز/.test(text))
  )
    return;
  const contextual = current
    ? masterDataGuideTopics.filter((topic) => topic.section === current.slug)
    : [];
  const topic = winner ?? (contextual.length === 1 ? contextual[0] : undefined);
  const isRead =
    /وضعیت|فعاله|فعال است|غیرفعاله|تایید شد|تأیید شد/.test(text) &&
    !/چطور|چجور|چگونه|از کجا|کجا|چرا|معنی|راهنما|تعریف/.test(text);
  if (isRead && (topic || explicit || isPanel)) {
    const rawCode =
      /(?:^|\s)کد\s+(?:دقیق\s+)?([a-z0-9۰-۹٠-٩][a-z0-9۰-۹٠-٩._/-]{0,79})(?=[\s؟?،]|$)/i.exec(
        message.normalize('NFKC'),
      )?.[1];
    const code = rawCode && normalizeReferenceCode(rawCode);
    return {
      kind: 'read' as const,
      topic,
      code,
      href: topic?.href ?? masterDataGuideLink.href,
    };
  }
  if (topic) {
    const fileTopic = /اکسل|excel|خروجی|ورود فایل|pdf/.test(text)
      ? special.find(({ id }) => id === 'files')
      : undefined;
    const href = topic.section
      ? topic.href
      : current
        ? '/master-data/' + current.slug
        : masterDataGuideLink.href;
    return {
      kind: 'guide' as const,
      topics:
        fileTopic && fileTopic.id !== topic.id ? [topic, fileTopic] : [topic],
      href,
    };
  }
  if (isPanel || explicit) {
    return {
      kind: 'guide' as const,
      topics: contextual,
      href: current ? '/master-data/' + current.slug : masterDataGuideLink.href,
    };
  }
}

export function renderMasterDataGuide(topics: readonly Topic[]) {
  if (!topics.length)
    return [
      copy.label,
      ...masterDataSections.map(({ title }) => title),
      copy.choose,
    ].join('\n');
  return [
    ...topics.map(({ title, text }) =>
      [copy.label + ' ← ' + title, text].join('\n'),
    ),
    copy.common,
  ].join('\n\n');
}

type ReadIntent = Extract<
  ReturnType<typeof resolveMasterDataQuestion>,
  { kind: 'read' }
>;
function normalizeReferenceCode(code: string) {
  return code
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export async function readMasterDataGuide(
  intent: ReadIntent,
  signal: AbortSignal,
  canRead: (resource: MasterDataResource) => boolean,
) {
  const topic = masterDataGuideTopics.find(({ id }) => id === intent.topic?.id);
  if (
    intent.topic &&
    (!topic ||
      topic.id === 'exchange-rates' ||
      topic.id === 'organization-contacts')
  )
    return copy.protected;
  if (!topic || !intent.code) return copy.choose;
  if (!canRead(topic.id)) return copy.denied;
  try {
    const result = await masterDataApi.list(
      topic.id,
      {
        search: intent.code,
        status: 'all',
        sortBy: 'code',
        sortDirection: 'asc',
        page: 1,
        pageSize: 10,
      },
      undefined,
      signal,
    );
    if (result.meta.total > result.data.length) return copy.ambiguous;
    const matches = result.data.filter(
      (row) =>
        row.resource === topic.id &&
        normalizeReferenceCode(row.code) === intent.code,
    );
    if (matches.length !== 1)
      return matches.length ? copy.ambiguous : copy.missing;
    const [record] = matches;
    if (!record) return copy.missing;
    return [record.name, record.code, copy[record.status]].join(' · ');
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof MasterDataApiError) {
      if (error.status === 401) return copy.login;
      if (error.status === 403) return copy.denied;
    }
    return copy.failed;
  }
}
