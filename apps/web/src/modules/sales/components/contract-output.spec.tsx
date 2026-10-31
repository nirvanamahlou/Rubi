import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const access = vi.hoisted(() => ({
  permissions: undefined as string[] | undefined,
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => access.permissions,
  useAccessActor: () => ({
    userId: 'reader',
    branchIds: ['branch'],
    permissions: access.permissions ?? [],
  }),
  useRouteAccess: () => () => true,
}));
import { ContractOutputButton } from './contract-output';
beforeEach(() => {
  access.permissions = undefined;
});

it('labels the contract action without PDF wording by default', () => {
  const html = renderToStaticMarkup(
    <ContractOutputButton contractId="synthetic" />,
  );
  expect(html).toContain('قرارداد');
  expect(html).not.toContain('PDF');
  expect(html).not.toContain('خروجی قرارداد');
});

it('preserves explicit action labels', () => {
  const html = renderToStaticMarkup(
    <ContractOutputButton contractId="synthetic" label="قرارداد" />,
  );
  expect(html).toContain('قرارداد');
});

it.each(['own', 'branch', 'all'])(
  'exposes output for an authorized %s reader without export permission',
  (scope) => {
    access.permissions = ['sales.contracts.read.' + scope];
    const html = renderToStaticMarkup(
      <ContractOutputButton
        contractId="synthetic"
        ownerUserId={scope === 'own' ? 'reader' : 'seller'}
        branchId="branch"
      />,
    );
    expect(html).toContain('<button');
  },
);
it('keeps own-only output hidden for another owner or branch', () => {
  access.permissions = ['sales.contracts.read.own'];
  expect(
    renderToStaticMarkup(
      <ContractOutputButton
        contractId="synthetic"
        ownerUserId="other"
        branchId="branch"
      />,
    ),
  ).not.toContain('<button');
  expect(
    renderToStaticMarkup(
      <ContractOutputButton
        contractId="synthetic"
        ownerUserId="reader"
        branchId="other"
      />,
    ),
  ).not.toContain('<button');
});
