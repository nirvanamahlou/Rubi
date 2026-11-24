import { readFileSync } from 'node:fs';
import { reportMatches } from '../../../services/assistant/report-catalog.mjs';
import assert from 'node:assert/strict';
import { AGENT_SOURCES } from '../../../apps/api/src/sales/assistant-agent/catalog.ts';
import { findSources } from '../../../services/assistant/source-discovery.mjs';

const cases = [
  ['تعداد قراردادها', 'contracts'],
  ['نام مشتری قرارداد', 'contracts'],
  ['customer name', 'contracts'],
  ['مبلغ پس از تخفیف به تفکیک ارز', 'amounts'],
  ['contract discount', 'amounts', 'contracts'],
  ['تعداد كودكان و نوزادان مسافر', 'passengers'],
  ['بیمه و ترانسفر هر مسافر', 'services', 'passengers'],
  ['وضعیت اقساط پرداختی', 'payments'],
  ['مبلغ پرداختی هر قرارداد', 'payments', 'amounts', 'contracts'],
  ['منبع نامشخص'],
];
const native = Object.entries(AGENT_SOURCES).map(([id, definition]) => ({
  id,
  ...definition,
}));
let before = 0;
let after = 0;
for (const authorized of [native, native.filter((s) => s.id !== 'payments')]) {
  for (const [question, ...wanted] of cases) {
    const allowed = new Set(authorized.map((s) => s.id));
    const selected = findSources(question, authorized);
    assert.deepEqual(
      new Set(selected.map((s) => s.id)),
      new Set(wanted.filter((id) => allowed.has(id))),
      question,
    );
    before += Buffer.byteLength(JSON.stringify(authorized));
    after += Buffer.byteLength(JSON.stringify(selected));
  }
}
// Use the registered display definitions as a synthetic response from the native ACL catalog.
const reports = readFileSync(
  new URL('../../../docs/assistant/data-atlas/index.jsonl', import.meta.url),
  'utf8',
)
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line))
  .filter((row) => row.kind === 'report' && row.availability === 'READY');
const operationalCases = [
  ['خرید از تأمین‌کننده', 'purchase_by_supplier'],
  ['صندلی باقی مانده پرواز', 'ticket_capacity'],
  ['نرخ پایه هتل', 'hotel_rate_comparison'],
  ['اولین صدور مدرک چند دقیقه', 'reservation_cycle_time'],
  ['اسناد منقضی در انتظار پردازش', 'document_compliance'],
  ['پیگیری تقویم از موعد گذشته', 'workbench_due_actions'],
  ['مهلت رسیدگی در هر واحد', 'customer_service_sla'],
  ['رشد مشتریان فعال', 'customer_portfolio_growth'],
  ['بیشترین سفارش و مسافر مقصد', 'route_passengers'],
  ['دریافت تأییدشده و استرداد', 'payments_refunds'],
];
for (const [query, id] of [
  ...reports.map((row) => [row.title, row.code]),
  ...operationalCases,
]) {
  const found = reportMatches(query, reports);
  assert.ok(
    found.some((item) => item.code === id),
    query,
  );
  assert.ok(found.length <= 3);
  assert.ok(
    !reportMatches(
      query,
      reports.filter((row) => row.code !== id),
    ).some((item) => item.code === id),
  );
}
console.log(
  JSON.stringify({
    cases: cases.length * 2,
    reportCases: reports.length + operationalCases.length,
    fullDefinitionBytes: before,
    selectedDefinitionBytes: after,
    reductionPercent: Math.round(100 * (1 - after / before)),
  }),
);
