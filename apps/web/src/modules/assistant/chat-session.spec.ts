import { describe, expect, it } from 'vitest';
import {
  assistantConversationScopeKey,
  appendChatExchange,
} from './chat-session';
import { conversationHistory } from './agent-response';

describe('browser-lifetime chat transcript', () => {
  const actor: NonNullable<
    Parameters<typeof assistantConversationScopeKey>[1]
  > = {
    userId: 'synthetic',
    branchIds: ['b', 'a'],
    permissions: ['sales.payments.read', 'sales.audit.read'],
  };
  it('isolates a changed company/context version without keying on display metadata', () => {
    const context = {
      selection: 'ALL' as const,
      version: 1,
      legalEntity: null,
      isAggregate: true,
    };
    const key = assistantConversationScopeKey(context, actor);
    expect(
      assistantConversationScopeKey(
        { ...context, selection: 'JAHAN_BASTAN' },
        actor,
      ),
    ).not.toBe(key);
    expect(
      assistantConversationScopeKey({ ...context, version: 2 }, actor),
    ).not.toBe(key);
    expect(
      assistantConversationScopeKey({ ...context, isAggregate: false }, actor),
    ).toBe(key);
  });
  it('does not remount for reordered native grants, but isolates accounts and changed grants', () => {
    const key = assistantConversationScopeKey(null, actor);
    expect(
      assistantConversationScopeKey(null, {
        ...actor,
        branchIds: ['a', 'b'],
        permissions: ['sales.audit.read', 'sales.payments.read'],
      }),
    ).toBe(key);
    expect(
      assistantConversationScopeKey(null, { ...actor, userId: 'other' }),
    ).not.toBe(key);
    expect(
      assistantConversationScopeKey(null, {
        ...actor,
        permissions: ['sales.audit.read'],
      }),
    ).not.toBe(key);
    expect(
      assistantConversationScopeKey(null, { ...actor, branchIds: ['a'] }),
    ).not.toBe(key);
    expect(assistantConversationScopeKey(null, null)).not.toBe(key);
  });
  it('retains earlier displayed messages beyond the provider history budget', () => {
    const first = { role: 'user' as const, content: 'first' };
    let messages = [first];
    for (let i = 0; i < 30; i++)
      messages = appendChatExchange(messages, [
        { role: 'user', content: String(i) },
      ]);
    expect(messages).toHaveLength(31);
    expect(messages[0]).toBe(first);
    expect(conversationHistory(messages)).toHaveLength(12);
    expect(
      conversationHistory([
        ...messages,
        { role: 'user', content: 'private guide', local: true },
      ]),
    ).toEqual(conversationHistory(messages));
    expect(appendChatExchange([], [])).toEqual([]);
  });
});
