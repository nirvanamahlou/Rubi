import { describe, expect, it } from 'vitest';
import {
  journalBrowserRows,
  type JournalBrowserObservation,
} from './accounting-journal-browser';

const row = (
  change: Partial<JournalBrowserObservation> = {},
): JournalBrowserObservation => ({
  id: 'journal-a',
  actorId: 'user-a',
  kind: 'issued',
  typeId: 'type-a',
  status: 'POSTED',
  documentDate: '2026-03-20',
  lineCount: 4,
  historicalGap: false,
  ...change,
});
describe('journal browser history statistics', () => {
  it('counts distinct journals per group and preserves each participating user', () => {
    const observations = [
      row(),
      row({ kind: 'changed' }),
      row({ kind: 'changed' }),
      row({ kind: 'changed', actorId: 'user-b' }),
      row({ kind: 'reviewed', actorId: 'user-b' }),
      row({ kind: 'reviewed', actorId: 'user-b' }),
    ];
    const byType = journalBrowserRows(observations, 'type');
    expect(byType).toHaveLength(1);
    expect(byType[0]).toMatchObject({
      issued: 1,
      issuedLines: 4,
      changed: 1,
      changedLines: 4,
      reviewed: 1,
    });
    expect([...byType[0]!.journalIds]).toEqual(['journal-a']);
    const byUser = journalBrowserRows(observations, 'user');
    expect(
      byUser.map(({ key, issued, changed, reviewed }) => ({
        key,
        issued,
        changed,
        reviewed,
      })),
    ).toEqual([
      { key: 'user-a', issued: 1, changed: 1, reviewed: 0 },
      { key: 'user-b', issued: 0, changed: 1, reviewed: 1 },
    ]);
  });
  it('uses Persian month boundaries across Nowruz and keeps undated records separate', () => {
    expect(
      journalBrowserRows(
        [
          row(),
          row({ id: 'next', documentDate: '2026-03-21' }),
          row({ id: 'undated', documentDate: null }),
        ],
        'monthly',
        'PERSIAN',
      ).map(({ key, issued }) => ({ key, issued })),
    ).toEqual([
      { key: '', issued: 1 },
      { key: '1404-12', issued: 1 },
      { key: '1405-01', issued: 1 },
    ]);
  });
  it('does not turn an incomplete history into an assertion of complete zero changes', () => {
    expect(
      journalBrowserRows([row({ historicalGap: true })], 'status')[0],
    ).toMatchObject({ historicalGap: true, changed: 0 });
  });
});
