import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { WeeklyShiftForm } from './weekly-shift-form';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';

vi.mock('@/components/ui/overlays', () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Box,
    DialogContent: Box,
    DialogTitle: Box,
    DialogDescription: Box,
  };
});

it('restores every saved weekday as an independently selectable checkbox when editing', () => {
  const target = {
    record: {
      branchId: 'b',
      employeeId: 'e',
      values: [
        'شیفت',
        '09:15',
        '17:00',
        '',
        '',
        '',
        'کارمند',
        '2026-11-01',
        '2026-11-30',
        'شنبه، دوشنبه',
      ],
    },
  } as HrFormTarget;
  const store = {
    data: {
      employees: [
        {
          id: 'e',
          branchId: 'b',
          status: 'فعال',
          name: 'کارمند',
          personnelCode: '1',
        },
      ],
      branches: [{ id: 'b', name: 'شعبه' }],
    },
  } as HrStore;
  const html = renderToStaticMarkup(
    <WeeklyShiftForm
      target={target}
      store={store}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  const group = html.slice(
    html.indexOf('<legend>روزهای هفته</legend>'),
    html.indexOf('</fieldset>', html.indexOf('<legend>روزهای هفته</legend>')),
  );
  expect(group.match(/type="checkbox"/g)).toHaveLength(7);
  expect(group.match(/checked=""/g)).toHaveLength(2);
  expect(group).toContain('شنبه');
  expect(group).toContain('دوشنبه');
  expect(group).not.toContain('<select');
});
