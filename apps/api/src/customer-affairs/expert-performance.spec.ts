import { describe, it, expect } from 'vitest';
import { expertPerformance, type ExpertCallFact } from './expert-performance';
const at = '2026-11-02T10:00:00.000Z';
const call: ExpertCallFact = {
  id: 'c',
  contactId: 'p',
  knownPhone: true,
  at,
  direction: 'OUTBOUND',
  connected: false,
  complete: false,
  actors: ['a', 'a'],
  extension: '001',
};
const roster = [
  { id: 'a', name: 'Alpha', extensions: ['001', '002'] },
  { id: 'b', name: 'Beta', extensions: ['003'] },
];
describe('expert report measurement', () => {
  it('aggregates multiple extensions and distinct contacts without counting duplicate attribution twice', () => {
    const r = expertPerformance(
      roster,
      [
        call,
        {
          ...call,
          id: 'c2',
          extension: '002',
          connected: true,
          complete: true,
        },
      ],
      [],
      at,
      null,
    );
    expect(r.rows.find((x) => x.id === 'a')).toMatchObject({
      outboundAttempts: 2,
      outboundConnected: 1,
      uniqueContacts: 1,
      completionRate: 0.5,
      extensions: ['001', '002'],
    });
    expect(r.details.get('a')?.uniqueContacts).toHaveLength(1);
  });
  it('does not call an unanswered incoming ring an answered call or count unknown numbers as people', () => {
    const r = expertPerformance(
      roster,
      [{ ...call, direction: 'INBOUND', knownPhone: false, actors: [] }],
      [],
      at,
      null,
    );
    expect(r.unattributed).toBe(1);
    expect(r.rows[0]).toMatchObject({
      inboundAnswered: 0,
      uniqueContacts: 0,
      completionRate: null,
    });
  });
  it('sorts current overdue work first and excludes cancelled/completed tasks at producer boundary', () => {
    const r = expertPerformance(
      roster,
      [call],
      [
        { ownerId: 'b', dueAt: '2026-11-01T00:00:00.000Z' },
        { ownerId: 'b', dueAt: null },
        { ownerId: 'a', dueAt: at },
      ],
      at,
      null,
    );
    expect(r.rows.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.rows[0]).toMatchObject({ overdue: 1, open: 2 });
    expect(r.rows[1]?.overdue).toBe(0);
  });
  it('credits a shared call once per authorized actor and hides other accounts', () => {
    const r = expertPerformance(
      roster,
      [{ ...call, actors: ['a', 'b'], connected: true }],
      [],
      at,
      ['a'],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      id: 'a',
      outboundAttempts: 1,
      shared: true,
    });
    expect(r.details.has('b')).toBe(false);
  });
  it('never attributes calls by names or current extension roster', () => {
    const r = expertPerformance(
      roster,
      [{ ...call, actors: [] }],
      [],
      at,
      null,
    );
    expect(r.unattributed).toBe(1);
    expect(r.rows.every((x) => x.total === 0)).toBe(true);
  });
});
