import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { MANUAL_ACCESS_VERSION } from '@nora/contracts';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { readSettledHotelContracts } from '../sales/settled-hotel-contracts.public';
import {
  pendingVoucherPage,
  SettledVouchersController,
} from './settled-vouchers.controller';
import type { VoucherEvidence } from '../reservations/voucher-coverage.public';

const stay = (key: string) => ({
  key,
  hotelId: 'hotel-' + key,
  hotelName: 'Hotel ' + key,
  checkInDate: '2026-11-21',
  checkOutDate: '2026-11-24',
});
const one = stay('A'),
  two = stay('B');
const contract = {
  contractId: 'c',
  branchId: 'b',
  contractNumber: 'S1',
  floating: false,
  stays: [one, two],
};
const record: VoucherEvidence = {
  contractId: 'c',
  intakeId: 'i',
  branchId: 'b',
  hasRevision: true,
  supplierStatus: 'CONFIRMED',
  issued: 'true',
  coverage: [one],
};

it('counts only the second hotel when one of two has an issuance receipt, pages by stay, and rechecks amended dates', () => {
  expect(pendingVoucherPage([contract], [record], 1, 1)).toMatchObject({
    total: 1,
    unknownStayCount: 0,
    rows: [{ stayKey: 'B' }],
  });
  expect(pendingVoucherPage([contract], [record], 2, 1).rows).toEqual([]);
  const amended = {
    ...contract,
    stays: [{ ...one, checkOutDate: '2026-11-30' }, two],
  };
  expect(pendingVoucherPage([amended], [record], 2, 1)).toMatchObject({
    total: 2,
    rows: [{ stayKey: 'B' }],
  });
});

it('distinguishes unissued stays from legacy or malformed evidence, cancellations and other branches', () => {
  for (const coverage of [null, [null], [{ key: 'A' }]])
    expect(
      pendingVoucherPage([contract], [{ ...record, coverage }], 1, 10),
    ).toMatchObject({ total: 0, unknownStayCount: 2 });
  for (const e of [
    { ...record, branchId: 'other' },
    { ...record, supplierStatus: 'CANCELLED' },
  ])
    expect(pendingVoucherPage([contract], [e], 1, 10)).toMatchObject({
      total: 0,
      unknownStayCount: 0,
    });
  expect(
    pendingVoucherPage([contract], [{ ...record, issued: 'false' }], 1, 10),
  ).toMatchObject({ total: 2 });
  expect(
    pendingVoucherPage(
      [{ ...contract, floating: true }],
      [{ ...record, issued: 'false' }],
      1,
      10,
    ),
  ).toMatchObject({ total: 0, unknownStayCount: 2 });
});

it('restricts settled contracts to both panel visibility rules, selected company and branch, without using a global Nora grant', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  await readSettledHotelContracts(
    { salesContract: { findMany } } as never,
    ['branch'],
    'company',
  );
  expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
    legalEntityId: 'company',
    branchId: { in: ['branch'] },
    hiddenAt: null,
    financeHiddenAt: null,
    reservationHiddenAt: null,
    settlementStatus: { in: ['SETTLED', 'OVERPAID'] },
  });
  const db = { $transaction: vi.fn() };
  const companies = { selected: vi.fn() };
  const c = new SettledVouchersController(
    { client: db } as never,
    {} as never,
    companies as never,
  );
  const req = {
    actor: { permissions: ['finance.read', 'reservations.read'] },
  } as unknown as AuthenticatedRequest;
  await expect(c.report(req)).rejects.toThrow();
  req.actor.permissions.push(
    'finance.financial_release.read',
    MANUAL_ACCESS_VERSION,
  );
  await expect(c.report(req)).rejects.toThrow();
  expect(companies.selected).not.toHaveBeenCalled();
  expect(db.$transaction).not.toHaveBeenCalled();
});

it('rechecks native company and branch before releasing a report and checks export permissions separately', async () => {
  const req = {
    actor: {
      userId: 'user',
      sessionId: 'session',
      branchIds: ['branch'],
      permissions: [
        'finance.read',
        'finance.financial_release.read',
        'reservations.read',
      ],
    },
  } as unknown as AuthenticatedRequest;
  const tx = { salesContract: { findMany: vi.fn().mockResolvedValue([]) } };
  const client = {
    $transaction: vi.fn(async (run: (db: typeof tx) => unknown) => run(tx)),
  };
  const iam = {
    authenticateSessionReferenceV1: vi.fn().mockResolvedValue(req.actor),
  };
  const companies = { selected: vi.fn().mockResolvedValue('company') };
  const controller = new SettledVouchersController(
    { client } as never,
    iam as never,
    companies as never,
  );
  await expect(controller.report(req)).resolves.toMatchObject({
    total: 0,
    unknownStayCount: 0,
    rows: [],
  });
  await expect(controller.export(req)).rejects.toThrow();
  companies.selected
    .mockResolvedValueOnce('company')
    .mockResolvedValueOnce('new-company');
  await expect(controller.report(req)).rejects.toThrow();
  iam.authenticateSessionReferenceV1.mockResolvedValueOnce({
    ...req.actor,
    branchIds: [],
  });
  await expect(controller.report(req)).rejects.toThrow();
  await expect(controller.report(req, '1', '51')).rejects.toThrow();
});
