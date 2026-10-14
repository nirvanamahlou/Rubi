import { describe, expect, it } from 'vitest';
import {
  aggregateInternalReport,
  ageInternalLines,
  reportAxes,
  type InternalReportLine,
} from './accounting.report-engine';
const line = (
  id: string,
  date: string,
  debit: string,
  credit: string,
  currency: string | null = null,
): InternalReportLine => ({
  id,
  documentDate: date,
  journalId: id,
  accountId: 'a',
  accountCode: '1101',
  accountTitle: 'Synthetic',
  detail4Id: 'd',
  detail5Id: null,
  detail6Id: null,
  debit,
  credit,
  currency,
  foreignAmount: currency ? (debit === '0' ? credit : debit) : null,
});
describe('I09–I14 internal report engine', () => {
  it('preserves opening, base totals, source grain and separate foreign currencies', () => {
    const result = aggregateInternalReport(
      [
        line('1', '2026-01-01', '11', '0', 'USD'),
        line('2', '2026-02-01', '9007199254740993', '0', 'EUR'),
        line('3', '2026-02-02', '0', '3', 'USD'),
      ],
      ['account'],
      '2026-02-01',
    );
    expect(result.debit).toBe('9007199254740993');
    expect(result.credit).toBe('3');
    expect(result.rows[0]).toMatchObject({
      opening: '11',
      balance: '9007199254741001',
      foreignBalances: { USD: '8', EUR: '9007199254740993' },
      sourceLineIds: ['1', '2', '3'],
    });
    expect(aggregateInternalReport([], ['account'], '2026-01-01').rows).toEqual(
      [],
    );
  });
  it('FIFO consumes oldest charges and keeps unknown opening age explicit', () => {
    const rows = [
      { ...line('opening', '2026-01-01', '100', '0'), opening: true },
      line('charge', '2026-02-01', '50', '0'),
      line('payment', '2026-02-10', '0', '25'),
    ];
    const result = ageInternalLines(rows, '2026-03-01')[0]!;
    expect(result.balance).toBe('125');
    expect(result.buckets).toEqual(['50', '0', '0', '0', '0']);
    expect(result.unknownAge).toBe('75');
    expect(result.sources.find((s) => s.lineId === 'opening')?.days).toBeNull();
    expect(
      ageInternalLines(
        [
          line('a', '2026-01-01', '100', '0'),
          line('b', '2026-02-01', '0', '100'),
        ],
        '2026-03-01',
      ),
    ).toEqual([]);
  });
  it('rejects duplicate/unknown axes and future aging lines', () => {
    expect(() => reportAxes('account,account')).toThrow();
    expect(() => reportAxes('password')).toThrow();
    expect(() =>
      ageInternalLines([line('future', '2027-01-01', '1', '0')], '2026-01-01'),
    ).toThrow();
  });
});
