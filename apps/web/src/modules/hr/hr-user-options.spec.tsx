import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewEmployeeForm } from './new-employee-dialog';

vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: ({ optionLimit, ...props }: Record<string, unknown>) =>
    createElement('select', { ...props, 'data-option-limit': optionLimit }),
}));

describe('employee account options', () => {
  it('offers the complete IAM directory beyond five entries and explains unavailable choices', () => {
    const users = Array.from({ length: 12 }, (_, i) => ({
      id: `user-${i}`,
      label: `Account ${i}`,
      branches: ['شرکت الف'],
      ...(i === 1 ? { unavailableReason: 'LINKED' as const } : {}),
      ...(i === 2 ? { unavailableReason: 'INACTIVE' as const } : {}),
    }));
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        existingPersonnelCodes={[]}
        managerOptions={[]}
        branchOptions={['شرکت الف']}
        userOptions={users}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('data-option-limit="14"');
    expect(html).toContain('value="user-11"');
    expect(html).toContain('value="user-1" disabled=""');
    expect(html).toContain('value="user-2" disabled=""');
    expect(html).toContain('مرتبط با کارمند دیگر');
    expect(html).toContain('غیرفعال');
    expect(html).not.toContain('value="user-11" disabled');
  });
});
