import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const outputs = {
  correspondence: [
    'correspondence-guide.generated',
    '/correspondence',
    'documents',
  ],
  b2b: ['b2b-guide-catalog', '/organizations', 'text'],
  tour: ['tour-guide', '/sales/tours', 'tuple'],
  'flight-pricing': ['flight-pricing-catalog', '/sales/ticket-prices', 'text'],
  'reservation-report': [
    'reservation-report-guide',
    '/reservations/reports',
    'tuple',
  ],
  'finance-delivery': ['finance-delivery-guide', '/finance/delivery', 'tuple'],
  'master-data': ['master-data-guide-catalog', '/master-data', 'master'],
  purchase: ['purchase-guide.generated', '/ticket-purchases', 'purchase'],
  documents: ['document-guide.generated', '/documents', 'documents'],
};

const outputDirectory = new URL(
  '../apps/web/src/modules/assistant/',
  import.meta.url,
);
export const linkedPanelDomains = Object.keys(outputs);

function publish(file, data, check) {
  const target = new URL(file + '.json', outputDirectory);
  if (check) {
    if (!isDeepStrictEqual(data, JSON.parse(readFileSync(target, 'utf8'))))
      throw new Error('Stale linked panel guide: ' + file);
    return;
  }
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}

export function buildLinkedPanelGuides(directory, check) {
  const panels = {};
  const products = new Map();
  for (const [domain, [output, action, format]] of Object.entries(outputs)) {
    const raw = readFileSync(
      new URL(domain + '.md', directory),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const [intro, ...sections] = raw.split(/^<a id="/m);
    const header = /^# (.+)\n\s*<!-- nora-catalogue (.+) -->\s*$/.exec(intro);
    if (!header || !sections.length)
      throw new Error('Invalid linked panel document: ' + domain);
    const copy = JSON.parse(header[2]);
    const topics = [];
    const index = new Map();

    for (const section of sections) {
      const parts =
        /^([a-z][a-z0-9-]*)"><\/a>\s+## (.+)\n\s*<!-- nora-guide (.+) -->\s+### مراحل\n\s*([\s\S]*?)(?=\n### |$)/.exec(
          section.trim(),
        );
      if (!parts) throw new Error('Invalid section in ' + domain);
      const [, id, title, metadata, body] = parts;
      const { id: metadataId, href, related, ...fields } = JSON.parse(metadata);
      const validAction =
        href === action ||
        (domain === 'correspondence' &&
          [
            '/correspondence/incoming',
            '/correspondence/outgoing',
            '/correspondence/internal/send',
            '/correspondence/internal/received',
          ].includes(href)) ||
        (domain === 'tour' &&
          [
            '/integrations',
            '/reservations/hotel-rates',
            '/sales/pricing',
          ].includes(href)) ||
        (domain === 'flight-pricing' &&
          href === '/sales/ticket-prices#round-trip-price-editor') ||
        (domain === 'master-data' &&
          /^\/master-data(?:\/[a-z-]+){1,2}$/.test(href));
      const steps = body
        .trim()
        .split('\n')
        .map((line, i) => {
          const prefix = i + 1 + '. ';
          if (!line.startsWith(prefix) || !line.slice(prefix.length).trim())
            throw new Error('Invalid step: ' + domain + '/' + id);
          return line.slice(prefix.length);
        });
      if (
        !validAction ||
        id !== metadataId ||
        index.has(id) ||
        !Array.isArray(related)
      )
        throw new Error(
          'Invalid or duplicate linked topic: ' + domain + '/' + id,
        );
      const visibleLinks = [
        ...section.matchAll(
          /^- \[[^\]]+\]\((?:([a-z-]+)\.md)?#([a-z][a-z0-9-]*)\)$/gm,
        ),
      ].map(([, target, anchor]) => (target ?? domain) + '/' + anchor);
      if (JSON.stringify(related) !== JSON.stringify(visibleLinks))
        throw new Error(
          'Markdown guide links do not match their references: ' +
            domain +
            '/' +
            id,
        );
      if ('pattern' in fields) new RegExp(fields.pattern, fields.flags);
      index.set(id, {
        id,
        title,
        href,
        related,
        steps,
        guideHref: '/assistant-guides/' + domain + '#' + id,
      });
      topics.push({ id, title, href, steps, fields });
    }

    panels[domain] = { title: header[1], topics: [...index.values()] };
    const textTopics = () =>
      topics.map(({ id, title, steps, fields }) => ({
        id,
        title,
        ...fields,
        text: steps.join(' '),
      }));
    if (format === 'text')
      products.set(output, { ...copy, topics: textTopics() });
    if (format === 'purchase') products.set(output, textTopics());
    if (format === 'documents') {
      products.set(
        output,
        topics.map(({ id, title, href, steps, fields }) => ({
          id,
          title,
          steps,
          ...(domain === 'correspondence' ? { href } : {}),
          ...fields,
        })),
      );
    }
    if (format === 'tuple') {
      products.set(output, {
        ...copy,
        topics: Object.fromEntries(
          topics.map(({ id, title, steps }) => [id, [title, ...steps]]),
        ),
      });
    }
    if (format === 'master') {
      products.set(output, {
        ...copy,
        topics: Object.fromEntries(
          topics
            .filter(({ fields }) => !fields.special)
            .map(({ id, steps, fields }) => [
              id,
              [fields.pattern, steps.join(' ')],
            ]),
        ),
        special: topics
          .filter(({ fields }) => fields.special)
          .map(
            ({
              id,
              title,
              steps,
              href,
              fields: { special: _special, ...fields },
            }) => ({
              id,
              ...fields,
              title,
              href,
              text: steps.join(' '),
            }),
          ),
      });
    }
  }
  for (const [domain, { topics }] of Object.entries(panels)) {
    for (const topic of topics) {
      for (const ref of topic.related) {
        if (typeof ref !== 'string')
          throw new Error('Invalid guide relation: ' + domain);
        const [target, id] = ref.split('/');
        if (
          ref === domain + '/' + topic.id ||
          !panels[target]?.topics.some((item) => item.id === id)
        )
          throw new Error(
            'Invalid guide relation: ' + domain + '/' + topic.id + ' -> ' + ref,
          );
      }
    }
  }
  for (const [output, data] of products) publish(output, data, check);
  publish('linked-panel-guides.generated', panels, check);
}
