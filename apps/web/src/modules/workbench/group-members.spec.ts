import type { MessagingContactV1 } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import { canAddGroupMember } from './group-members';

const contact = (id: string, branches: string[]): MessagingContactV1 => ({
  id,
  username: id,
  displayName: id,
  branches: branches.map((branch) => ({
    id: branch,
    code: branch,
    name: branch,
  })),
});

describe('group member selection', () => {
  it('allows the first member and members with one shared branch', () => {
    const first = contact('first', ['a', 'b']);
    expect(canAddGroupMember([], first)).toBe(true);
    expect(canAddGroupMember([first], contact('second', ['b', 'c']))).toBe(
      true,
    );
  });

  it('rejects a candidate without a branch shared by every selected member', () => {
    const first = contact('first', ['a', 'b']);
    const second = contact('second', ['b', 'c']);
    expect(
      canAddGroupMember([first, second], contact('third', ['a', 'c'])),
    ).toBe(false);
    expect(canAddGroupMember([first, second], contact('third', ['b']))).toBe(
      true,
    );
  });
});
