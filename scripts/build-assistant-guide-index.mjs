import { readFileSync, writeFileSync } from 'node:fs';
import { navigationGroups } from '../apps/web/src/lib/navigation-groups.ts';

export function validateGuideLinks(domain, id, related, section) {
  const visibleLinks = [
    ...section.matchAll(
      /^- \[[^\]]+\]\((?:([a-z][a-z0-9-]*)\.md)?#([a-z][a-z0-9-]*)\)$/gm,
    ),
  ].map(([, target, anchor]) => (target ?? domain) + '/' + anchor);
  if (JSON.stringify(related) !== JSON.stringify(visibleLinks))
    throw new Error(
      'Markdown guide links do not match their references: ' +
        domain +
        '/' +
        id,
    );
}

function sidebarGroup(href) {
  const path = href.split(/[?#]/)[0];
  const canonical = path === '/hr' ? '/human-resources' : path;
  return navigationGroups.find((group) =>
    group.hrefs.some(
      (route) => canonical === route || canonical.startsWith(route + '/'),
    ),
  );
}

export function buildGuideIndex(catalogues, check) {
  const groups = new Map(navigationGroups.map(({ id }) => [id, []]));
  const sections = new Map();
  for (const [domain, catalogue] of Object.entries(catalogues)) {
    const group = sidebarGroup(catalogue.topics[0].href);
    if (!group) throw new Error('Missing sidebar group: ' + domain);
    groups.get(group.id).push({ domain, ...catalogue });
    for (const section of catalogue.topics)
      sections.set(domain + '/' + section.id, section);
  }

  const lines = [
    '# نمایهٔ راهنماهای نورا',
    '',
    'گروه سایدبار، پنل و سپس کار موردنظر را پیدا کنید. پیوند روبه‌روی هر موضوع به بخش مرتبط همان گردش می‌رسد.',
    '',
  ];
  const link = (ref) => {
    const [domain, anchor] = ref.split('/');
    const section = sections.get(ref);
    if (!section) throw new Error('Missing guide destination: ' + ref);
    return '[' + section.title + '](guides/' + domain + '.md#' + anchor + ')';
  };
  for (const group of navigationGroups) {
    lines.push('## ' + group.title, '');
    for (const { domain, title, topics } of groups
      .get(group.id)
      .sort((a, b) => a.domain.localeCompare(b.domain, 'en'))) {
      lines.push('### [' + title + '](guides/' + domain + '.md)', '');
      for (const topic of topics) {
        const ref = domain + '/' + topic.id;
        if (topic.related.includes(ref))
          throw new Error('Self reference: ' + ref);
        const roles = {
          next: 'مرحلهٔ بعد',
          prerequisite: 'پیش‌نیاز',
          status: 'پیگیری نتیجه',
        };
        for (const [role, target] of Object.entries(topic.workflow ?? {})) {
          if (!Object.hasOwn(roles, role) || !topic.related.includes(target))
            throw new Error('Invalid workflow destination: ' + ref);
        }
        const relatedLink = (target) => {
          const role = Object.entries(topic.workflow ?? {}).find(
            ([, dest]) => dest === target,
          )?.[0];
          return (role ? roles[role] + ' ' : '') + link(target);
        };
        lines.push(
          '- ' +
            link(ref) +
            (topic.related.length
              ? ' ← ' + topic.related.map(relatedLink).join('، ')
              : ''),
        );
      }
      lines.push('');
    }
  }
  const target = new URL('../docs/assistant/INDEX.md', import.meta.url);
  const text = lines.join('\n');
  if (!check) writeFileSync(target, text);
  else if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text)
    throw new Error('Stale assistant guide index');
}
