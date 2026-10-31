import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type * as Access from '@/modules/iam/access-context';
vi.mock('@/modules/iam/access-context', async (original) => ({
  ...(await original<typeof Access>()),
  useAccessPermissions: () => ['sales.contracts.create'],
  useAccessActor: () => ({
    userId: 'owner',
    branchIds: ['branch'],
    permissions: ['sales.contracts.create'],
  }),
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
      ownerUserId="owner"
      branchId="branch"
      status="CONFIRMED"
      onSaved={() => undefined}
    />,
  );
  expect(edit).toContain('اصلاح');
  expect(edit).not.toContain('disabled=""');
});

it('does not expose another owner or branch through the creator-only amendment button', () => {
  for (const contract of [
    { ownerUserId: 'other', branchId: 'branch' },
    { ownerUserId: 'owner', branchId: 'other' },
  ]) {
    expect(
      renderToStaticMarkup(
        <PassengerCorrectionButton
          contractId="synthetic"
          {...contract}
          status="CONFIRMED"
          onSaved={() => undefined}
        />,
      ),
    ).not.toContain('اصلاح');
  }
});

it('hides owner-only output on another owner or branch while retaining the new-contract completion action', () => {
  for (const contract of [
    { ownerUserId: 'other', branchId: 'branch' },
    { ownerUserId: 'owner', branchId: 'other' },
  ]) {
    expect(
      renderToStaticMarkup(
        <ContractOutputButton contractId="synthetic" {...contract} />,
      ),
    ).not.toContain('<button');
  }
  expect(
    renderToStaticMarkup(
      <ContractOutputButton
        contractId="synthetic"
        ownerUserId="owner"
        branchId="branch"
      />,
    ),
  ).toContain('<button');
});
