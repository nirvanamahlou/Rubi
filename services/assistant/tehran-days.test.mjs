import test from 'node:test';
import assert from 'node:assert/strict';
import { tehranDayContext, bindTehranDays } from './tehran-days.mjs';
test('Tehran midnight advances the civil day before UTC midnight', () => {
  const before = tehranDayContext(new Date('2026-11-18T20:29:59.999Z'));
  const after = tehranDayContext(new Date('2026-11-18T20:30:00Z'));
  assert.equal(before.today.start, '2026-11-17T20:30:00.000Z');
  assert.equal(after.today.start, '2026-11-18T20:30:00.000Z');
  assert.equal(after.yesterday.end, after.today.start);
  const rows = [
    '2026-11-18T20:29:59.999Z',
    '2026-11-18T20:30:00Z',
    '2026-11-19T00:00:00Z',
  ];
  assert.equal(
    rows.filter((t) => Date.parse(t) >= Date.parse(after.today.start)).length,
    2,
  );
  assert.equal(
    rows.filter((t) => Date.parse(t) >= Date.parse('2026-11-19T00:00:00Z'))
      .length,
    1,
  );
  assert.equal(
    bindTehranDays("'NORA_TODAY_START'", after),
    "'2026-11-18T20:30:00.000Z'",
  );
});

import { enforceRelativeDayQuery } from './tehran-days.mjs';
test('relative queries reject arbitrary SQL and UTC bypasses before execution', () => {
  const c = tehranDayContext(new Date('2026-11-19T08:00:00Z'));
  const sql =
    "SELECT count(*) AS total FROM contracts WHERE created_at >= 'NORA_TODAY_START' AND created_at < 'NORA_TODAY_END'";
  assert.match(
    enforceRelativeDayQuery(sql, c, 'امروز'),
    /2026-11-18T20:30:00.000Z/,
  );
  assert.match(
    enforceRelativeDayQuery(sql, c, 'امروز'),
    /2026-11-19T08:00:00.000Z/,
  );
  for (const bad of [
    sql + ' OR 1=1',
    sql + ' UNION SELECT 1',
    sql.replace('NORA_TODAY_START', '2026-11-19T00:00:00Z'),
    'SELECT count(*) AS total FROM contracts',
    sql.replace('NORA_TODAY_END', 'NORA_YESTERDAY_END'),
  ]) {
    assert.throws(
      () => enforceRelativeDayQuery(bad, c, 'امروز'),
      /TEHRAN_DAY_QUERY_REQUIRED/,
    );
  }
});
