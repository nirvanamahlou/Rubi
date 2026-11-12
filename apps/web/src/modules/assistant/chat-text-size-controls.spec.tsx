import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatTextSizeControls } from './chat-text-size-controls';

describe('chat text size controls', () => {
  it('changes text size in both directions without touching other chat state', () => {
    const onChange = vi.fn();
    const group = ChatTextSizeControls({ value: 14, onChange, english: false });
    const [larger, smaller] = group.props.children;
    larger.props.onClick();
    smaller.props.onClick();
    expect(onChange.mock.calls).toEqual([[16], [12]]);
  });
  it('disables the matching control at each limit and clamps repeated requests', () => {
    const onChange = vi.fn();
    const min = ChatTextSizeControls({ value: 12, onChange, english: true });
    const max = ChatTextSizeControls({ value: 24, onChange, english: true });
    expect(min.props.children[1].props.disabled).toBe(true);
    expect(max.props.children[0].props.disabled).toBe(true);
    min.props.children[1].props.onClick();
    max.props.children[0].props.onClick();
    expect(onChange.mock.calls).toEqual([[12], [24]]);
  });
  it.each([false, true])(
    'provides labelled icon buttons in each language (%s)',
    (english) => {
      const html = renderToStaticMarkup(
        <ChatTextSizeControls
          value={14}
          onChange={() => {}}
          english={english}
        />,
      );
      expect(html).toContain(
        english ? 'Increase chat text size' : 'بزرگ‌تر کردن متن گفتگو',
      );
      expect(html).toContain(
        english ? 'Decrease chat text size' : 'کوچک‌تر کردن متن گفتگو',
      );
      expect(html.match(/type="button"/g)).toHaveLength(2);
      expect(html).toContain('aria-hidden="true"');
    },
  );
});
