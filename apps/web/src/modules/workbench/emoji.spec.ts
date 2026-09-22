import { describe, expect, it } from 'vitest';
import { insertMessageEmoji, MESSAGE_DRAFT_LIMIT } from './emoji';
describe('message emoji insertion', () => {
  it('inserts at the caret in Persian text', () => {
    expect(insertMessageEmoji('سلام دوست', '😊', 5, 5)).toEqual({
      text: 'سلام 😊دوست',
      caret: 7,
    });
  });
  it('replaces selection and preserves the suffix', () => {
    expect(insertMessageEmoji('hello world!', '👋', 6, 11)).toEqual({
      text: 'hello 👋!',
      caret: 8,
    });
  });
  it('handles multicode-unit emoji and repeated insertion', () => {
    const first = insertMessageEmoji('', '❤️', 0, 0)!;
    expect(
      insertMessageEmoji(first.text, '👍', first.caret, first.caret),
    ).toEqual({ text: '❤️👍', caret: 4 });
  });
  it('rejects overflow without truncating an emoji', () => {
    expect(
      insertMessageEmoji('a'.repeat(MESSAGE_DRAFT_LIMIT - 1), '😊', 0, 0),
    ).toBeNull();
  });
  it('allows replacing selected text at the limit', () => {
    expect(
      insertMessageEmoji('a'.repeat(MESSAGE_DRAFT_LIMIT), '😊', 0, 2)?.text
        .length,
    ).toBe(MESSAGE_DRAFT_LIMIT);
  });
});
