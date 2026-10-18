import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDetailsEditor } from './user-details-editor';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  saving: { current: false },
  button: {} as {
    onClick: () => Promise<void>;
    disabled: boolean;
    loading: boolean;
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (state.values.length <= index) state.values[index] = initial;
    return [
      state.values[index],
      (value: unknown) => {
        state.values[index] = value;
      },
    ];
  },
  useRef: () => state.saving,
}));
vi.mock('@/components/ui/button', () => ({
  Button: (props: typeof state.button) => {
    state.button = props;
    return (
      <button
        disabled={props.disabled || props.loading}
        aria-busy={props.loading || undefined}
      />
    );
  },
}));
vi.mock('@/components/ui/form-controls', () => ({ Input: () => <input /> }));
vi.mock('./user-unit-select', () => ({ UserUnitSelect: () => <select /> }));

describe('user details save button lifecycle', () => {
  beforeEach(() => {
    state.values = [];
    state.cursor = 0;
    state.saving.current = false;
  });
  const user = {
    id: 'user',
    displayName: 'Saved Name',
    detailsRevision: 'revision',
    organizationUnitId: null,
  };
  function render(
    request = vi.fn(),
    onSaved = vi.fn(async () => {}),
    canManage = true,
    savedUser = user,
  ) {
    state.cursor = 0;
    return renderToStaticMarkup(
      <UserDetailsEditor
        user={savedUser}
        canManage={canManage}
        request={request}
        onSaved={onSaved}
      />,
    );
  }
  it('keeps the initial/saved button enabled and avoids unchanged writes', async () => {
    const request = vi.fn();
    expect(render(request)).not.toContain('disabled');
    await state.button.onClick();
    expect(request).not.toHaveBeenCalled();
  });
  it('restores normal appearance after the save and refresh settle, blocks duplicate clicks', async () => {
    let finish!: () => void;
    const request = vi.fn(
      (_path: string, _init?: RequestInit) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onSaved = vi.fn(async () => {});
    render(request, onSaved);
    state.values[0] = 'Updated Name';
    render(request, onSaved);
    const pending = state.button.onClick();
    expect(render(request, onSaved)).toContain('aria-busy="true"');
    await state.button.onClick();
    expect(request).toHaveBeenCalledOnce();
    finish();
    await pending;
    const html = render(request, onSaved, true, {
      ...user,
      displayName: 'Updated Name',
      detailsRevision: 'new-revision',
    });
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('aria-busy');
    expect(onSaved).toHaveBeenCalledOnce();
    await state.button.onClick();
    expect(request).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({
      displayName: 'Updated Name',
      revision: 'revision',
    });
  });
  it('restores normal appearance after an error and allows retry', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Save failed'))
      .mockResolvedValueOnce({});
    render(request);
    state.values[1] = 'unit';
    render(request);
    await state.button.onClick();
    expect(render(request)).toContain('Save failed');
    expect(state.button).toMatchObject({ disabled: false, loading: false });
    await state.button.onClick();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('preserves read-only restrictions and invalid-name validation', async () => {
    const request = vi.fn();
    expect(render(request, undefined, false)).toContain('disabled');
    await state.button.onClick();
    render(request);
    state.values[0] = 'x';
    render(request);
    await state.button.onClick();
    expect(request).not.toHaveBeenCalled();
    expect(state.button).toMatchObject({ loading: false });
  });
});
