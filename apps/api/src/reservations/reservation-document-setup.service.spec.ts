import { describe, expect, it, vi } from 'vitest';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type AuthenticatedActor,
  type VoucherSettingsV1,
} from '@nora/contracts';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
const id = '11111111-1111-4111-8111-111111111111',
  leaderId = '22222222-2222-4222-8222-222222222222';
const settings = (): VoucherSettingsV1 => ({
  references: { brokerId: id, leaderId },
  text: Object.fromEntries(
    voucherTextKeys.map((k) => [k, '']),
  ) as VoucherSettingsV1['text'],
  numbers: Object.fromEntries(
    voucherNumberKeys.map((k) => [k, 0]),
  ) as VoucherSettingsV1['numbers'],
  flags: Object.fromEntries(
    voucherFlagKeys.map((k) => [k, true]),
  ) as VoucherSettingsV1['flags'],
  passengers: [{ id: 'p', selected: true, age: 'ADL', roomType: 'DBL' }],
});
const actor = {
  userId: id,
  branchIds: [id],
  permissions: ['reservations.documents.manage'],
} as unknown as AuthenticatedActor;
function fixture() {
  const state = {
    ...initialTravelWorkflow(),
    supplierFormPrepared: true,
    supplierFormSettings: settings(),
  };
  const create = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    reservationWorkflowRevision: {
      findFirst: vi.fn().mockResolvedValue({ state }),
      create,
    },
  };
  const database = {
    client: {
      $transaction: vi
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    },
  };
  const brokerReference = vi
    .fn()
    .mockResolvedValue({ id, name: 'CANONICAL BROKER' });
  const voucherLeaderReference = vi
    .fn()
    .mockResolvedValue({
      id: leaderId,
      name: 'CANONICAL GUIDE',
      phone: '+905550000000',
      board: 'CANONICAL BOARD',
      language: 'English',
    });
  const service = new TravelWorkflowService(
    database as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { brokerReference } as never,
    { voucherLeaderReference } as never,
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    id,
    branchId: id,
    salesOwnerUserId: null,
    snapshot: { passengerIds: ['p'] },
    workflow: state,
  } as never);
  return { service, create, brokerReference, voucherLeaderReference };
}
describe('reservation document preparation public boundary', () => {
  it('overwrites supplied display data with selected canonical broker and leader data', async () => {
    const { service, create } = fixture();
    const draft = settings();
    draft.text.leaderPhone = 'FORGED';
    draft.text.broker = 'FORGED';
    draft.text.transferBoard = 'FORGED';
    const result = await service.update(
      id,
      {
        action: 'VOUCHER_SETTINGS',
        expectedVersion: 0,
        note: 'Save guide',
        voucherSettings: draft,
      },
      actor,
    );
    expect(result.voucherSettings?.text).toMatchObject({
      broker: 'CANONICAL BROKER',
      leaderName: 'CANONICAL GUIDE',
      leaderPhone: '+905550000000',
      transferBoard: 'CANONICAL BOARD',
    });
    expect(create).toHaveBeenCalledOnce();
    expect(draft.text.leaderPhone).toBe('FORGED');
    expect(result.updatedByUserId).toBe(actor.userId);
  });
  it('prepares the form with version, actor and real broker while leaving sales allocations untouched', async () => {
    const { service, create } = fixture();
    const draft = settings();
    delete draft.references!.leaderId;
    const result = await service.update(
      id,
      {
        action: 'PREPARE_SUPPLIER_FORM',
        expectedVersion: 0,
        note: 'Prepare form',
        voucherSettings: draft,
      },
      actor,
    );
    expect(result.supplierFormPrepared).toBe(true);
    expect(result.supplierFormSettings?.text.broker).toBe('CANONICAL BROKER');
    expect(result.voucherSettings).toBeUndefined();
    expect(result.version).toBe(1);
    expect(create.mock.calls[0]?.[0].data.actorUserId).toBe(actor.userId);
  });
  it('rejects unauthorized writes and mismatched voucher broker without persistence', async () => {
    const { service, create, brokerReference } = fixture();
    await expect(
      service.update(
        id,
        {
          action: 'VOUCHER_SETTINGS',
          expectedVersion: 0,
          note: 'Save',
          voucherSettings: settings(),
        },
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow();
    expect(brokerReference).not.toHaveBeenCalled();
    const bad = settings();
    bad.references!.brokerId = '33333333-3333-4333-8333-333333333333';
    await expect(
      service.update(
        id,
        {
          action: 'VOUCHER_SETTINGS',
          expectedVersion: 0,
          note: 'Save',
          voucherSettings: bad,
        },
        actor,
      ),
    ).rejects.toThrow('همان کارگزار');
    expect(create).not.toHaveBeenCalled();
  });
});
