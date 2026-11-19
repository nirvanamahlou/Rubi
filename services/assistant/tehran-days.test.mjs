import test from 'node:test';
import assert from 'node:assert/strict';
import { tehranDayContext, bindTehranDays } from './tehran-days.mjs';
test('Tehran midnight advances the civil day before UTC midnight', () => {
 const before = tehranDayContext(new Date('2026-11-18T20:29:59.999Z'));
 const after = tehranDayContext(new Date('2026-11-18T20:30:00Z'));
 assert.equal(before.today.start, '2026-11-17T20:30:00.000Z');
 assert.equal(after.today.start, '2026-11-18T20:30:00.000Z');
 assert.equal(after.yesterday.end, after.today.start);
 const rows = ['2026-11-18T20:29:59.999Z','2026-11-18T20:30:00Z','2026-11-19T00:00:00Z'];
 assert.equal(rows.filter(t => Date.parse(t)>=Date.parse(after.today.start)).length,2);
 assert.equal(rows.filter(t => Date.parse(t)>=Date.parse('2026-11-19T00:00:00Z')).length,1);
 assert.equal(bindTehranDays("'NORA_TODAY_START'",after),"'2026-11-18T20:30:00.000Z'");
});
