import { writeFileSync } from 'node:fs';
import { accountingParityDefinitions } from '../apps/web/src/modules/finance/components/accounting-parity-definitions';
import { accountingTaxForms } from '../packages/contracts/src/accounting-tax';
import { taxpayerPages } from '../apps/web/src/modules/finance/accounting-taxpayer-catalog';
import { accountingCompletionRoute } from '../apps/web/src/modules/finance/accounting-completion-routes';

// Repository structural metadata only. Never reads credentials or source records.
const prefixes = [
  'general-ledger/year-end/',
  'general-ledger/reports/',
  'taxpayer-system/',
  'tax-accounting/',
];
const fresh = new Set([
  'general-ledger/year-end/closing-templates',
  'general-ledger/year-end/closing',
  'general-ledger/year-end/nature-adjustment',
]);
const rows = new Map<string, Record<string, unknown>>();
for (const page of accountingParityDefinitions.filter((page) =>
  prefixes.some((prefix) => page.route.startsWith(prefix)),
)) {
  rows.set(page.route, {
    route: page.route,
    title: page.title,
    sourcePages: page.sourcePages,
    evidenceDate: fresh.has(page.route) ? '2026-10-12' : '2026-10-07',
    evidence: page.evidenceStatus,
    fields: page.fields.map((field) => ({
      label: field.label,
      type: field.type,
      disabled: field.disabled,
    })),
    columns: page.columns,
    actions: page.actions,
    blockers: page.blockers,
    legacyDeclaredSupport: page.support,
    legacyImplementation: page.implementation,
    preparedAdapter: accountingCompletionRoute(page.route) ?? null,
    integratedInThisCandidate: false,
  });
}
for (const page of taxpayerPages) {
  rows.set(page.route, {
    ...rows.get(page.route),
    route: page.route,
    title: page.title,
    evidenceDate: '2026-10-11',
    evidence: page.blocker ? 'source-blocker' : 'observed-layout',
    fields: page.fields.map((field) => ({
      label: field.label,
      type: field.type,
      disabled: !!field.disabled,
      sensitive: !!field.sensitive,
    })),
    columns: page.columns,
    blockers: page.blocker ? [page.blocker] : [],
    preparedAdapter: accountingCompletionRoute(page.route) ?? null,
    integratedInThisCandidate: false,
  });
}
for (const form of accountingTaxForms) {
  rows.set(form.route, {
    ...rows.get(form.route),
    route: form.route,
    title: form.title,
    evidenceDate: '2026-10-11',
    evidence: 'observed-layout',
    fields: form.fields.map((field) => ({
      label: field.label,
      type: field.kind,
      disabled: field.disabled,
      readOnly: field.readOnly,
    })),
    columns: form.listColumns,
    tables: form.tables,
    referenceWriteAdapter: form.writable,
    preparedAdapter: accountingCompletionRoute(form.route) ?? null,
    integratedInThisCandidate: false,
  });
}
const routes = [...rows.values()].sort((a, b) =>
  String(a.route).localeCompare(String(b.route)),
);
const output = {
  task: 'ACCOUNTING-YEAREND-TAX-AUDIT-1012',
  status: 'INDEPENDENT_CANDIDATE_NOT_INTEGRATED',
  source: 'https://zakeri.rahkaran.ir/',
  sourceVersion: '20/0 release 7',
  warning:
    'Only three year-end layouts/introduction states were freshly observed on October 12. Remaining evidence is inherited, not a completed fresh crawl. Legacy support labels are not a runtime acceptance claim.',
  sections: prefixes.map((prefix) => ({
    prefix,
    routes: routes.filter((row) => String(row.route).startsWith(prefix)).length,
  })),
  routes,
};
writeFileSync(
  'docs/tasks/ACCOUNTING-YEAREND-TAX-AUDIT-1012.json',
  JSON.stringify(output, null, 2) + '\n',
);
console.log(JSON.stringify(output.sections));
