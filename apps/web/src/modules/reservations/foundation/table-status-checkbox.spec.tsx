import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableStatusCheckbox } from './table-status-checkbox';
import type { RequestView } from './model';
it('shows saved checkbox actor/time and respects denied access', () => {
  const row = {
    id: 'id',
    contractNumber: 'C1',
    status: 'NEW',
    tableFlags: {
      visaRequested: {
        checked: true,
        updatedAt: '2026-09-30T10:00:00Z',
        updatedByUserId: 'actor',
        actorName: 'مسئول ویزا',
      },
    },
  } as RequestView;
  const html = renderToStaticMarkup(
    <TableStatusCheckbox
      row={row}
      flag="visaRequested"
      label="اقدام ویزا"
      canManage={false}
    />,
  );
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('مسئول ویزا');
  expect(html).toContain('disabled');
  expect(html).not.toContain('role="alert"');
});
