import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type * as Access from '@/modules/iam/access-context';
const access = vi.hoisted(() => ({ permissions: ['sales.contracts.create'] }));
vi.mock('@/modules/iam/access-context', async (original) => ({
  ...(await original<typeof Access>()),
  useAccessPermissions: () => access.permissions,
  useAccessActor: () => ({
    userId: 'owner',
    branchIds: ['branch'],
    permissions: access.permissions,
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

it.each(['sales.contracts.read.branch', 'sales.contracts.read.all'])(
  'exposes correction and explicit passenger completion for a scoped %s reader',
  (permission) => {
    access.permissions = [permission];
    try {
      for (const completionOnly of [false, true]) {
        const html = renderToStaticMarkup(
          <PassengerCorrectionButton
            contractId="synthetic"
            ownerUserId="other"
            branchId="branch"
            status="CONFIRMED"
            completionOnly={completionOnly}
            onSaved={() => undefined}
          />,
        );
        expect(html).toContain(completionOnly ? 'افزودن مسافر' : 'اصلاح');
        expect(html).not.toContain('disabled=""');
      }
      const forbidden = renderToStaticMarkup(
        <PassengerCorrectionButton
          contractId="synthetic"
          ownerUserId="other"
          branchId="outside"
          status="CONFIRMED"
          completionOnly
          onSaved={() => undefined}
        />,
      );
      expect(forbidden).not.toContain('افزودن مسافر');
    } finally {
      access.permissions = ['sales.contracts.create'];
    }
  },
);
