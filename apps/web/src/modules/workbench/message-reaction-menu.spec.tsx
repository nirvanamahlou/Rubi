import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessagingMessageV1 } from '@nora/contracts';
const state = vi.hoisted(() => ({
  items: [] as Array<{
    children: unknown;
    disabled: boolean;
    onSelect: () => void;
  }>,
  close: null as null | ((event: { preventDefault: () => void }) => void),
  change: null as null | ((open: boolean) => void),
}));
vi.mock('@/components/ui', () => ({
  DropdownMenu: (props: {
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => {
    state.change = props.onOpenChange;
    return <div>{props.children}</div>;
  },
  DropdownMenuTrigger: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  DropdownMenuContent: (props: {
    children: React.ReactNode;
    onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
  }) => {
    state.close = props.onCloseAutoFocus;
    return <div>{props.children}</div>;
  },
  DropdownMenuItem: (props: (typeof state.items)[number]) => {
    state.items.push(props);
    return (
      <button disabled={props.disabled}>
        {props.children as React.ReactNode}
      </button>
    );
  },
}));
import { MessageReactionMenu } from './message-reaction-menu';
const message: MessagingMessageV1 = {
  id: 'one',
  conversationId: 'chat',
  body: 'source',
  sender: { id: 'sender', displayName: 'Sender', username: 'sender' },
  createdAt: '2026-10-18T10:00:00Z',
  attachments: [],
  forwardedFrom: null,
  reactions: [{ emoji: '👍', count: 1, userIds: ['self'] }],
};
function render(disabled = false) {
  const props = {
    message,
    position: { x: 120, y: 150 },
    currentUserId: 'self',
    disabled,
    onClose: vi.fn(),
    onReply: vi.fn(),
    onReact: vi.fn(),
  };
  renderToStaticMarkup(<MessageReactionMenu {...props} />);
  return props;
}
describe('message context actions', () => {
  beforeEach(() => {
    state.items = [];
    state.close = null;
    state.change = null;
  });
  it('offers exactly five reactions and a reply, with set/remove intent', () => {
    const props = render();
    expect(state.items.slice(0, 5).map((item) => item.children)).toEqual([
      '👍',
      '❤️',
      '😂',
      '😮',
      '🙏',
    ]);
    expect(state.items).toHaveLength(6);
    state.items[0]!.onSelect();
    expect(props.onReact).toHaveBeenLastCalledWith(message, null);
    state.items[2]!.onSelect();
    expect(props.onReact).toHaveBeenLastCalledWith(message, '😂');
    state.items[5]!.onSelect();
    expect(props.onReply).toHaveBeenCalledWith(message);
    state.change!(false);
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it('disables mutations while a request is pending', () => {
    render(true);
    expect(state.items.every((item) => item.disabled)).toBe(true);
  });
  it('restores message focus on Escape, but does not steal focus from the reply composer', () => {
    const focus = vi.fn();
    vi.stubGlobal('document', { getElementById: vi.fn(() => ({ focus })) });
    render();
    state.close!({ preventDefault: vi.fn() });
    expect(focus).toHaveBeenCalledOnce();
    focus.mockClear();
    state.items = [];
    render();
    state.items[5]!.onSelect();
    state.close!({ preventDefault: vi.fn() });
    expect(focus).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
