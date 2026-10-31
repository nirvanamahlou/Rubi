import { beforeEach, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
import type { TravelWorkflowCommandV1 } from '@nora/contracts';
function setup() {
  const current = initialTravelWorkflow();
  const create = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    reservationWorkflowRevision: {
      findFirst: vi.fn(async () => ({ state: current })),
      create,
    },
  };
  const db = {
    client: {
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
  };
  const entities = {
    current: vi.fn(async () => ({
      data: {
        legalEntity: {
          id: 'issuer',
          persianName: 'Issuer',
          code: 'JAHAN_BASTAN',
          logoFileId: 'saved-logo',
        },
      },
    })),
  };
  const service = new TravelWorkflowService(
    db as never,
    entities as never,
    {} as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    contractId: 'contract',
    snapshot: { passengerIds: [], serviceSelections: [] },
    workflow: current,
  } as never);
  const actor = {
    userId: 'actor',
    permissions: ['reservations.documents.manage'],
    branchIds: ['branch'],
  };
  const command: TravelWorkflowCommandV1 = {
    action: 'BRANDING',
    note: 'انتخاب سربرگ خروجی',
    expectedVersion: 0,
    branding: { kind: 'OWN', ticketWithoutLogo: true },
  };
  return { service, current, command, actor, create, entities };
}
beforeEach(() => vi.restoreAllMocks());
it('persists explicit ticket-only suppression while retaining canonical issuer/logo for other documents and permits restoring normal branding', async () => {
  const s = setup();
  const result = await s.service.update('intake', s.command, s.actor as never);
  expect(result.branding).toEqual({
    kind: 'OWN',
    referenceId: 'issuer',
    name: 'Issuer',
    companyCode: 'JAHAN_BASTAN',
    logoFileId: 'saved-logo',
    ticketWithoutLogo: true,
  });
  expect(s.create.mock.calls[0]![0].data.state.branding).toEqual(
    result.branding,
  );
  Object.assign(s.current, result);
  const restored = await s.service.update(
    'intake',
    {
      ...s.command,
      expectedVersion: 1,
      branding: { kind: 'OWN', ticketWithoutLogo: false },
    },
    s.actor as never,
  );
  expect(restored.branding).not.toHaveProperty('ticketWithoutLogo');
  expect(restored.branding!.logoFileId).toBe('saved-logo');
});
it('retains permission/version checks and rejects malformed suppression flags', async () => {
  const s = setup();
  await expect(
    s.service.update('intake', s.command, {
      ...s.actor,
      permissions: [],
    } as never),
  ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(
    s.service.update(
      'intake',
      { ...s.command, expectedVersion: 9 },
      s.actor as never,
    ),
  ).rejects.toBeInstanceOf(ConflictException);
  for (const value of ['true', 0, null])
    await expect(
      s.service.update(
        'intake',
        {
          ...s.command,
          branding: { kind: 'OWN', ticketWithoutLogo: value },
        } as unknown as TravelWorkflowCommandV1,
        s.actor as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  expect(s.create).not.toHaveBeenCalled();
});

it('keeps ticket and voucher suppression independent across versioned branding saves', async () => {
  const s = setup();
  const save = async (
    branding: NonNullable<TravelWorkflowCommandV1['branding']>,
  ) => {
    const result = await s.service.update(
      'intake',
      { ...s.command, expectedVersion: s.current.version, branding },
      s.actor as never,
    );
    Object.assign(s.current, result);
    return result;
  };
  expect(
    (await save({ kind: 'OWN', ticketWithoutLogo: true })).branding,
  ).toHaveProperty('ticketWithoutLogo', true);
  const voucher = await save({ kind: 'OWN', voucherWithoutLogo: true });
  expect(voucher.branding).toMatchObject({
    ticketWithoutLogo: true,
    voucherWithoutLogo: true,
  });
  const normalVoucher = await save({ kind: 'OWN', voucherWithoutLogo: false });
  expect(normalVoucher.branding).toHaveProperty('ticketWithoutLogo', true);
  expect(normalVoucher.branding).not.toHaveProperty('voucherWithoutLogo');
  const restored = await save({ kind: 'OWN', ticketWithoutLogo: false });
  expect(restored.branding).not.toHaveProperty('ticketWithoutLogo');
});
