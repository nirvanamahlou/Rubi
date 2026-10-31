import { describe, expect, it } from 'vitest';
import { shownCallSession } from './shown-call-session';

function tabStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('shown call receipts across a tab refresh', () => {
  it('suppresses previously displayed unresolved calls after remount, but permits a new call', () => {
    const storage = tabStorage();
    const before = shownCallSession('agent-a', () => storage);
    before.add('call-one');
    before.add('call-two');
    const refreshed = shownCallSession('agent-a', () => storage);
    expect(
      ['call-one', 'call-two', 'call-new'].filter((id) => !refreshed.has(id)),
    ).toEqual(['call-new']);
  });
  it('does not suppress calls for another signed-in user or another tab session', () => {
    const storage = tabStorage();
    shownCallSession('agent-a', () => storage).add('call-one');
    expect(shownCallSession('agent-b', () => storage).has('call-one')).toBe(
      false,
    );
    expect(
      shownCallSession('agent-a', () => tabStorage()).has('call-one'),
    ).toBe(false);
  });
  it('merges receipts from both popup listeners without losing previous entries', () => {
    const storage = tabStorage();
    const incoming = shownCallSession('agent', () => storage);
    const outgoing = shownCallSession('agent', () => storage);
    incoming.add('incoming');
    outgoing.add('outgoing');
    expect(incoming.has('outgoing')).toBe(true);
    expect(outgoing.has('incoming')).toBe(true);
  });
  it('retains in-memory protection when browser storage is unavailable', () => {
    const receipt = shownCallSession('agent', () => {
      throw new Error('Storage denied');
    });
    expect(receipt.has('new')).toBe(false);
    expect(() => receipt.add('new')).not.toThrow();
    expect(receipt.has('new')).toBe(true);
  });
});
