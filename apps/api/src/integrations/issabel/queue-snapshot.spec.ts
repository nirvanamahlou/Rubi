import { describe, expect, it } from 'vitest';
import { QueueSnapshotCollector, queueWrapupPolicy } from './queue-snapshot';

const now = new Date('2026-10-22T10:00:00Z');
const member = {
  event: 'QueueMember',
  actionid: 'id',
  queue: '1002',
  location: 'Local/110@from-queue/n',
  status: '1',
  incall: '0',
  paused: '0',
  lastcall: '0',
  wrapuptime: '0',
};
function fixture(overrides = {}, wrapup = 30) {
  const c = new QueueSnapshotCollector('1002', 'id', wrapup, now);
  c.accept({ event: 'QueueParams', queue: '1002', actionid: 'id' });
  c.accept({ ...member, ...overrides });
  return c;
}
const complete = (c: QueueSnapshotCollector, count = '2') => {
  c.accept({ event: 'QueueStatusComplete', actionid: 'id', listitems: count });
  return c.snapshot();
};
describe('trusted QueueStatus projection', () => {
  it('requires explicit server-side queue policy, including explicit zero', () => {
    for (const raw of [
      undefined,
      'null',
      '[]',
      '{}',
      '{"1002":-1}',
      '{"1002":"0"}',
      '{',
    ])
      expect(queueWrapupPolicy(raw, '1002')).toBeNull();
    expect(queueWrapupPolicy('{"1002":0}', '1002')).toBe(0);
  });
  it('uses correlated complete lists and discards caller/name data', () => {
    const c = fixture();
    c.accept({ ...member, actionid: 'other' });
    c.accept({
      event: 'QueueEntry',
      actionid: 'id',
      queue: '1002',
      calleridnum: 'private',
    });
    expect(c.snapshot()).toBeNull();
    expect(complete(c, '3')).toEqual({
      queue: '1002',
      observedAt: now,
      members: [
        { extension: '110', active: true, paused: false, available: true },
      ],
    });
  });
  it.each([
    { status: '0' },
    { status: '2' },
    { status: '5' },
    { status: '6' },
    { incall: '1' },
    { incall: '' },
    { paused: '1' },
    { paused: '' },
    { lastcall: 'unknown' },
    { wrapuptime: '' },
  ])('fails closed for uncertain or unavailable member %j', (fields) => {
    const result = complete(fixture(fields))!.members[0]!;
    expect(result.available && !result.paused).toBe(false);
  });
  it('honors inherited/member wrapup, future times and boundary', () => {
    const lastcall = String(now.getTime() / 1000 - 20);
    expect(complete(fixture({ lastcall }))!.members[0]!.available).toBe(false);
    expect(
      complete(fixture({ lastcall, wrapuptime: '20' }))!.members[0]!.available,
    ).toBe(true);
    expect(
      complete(fixture({ lastcall: String(now.getTime() / 1000 + 1) }))!
        .members[0]!.available,
    ).toBe(false);
  });
  it('rejects incomplete, wrong queue, unknown interface and changing membership', () => {
    expect(complete(fixture(), '7')).toBeNull();
    expect(complete(fixture({ queue: 'other' }))).toBeNull();
    expect(complete(fixture({ location: 'Local/110@guessed/n' }))).toBeNull();
    const c = fixture();
    c.accept({ event: 'QueueMemberRemoved', queue: '1002' });
    expect(complete(c)).toBeNull();
  });
  it('bounds large lists and keeps duplicate members ambiguous for the selector', () => {
    const c = fixture();
    c.accept(member);
    expect(complete(c, '3')!.members).toHaveLength(2);
    const large = fixture();
    for (let i = 0; i < 2048; i++)
      large.accept({ event: 'QueueEntry', queue: '1002', actionid: 'id' });
    expect(complete(large, '2050')).toBeNull();
  });
});
