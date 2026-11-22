import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import {
  buildLinkedPanelGuides,
  linkedPanelDomains,
} from './build-linked-panel-guides.mjs';

const directory = new URL('../docs/assistant/guides/', import.meta.url);
const outputs = {
  sales: '../apps/web/src/modules/assistant/contract-guide.generated.json',
  workbench: '../services/assistant/workbench-guides.json',
  b2c: '../apps/web/src/modules/assistant/customer-guide-catalog.json',
  'call-center': '../services/assistant/call-center-guides.json',
};
const workbenchTabs =
  /^(today|requests|messages|files|notes|stars|calendar|activity|performance|daily-packages|account)$/;
const catalogues = new Map();
const sections = new Map();

for (const file of readdirSync(directory).sort()) {
  if (!file.endsWith('.md')) continue;
  const domain = file.slice(0, -3);
  if (linkedPanelDomains.includes(domain)) continue;
  if (!Object.hasOwn(outputs, domain))
    throw new Error('Unknown guide: ' + file);
  const text = readFileSync(new URL(file, directory), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
  const topics = text
    .split(/^<a id="/m)
    .slice(1)
    .map((section) => {
      const match =
        /^([a-z][a-z0-9-]*)"><\/a>\s+## (.+)\n\s*<!-- nora-guide (.+) -->\s+### مراحل\n\s*([\s\S]*?)(?=\n### |$)/.exec(
          section.trim(),
        );
      if (!match) throw new Error('Invalid guide section in ' + file);
      const [, anchor, title, json, body] = match;
      const metadata = JSON.parse(json);
      const steps = body
        .trim()
        .split('\n')
        .map((line) => {
          const step = /^\d+\. (.+)$/.exec(line);
          if (!step) throw new Error('Invalid guide step: ' + anchor);
          return step[1];
        });
      const path = metadata.route ?? metadata.path;
      const validTextList = (list) =>
        Array.isArray(list) &&
        list.length > 0 &&
        list.every((value) => typeof value === 'string' && value.trim());
      const id = domain + '/' + anchor;
      const validHref =
        domain === 'sales'
          ? ['/sales', '/sales/contracts/new'].includes(metadata.href)
          : domain === 'b2c'
            ? metadata.href === '/customers'
            : domain === 'call-center'
              ? metadata.tab === 'call-center' &&
                /^\/customer-affairs\/call-center(?:#cc-follow-up-queue)?$/.test(
                  metadata.href,
                )
              : workbenchTabs.test(metadata.tab) &&
                metadata.href === '/workbench?tab=' + metadata.tab;
      if (
        metadata.id !== anchor ||
        sections.has(id) ||
        !validHref ||
        !title.trim() ||
        !validTextList(steps) ||
        !validTextList(path) ||
        !validTextList(metadata.conditions) ||
        !Array.isArray(metadata.related)
      )
        throw new Error('Invalid or duplicate guide: ' + id);
      if (domain === 'sales' || domain === 'b2c')
        new RegExp(metadata.pattern, metadata.flags);
      else if (!validTextList(metadata.aliases))
        throw new Error('Missing aliases: ' + id);

      const topic = {
        id: anchor,
        title,
        ...metadata,
        steps,
        guideHref: '/assistant-guides/' + domain + '#' + anchor,
      };
      sections.set(id, topic);
      return topic;
    });
  if (!topics.length) throw new Error('Empty guide: ' + file);
  catalogues.set(domain, topics);
}

for (const [id, section] of sections) {
  for (const ref of section.related) {
    if (ref === id || !sections.has(ref))
      throw new Error('Invalid guide relation: ' + id + ' -> ' + ref);
  }
}

for (const [domain, output] of Object.entries(outputs)) {
  const topics = catalogues.get(domain);
  if (!topics) throw new Error('Missing guide: ' + domain);
  const target = new URL(output, import.meta.url);
  const data =
    domain === 'b2c'
      ? topics.map((topic) => ({ ...topic, text: topic.steps.join(' ') }))
      : { version: 1, topics };
  if (process.argv.includes('--check')) {
    if (
      JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !==
      JSON.stringify(data)
    ) {
      throw new Error('Stale guide catalogue: ' + output);
    }
  } else {
    writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  }
}

buildLinkedPanelGuides(directory, process.argv.includes('--check'));
