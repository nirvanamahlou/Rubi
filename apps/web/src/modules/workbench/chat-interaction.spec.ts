import { describe, expect, it } from 'vitest';
import {
  matchesConversationSearch,
  shouldSendOnEnter,
} from './chat-interaction';
describe('chat interaction', () => {
  const enter = {
    key: 'Enter',
    shiftKey: false,
    repeat: false,
    isComposing: false,
    keyCode: 13,
  };
  it('sends plain Enter but preserves multiline and IME input without repeated sends', () => {
    expect(shouldSendOnEnter(enter)).toBe(true);
    for (const patch of [
      { shiftKey: true },
      { repeat: true },
      { isComposing: true },
      { keyCode: 229 },
      { key: 'a' },
    ])
      expect(shouldSendOnEnter({ ...enter, ...patch })).toBe(false);
  });
  it('matches Persian/Arabic variants, participant names and latest previews', () => {
    expect(
      matchesConversationSearch(
        ['گروه فروش', 'علي كريمي', 'ارسال شد'],
        'علی کریمی',
      ),
    ).toBe(true);
    expect(matchesConversationSearch(['گروه فروش', 'ارسال شد'], 'ارسال')).toBe(
      true,
    );
    expect(matchesConversationSearch(['Support'], ' support ')).toBe(true);
    expect(matchesConversationSearch(['فروش'], '')).toBe(true);
    expect(matchesConversationSearch(['فروش'], 'مالی')).toBe(false);
  });
});
