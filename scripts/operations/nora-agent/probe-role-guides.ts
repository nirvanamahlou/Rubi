import { canOpenAssistantGuide } from '../../../apps/web/src/modules/assistant/guide-access';
import { readFileSync } from 'node:fs';
import {
  IAM_PERMISSION_CODES,
  USER_ACCESS_GROUPS,
  USER_ACCESS_SCREENS,
} from '../../../packages/contracts/src';
import {
  assistantGuideCatalogues,
  type AssistantGuideModule,
  type GuideSection,
} from '../../../apps/web/src/modules/assistant/assistant-guide-registry';
import { REPORTING_PERMISSION_MATRIX } from '../../../apps/web/src/modules/reports/model/reporting';
import { pilotGuideResponse } from '../../../apps/web/src/modules/assistant/guide-pilot';
import {
  resolveDocumentedWorkflow,
  retrieveDocumentSections,
} from '../../../apps/web/src/modules/assistant/catalogue-search';

// Synthetic roles exercise access-sensitive selection. Job titles in ERP are never grants.
const groups: Record<string, string[]> = {
  'مدیر فروش': ['sales', 'ticket-catalog', 'customers', 'correspondence'],
  'کارشناس فروش': ['sales', 'customers', 'correspondence'],
  'کارشناس رزرواسیون': [
    'reservations',
    'reservation-reports',
    'ticket-catalog',
    'sales',
  ],
  'مدیر رزرواسیون': [
    'reservations',
    'reservation-reports',
    'ticket-catalog',
    'sales',
  ],
  'کارشناس مالی': [
    'finance',
    'procurement',
    'dashboard',
    'reports',
    'documents',
  ],
  'مدیر مالی': [
    'finance',
    'procurement',
    'dashboard',
    'reports',
    'documents',
  ],
  'کارشناس ارشد ویزا': ['customer-affairs'],
  'مدیر منابع انسانی': ['hr', 'correspondence'],
  'کارشناس هوش مصنوعی': USER_ACCESS_GROUPS.map((g) => g.id),
  'مدیر ارشد مدیریت': USER_ACCESS_GROUPS.map((g) => g.id),
  'مدیر واحد ثبت‌نشده': ['customer-affairs', 'dashboard', 'reports'],
};
function rights(role: string) {
  const included = ['assistant', 'workbench', ...(groups[role] ?? [])];
  const codes = USER_ACCESS_GROUPS.filter((g) =>
    included.includes(g.id),
  ).flatMap((g) => [...g.prefixes]);
  return [
    'ui.manual.v3',
    ...[...IAM_PERMISSION_CODES, ...REPORTING_PERMISSION_MATRIX].filter((p) =>
      codes.some((prefix) => p === prefix || p.startsWith(prefix + '.')),
    ),
    ...USER_ACCESS_SCREENS.filter((s) => included.includes(s.group)).map(
      (s) => 'ui.screen.' + s.id,
    ),
  ];
}
const cases: {
  id: string;
  role: string;
  question: string;
  expectedGuides: string[];
}[] = readFileSync('docs/assistant/role-guide-acceptance.jsonl', 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const full = [
  ...IAM_PERMISSION_CODES.filter(
    (p) => !p.startsWith('ui.deny.') && String(p) !== 'ui.manual.v3',
  ),
  ...REPORTING_PERMISSION_MATRIX,
  'ui.administrator',
  ...USER_ACCESS_SCREENS.map((s) => 'ui.screen.' + s.id),
];
for (const mode of ['admin', 'employee']) {
  let matches = 0,
    outOfScope = 0,
    exposed = 0;
  const missed = [];
  const byModule = new Map<string, { cases: number; matches: number }>();
  for (const entry of cases) {
    const permissions = mode === 'admin' ? full : rights(entry.role);
    const mayOpen = (href: string, permission?: string) =>
      canOpenAssistantGuide(permissions, href, permission);
    const canRead = (s: GuideSection) => mayOpen(s.href, s.permission);
    const expected = entry.expectedGuides.map((ref) => {
      const [d, id] = ref.split('/');
      return assistantGuideCatalogues[d as AssistantGuideModule]?.topics.find(
        (x) => x.id === id,
      );
    });
    const fullScope = expected.every((s) => s && canRead(s));
    const workflow = resolveDocumentedWorkflow(entry.question);
    const multi = retrieveDocumentSections(
      entry.question,
      '/assistant',
      canRead,
    );
    const result = multi.length
      ? multi
      : workflow.length
        ? workflow.filter(canRead)
        : pilotGuideResponse(entry.question, '/assistant', undefined, mayOpen)
            .sections;
    const ids = result.map((s) =>
      s.guideHref.replace('/assistant-guides/', '').replace('#', '/'),
    );
    if (result.some((s) => !canRead(s))) exposed++;
    if (!fullScope) {
      outOfScope++;
      continue;
    }
    const matched = entry.expectedGuides.every((ref) => ids.includes(ref));
    for (const module of new Set(
      entry.expectedGuides.map((ref) => ref.split('/')[0]!),
    )) {
      const bucket = byModule.get(module) ?? { cases: 0, matches: 0 };
      bucket.cases++;
      if (matched) bucket.matches++;
      byModule.set(module, bucket);
    }
    if (matched) matches++;
    else
      missed.push({
        id: entry.id,
        question: entry.question,
        expected: entry.expectedGuides,
        got: ids,
      });
  }
  console.log(
    JSON.stringify({
      mode,
      total: cases.length,
      expectedAccessible: cases.length - outOfScope,
      matches,
      misses: missed.length,
      outOfScope,
      exposed,
      byModule: Object.fromEntries(byModule),
    }),
  );
  if (
    exposed ||
    (mode === 'admin' &&
      [...byModule.values()].some(
        (group) => group.matches / group.cases < 0.95,
      ))
  )
    process.exitCode = 1;
  if (process.argv.includes('--details'))
    for (const miss of missed) console.log(JSON.stringify(miss));
}
