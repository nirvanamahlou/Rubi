import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { SelectHTMLAttributes, InputHTMLAttributes } from 'react';

const controls = vi.hoisted(() => ({
  select: null as SelectHTMLAttributes<HTMLSelectElement> | null,
  input: null as InputHTMLAttributes<HTMLInputElement> | null,
}));
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => {
    controls.select = props;
    return <select {...props} />;
  },
}));
vi.mock('@/components/ui/form-controls', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => {
    controls.input = props;
    return <input {...props} />;
  },
}));
import { UserRolePicker } from './user-role-picker';

const roles = [
  { id: 'sales', name: 'Sales' },
  { id: 'support', name: 'Support' },
];
describe('redesigned user role picker', () => {
  it('cleans the full-access label without changing the saved role ID or selecting any new access', () => {
    const name = 'مدیر سامانه، دسترسی کامل Demo';
    const onRoleChange = vi.fn();
    const html = renderToStaticMarkup(
      <UserRolePicker
        roles={[{ id: 'unchanged-role', name }]}
        title={name}
        disabled={false}
        onRoleChange={onRoleChange}
        onTitleChange={vi.fn()}
      />,
    );
    expect(html).not.toContain('Demo');
    expect(controls.select?.value).toBe('unchanged-role');
    expect(onRoleChange).not.toHaveBeenCalled();
    controls.select?.onChange?.({
      target: { value: 'unchanged-role' },
    } as never);
    expect(onRoleChange).toHaveBeenCalledWith('unchanged-role');
  });
  it('prefills the saved role and title without changing access on opening', () => {
    const onRoleChange = vi.fn();
    const onTitleChange = vi.fn();
    const html = renderToStaticMarkup(
      <UserRolePicker
        roles={roles}
        title="Support"
        disabled={false}
        onRoleChange={onRoleChange}
        onTitleChange={onTitleChange}
      />,
    );
    expect(controls.select?.value).toBe('support');
    expect(controls.input?.value).toBe('Support');
    expect(html).toContain('aria-labelledby');
    expect(html).toContain('for=');
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(onTitleChange).not.toHaveBeenCalled();
  });
  it('forwards the role ID, not its title, as a draft selection', () => {
    const onRoleChange = vi.fn();
    renderToStaticMarkup(
      <UserRolePicker
        roles={roles}
        title="Support"
        disabled={false}
        onRoleChange={onRoleChange}
        onTitleChange={vi.fn()}
      />,
    );
    controls.select?.onChange?.({ target: { value: 'sales' } } as never);
    expect(onRoleChange).toHaveBeenCalledWith('sales');
  });
  it('supports a custom title and does not replace it with an arbitrary role', () => {
    const onTitleChange = vi.fn();
    renderToStaticMarkup(
      <UserRolePicker
        roles={roles}
        title="Custom"
        disabled={false}
        onRoleChange={vi.fn()}
        onTitleChange={onTitleChange}
      />,
    );
    expect(controls.select?.value).toBe('');
    controls.input?.onChange?.({
      target: { value: 'New custom title' },
    } as never);
    expect(onTitleChange).toHaveBeenCalledWith('New custom title');
  });
  it('disables both controls for a read-only operator or pending save', () => {
    renderToStaticMarkup(
      <UserRolePicker
        roles={roles}
        title="Support"
        disabled
        onRoleChange={vi.fn()}
        onTitleChange={vi.fn()}
      />,
    );
    expect(controls.select?.disabled).toBe(true);
    expect(controls.input?.disabled).toBe(true);
  });
  it('handles an empty saved-role directory without inventing access', () => {
    const html = renderToStaticMarkup(
      <UserRolePicker
        roles={[]}
        title="Custom"
        disabled={false}
        onRoleChange={vi.fn()}
        onTitleChange={vi.fn()}
      />,
    );
    expect(controls.select?.disabled).toBe(true);
    expect(controls.input?.value).toBe('Custom');
    expect(html).toContain('هنوز نقشی تعریف نشده است.');
  });
  it('removes the requested heading and explanations from the manual editor', () => {
    const source = readFileSync(
      new URL('./manual-access-editor.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('تیک‌های اختصاصی این کاربر');
    expect(source).not.toContain('عنوان شغلی مجوز نمی‌دهد.');
    expect(source).not.toContain(
      'تیک‌ها از دسترسی قبلی این کاربر استخراج شده‌اند.',
    );
    expect(source).toContain('<UserRolePicker');
  });
});
