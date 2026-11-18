import { describe, expect, it } from 'vitest';
import { ticketCreationBranch } from './publication-branch';

describe('ticket creation branch', () => {
  const branches = [{ id: 'hq' }, { id: 'niyayesh' }];
  it('requires an explicit choice for a user with multiple branches', () => {
    expect(() => ticketCreationBranch(branches, '')).toThrow();
    expect(ticketCreationBranch(branches, 'niyayesh')).toBe('niyayesh');
  });
  it('revalidates the choice against current authorized branches', () => {
    expect(() => ticketCreationBranch([{ id: 'hq' }], 'niyayesh')).toThrow();
    expect(() => ticketCreationBranch(branches, 'unauthorized')).toThrow();
    expect(() => ticketCreationBranch([], '')).toThrow();
  });
  it('uses the sole authorized branch when there is no ambiguity', () => {
    expect(ticketCreationBranch([{ id: 'only' }], '')).toBe('only');
  });
});
