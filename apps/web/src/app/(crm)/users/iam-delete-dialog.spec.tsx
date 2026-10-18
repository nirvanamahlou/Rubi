import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
const { buttons } = vi.hoisted(() => ({
  buttons: [] as Array<{
    children: unknown;
    onClick?: () => void;
    disabled?: boolean;
  }>,
}));
vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));
vi.mock('@/components/ui/button', () => ({
  Button: (props: {
    children: ReactNode;
    onClick: () => void;
    disabled: boolean;
  }) => {
    buttons.push(props);
    return (
      <button disabled={props.disabled} onClick={props.onClick}>
        {props.children}
      </button>
    );
  },
}));
import { IamDeleteDialog } from './iam-delete-dialog';
describe('in-application IAM delete confirmation', () => {
  it('requires explicit confirm, names the user and never invokes deletion on opening', () => {
    buttons.length = 0;
    const confirm = vi.fn(),
      cancel = vi.fn();
    const html = renderToStaticMarkup(
      <IamDeleteDialog
        target={{ id: 'one', name: 'Synthetic user', kind: 'user' }}
        busy={false}
        error=""
        onConfirm={confirm}
        onCancel={cancel}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Synthetic user');
    expect(confirm).not.toHaveBeenCalled();
    expect(buttons).toHaveLength(2);
    buttons[0]!.onClick!();
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
  });
  it('shows server errors next to the confirmation and disables duplicate writes', () => {
    buttons.length = 0;
    const html = renderToStaticMarkup(
      <IamDeleteDialog
        target={{
          id: 'role',
          name: 'Synthetic role',
          kind: 'role',
          revision: 'r',
        }}
        busy={true}
        error="Dependent records"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('تأیید حذف دائمی نقش');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Dependent records');
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
  it('does not render a confirmation before a deletion target is chosen', () => {
    expect(
      renderToStaticMarkup(
        <IamDeleteDialog
          target={null}
          busy={false}
          error=""
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      ),
    ).toBe('');
  });
  it('uses application confirmation instead of the silently blocked native confirm', () => {
    const source = readFileSync(
      new URL('./user-management.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('window.confirm');
    expect(source).toContain('<IamDeleteDialog');
    expect(source).toContain('setDeleteTarget');
  });
});
