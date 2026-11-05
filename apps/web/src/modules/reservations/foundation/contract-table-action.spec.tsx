import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContractTableAction } from './contract-table-action';
import type { RequestView, ViewAccess } from './model';

vi.mock('../components/reservation-contract-editor', () => ({
  ReservationContractEditor: () => null,
}));
const access: ViewAccess = {
  authenticated: true,
  branchIds: ['branch'],
  permissions: ['reservations.read'],
};
const row = {
  id: 'request',
  contractId: 'contract',
  contractNumber: 'QA',
} as RequestView;
it('shows the actual correction checkbox checked after an amendment without a pending passenger correction', () => {
  const html = renderToStaticMarkup(
    <ContractTableAction
      row={{
        ...row,
        amendedAt: '2026-11-05T10:00:00Z',
        salesCorrectionPending: false,
      }}
      cancel={false}
      access={access}
    />,
  );
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('disabled=""');
  expect(
    renderToStaticMarkup(
      <ContractTableAction row={row} cancel={false} access={access} />,
    ),
  ).toContain('aria-checked="false"');
});
it('does not mark cancellation merely because a contract was amended', () => {
  const html = renderToStaticMarkup(
    <ContractTableAction
      row={{ ...row, amendedAt: '2026-11-05T10:00:00Z' }}
      cancel
      access={access}
    />,
  );
  expect(html).toContain('aria-checked="false"');
});
