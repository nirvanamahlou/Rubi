import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type * as Access from '@/modules/iam/access-context';
vi.mock('@/modules/iam/access-context', async (original) => ({
  ...(await original<typeof Access>()),
  useAccessPermissions: () => ['sales.contracts.create'],
  useRouteAccess: () => () => true,
}));
import { ContractOutputButton } from './contract-output';
import { PassengerCorrectionButton } from './passenger-correction';
it('exposes contract output and amendment to a creator without separate action grants', () => {
  const output = renderToStaticMarkup(
    <ContractOutputButton contractId="synthetic" />,
  );
  expect(output).toContain('قرارداد');
  expect(output).toContain('<button');
  expect(output).not.toContain('disabled=""');
  const edit = renderToStaticMarkup(
    <PassengerCorrectionButton
      contractId="synthetic"
      status="CONFIRMED"
      onSaved={() => undefined}
    />,
  );
  expect(edit).toContain('اصلاح');
  expect(edit).not.toContain('disabled=""');
});
