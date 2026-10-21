import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ManualAccessEditor,
  type ManualAccessEditorHandle,
} from './manual-access-editor';
import { INTEGRATION_ACCESS_SECTIONS } from '@nora/contracts';

const fixture = vi.hoisted(() => ({
  values: [] as unknown[],
  stateIndex: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effect: null as null | (() => unknown),
  picker: null as null | { onRoleChange: (id: string) => void; title: string },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.stateIndex++;
    if (fixture.values.length <= index) fixture.values[index] = initial;
    return [
      fixture.values[index],
      (value: unknown) => {
        fixture.values[index] =
          typeof value === 'function' ? value(fixture.values[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = fixture.refIndex++;
    fixture.refs[index] ??= { current: initial };
    return fixture.refs[index];
  },
  useEffect: (effect: () => unknown) => {
    fixture.effect = effect;
  },
  useImperativeHandle: (
    ref: React.RefObject<unknown>,
    create: () => unknown,
  ) => {
    ref.current = create();
  },
}));
vi.mock('./user-role-picker', () => ({
  UserRolePicker: (props: NonNullable<typeof fixture.picker>) => {
    fixture.picker = props;
    return <div>Role picker</div>;
  },
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));
vi.mock('@/components/ui/form-controls', () => ({ Input: () => <input /> }));

describe('legacy administrator role save round trip', () => {
  const before = {
    revision: 'old',
    title: 'مدیر سامانه',
    alreadyManual: false,
    selection: {
      permissionCodes: ['iam.users.read', 'iam.users.manage'],
      screenIds: ['system.users'],
      allowedControlIds: [],
    },
  };
  const role = {
    id: 'full-role',
    name: 'دسترسی کامل Demo',
    selection: {
      permissionCodes: [
        'iam.users.read',
        'iam.users.manage',
        'sales.contracts.create',
      ],
      screenIds: ['system.users', 'sales.new-contract'],
      allowedControlIds: [],
    },
    permissions: [],
  };
  const next = {
    ...before,
    revision: 'new',
    title: role.name,
    alreadyManual: true,
    selection: role.selection,
  };
  beforeEach(() => {
    fixture.values = [];
    fixture.refs = [];
    fixture.stateIndex = 0;
    fixture.refIndex = 0;
    fixture.effect = null;
    fixture.picker = null;
  });
  function setup(canManage = true) {
    const request = vi
      .fn<(path: string, init?: RequestInit) => Promise<unknown>>()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(next);
    const onSaved = vi.fn(async () => {});
    const ref = { current: null as ManualAccessEditorHandle | null };
    const render = () => {
      fixture.stateIndex = 0;
      fixture.refIndex = 0;
      return renderToStaticMarkup(
        <ManualAccessEditor
          ref={ref}
          userId="legacy-admin"
          canManage={canManage}
          templates={[role]}
          options={{
            permissions: role.selection.permissionCodes.map((code) => ({
              code,
              name: code,
            })),
            assignableScreenIds: role.selection.screenIds,
            assignableControlIds: [],
            canAssignAll: true,
          }}
          controlLabel={(control) => control.title}
          request={request}
          onSaved={onSaved}
        />,
      );
    };
    return { request, onSaved, ref, render };
  }
  async function load(render: () => string) {
    render();
    fixture.effect?.();
    await Promise.resolve();
    render();
  }
  it('keeps an unchanged administrator untouched when final Save is clicked', async () => {
    const { request, ref, render } = setup();
    await load(render);
    expect(await ref.current!.save()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('renders all nine Integrations choices as checkboxes without changing an existing user', async () => {
    const { request, ref, render } = setup();
    await load(render);
    const html = render();
    const group = html.slice(html.indexOf('انتخاب کل بخش یکپارچه‌سازی‌ها'));
    for (const [, title] of INTEGRATION_ACCESS_SECTIONS) {
      const label = (
        group.match(/<label\b[^>]*>[\s\S]*?<\/label>/g) ?? []
      ).find((value) => value.includes(title));
      expect(label).toContain('type="checkbox"');
      expect(label).not.toContain('checked=""');
    }
    expect(group).toContain('SSO');
    expect(await ref.current!.save()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('persists the full-access role title/grants and reloads them through the final Save bridge', async () => {
    const { request, ref, render, onSaved } = setup();
    await load(render);
    fixture.picker!.onRoleChange('full-role');
    render();
    expect(await ref.current!.save()).toBe(true);
    const html = render();
    expect(request.mock.calls[1]![0]).toBe(
      '/iam/users/legacy-admin/manual-access',
    );
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toEqual({
      revision: 'old',
      title: role.name,
      ...role.selection,
    });
    expect(fixture.picker!.title).toBe(role.name);
    expect(html.indexOf('role="status"')).toBeLessThan(
      html.indexOf('<details'),
    );
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await ref.current!.save()).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('displays server denial/conflict beside the picker and keeps the draft retryable', async () => {
    const { request, ref, render, onSaved } = setup();
    await load(render);
    fixture.picker!.onRoleChange('full-role');
    render();
    request
      .mockReset()
      .mockRejectedValue(new Error('Conflict: reload required'));
    expect(await ref.current!.save()).toBe(false);
    expect(render()).toContain('Conflict: reload required');
    expect(onSaved).not.toHaveBeenCalled();
  });
  it('does not submit a role for a read-only operator', async () => {
    const { request, ref, render } = setup(false);
    await load(render);
    expect(await ref.current!.save()).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
