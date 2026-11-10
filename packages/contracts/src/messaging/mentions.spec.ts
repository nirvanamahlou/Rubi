import { expect, it } from 'vitest';
import { messagingMentionAtCaret, messagingMentionUsernames } from './index';

it('finds distinct mention tokens without matching an email address', () => {
  expect(
    messagingMentionUsernames(
      'Email test@nima.example, then @Nima.Name, @nima.name and @other.',
    ),
  ).toEqual(['nima.name', 'other.']);
});
it('returns the active mention range at the caret while preserving text after it', () => {
  expect(messagingMentionAtCaret('Please @Ni more', 10)).toEqual({
    query: 'ni',
    start: 7,
    end: 10,
  });
  expect(messagingMentionAtCaret('test@nima', 9)).toBeNull();
});
