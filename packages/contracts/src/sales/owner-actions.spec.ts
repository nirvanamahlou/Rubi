import type { AuthenticatedActor } from '../iam';
import { expect, it } from 'vitest';
import {
  hasSalesContractSelfService,
  canCorrectSalesContract,
  canSelfServeSalesContract,
} from './owner-actions';
import {
  denyPermission,
  MANUAL_ACCESS_VERSION,
  screenPermission,
} from '../iam';
const actor: Pick<AuthenticatedActor, 'userId' | 'branchIds' | 'permissions'> =
  {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: ['sales.contracts.create'],
  };
it('allows a contract creator to operate only their own contracts in an allowed branch', () => {
  expect(hasSalesContractSelfService(actor.permissions)).toBe(true);
  expect(
    hasSalesContractSelfService([
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      screenPermission('sales.new-contract'),
    ]),
  ).toBe(true);
  expect(
    canSelfServeSalesContract(actor, {
      ownerUserId: 'owner',
      branchId: 'branch',
    }),
  ).toBe(true);
  expect(
    canSelfServeSalesContract(actor, {
      ownerUserId: 'other',
      branchId: 'branch',
    }),
  ).toBe(false);
  expect(
    canSelfServeSalesContract(actor, {
      ownerUserId: 'owner',
      branchId: 'other',
    }),
  ).toBe(false);
});
it('does not infer contract actions from unrelated or denied/manual screens', () => {
  expect(hasSalesContractSelfService(['finance.read'])).toBe(false);
  expect(
    hasSalesContractSelfService([
      'sales.contracts.create',
      denyPermission('sales.home'),
      denyPermission('sales.new-contract'),
    ]),
  ).toBe(false);
  expect(
    hasSalesContractSelfService([
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      screenPermission('customers.home'),
    ]),
  ).toBe(false);
});
it('allows scoped contract-area readers to manage their own contract without granting financial approval', () => {
  expect(hasSalesContractSelfService(['sales.contracts.read.own'])).toBe(true);
  expect(actor.permissions).toEqual(['sales.contracts.create']);
});

it.each(['sales.contracts.read.branch', 'sales.contracts.read.all'])(
  'permits correction of visible contracts for %s without widening owner-only actions',
  (permission) => {
    const reader = { ...actor, permissions: [permission] };
    const other = { ownerUserId: 'other', branchId: 'branch' };
    expect(canCorrectSalesContract(reader, other)).toBe(true);
    expect(canSelfServeSalesContract(reader, other)).toBe(false);
    expect(canCorrectSalesContract({ ...reader, branchIds: [] }, other)).toBe(
      false,
    );
    expect(
      canCorrectSalesContract(
        {
          ...reader,
          permissions: [
            permission,
            denyPermission('sales.home'),
            denyPermission('sales.new-contract'),
          ],
        },
        other,
      ),
    ).toBe(false);
  },
);
it.each(['sales.contracts.read.own', 'sales.contracts.create'])(
  'keeps %s correction limited to owned contracts',
  (permission) => {
    const reader = { ...actor, permissions: [permission] };
    expect(
      canCorrectSalesContract(reader, {
        ownerUserId: 'owner',
        branchId: 'branch',
      }),
    ).toBe(true);
    expect(
      canCorrectSalesContract(reader, {
        ownerUserId: 'other',
        branchId: 'branch',
      }),
    ).toBe(false);
  },
);
it('does not grant correction from unrelated read permissions', () => {
  expect(
    canCorrectSalesContract(
      { ...actor, permissions: ['finance.read', 'reservations.read'] },
      { ownerUserId: 'owner', branchId: 'branch' },
    ),
  ).toBe(false);
});
