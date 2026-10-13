import { describe, expect, it, vi } from 'vitest';
import { ReservationRequestsController } from './reservations-runtime.module';
import {
  voucherTextKeys,
  voucherFlagKeys,
  voucherNumberKeys,
  type TravelWorkflowCommandV1,
  type VoucherSettingsV1,
} from '@nora/contracts';
import { validateVoucherSettings } from './voucher-settings';

function setup(sent = true) {
  const detail = vi.fn().mockResolvedValue({
    workflow: {
      sentSupplierFormSettings: sent ? { brokerId: 'broker' } : undefined,
      voucherSettings: { brokerId: 'broker', leaderId: 'leader' },
    },
  });
  const update = vi.fn().mockImplementation(async (_id, input) => input);
  const voucherLeaderContact = vi.fn().mockResolvedValue({
    data: {
      id: 'leader',
      name: 'Canonical leader',
      phone: null,
      board: 'Canonical board',
    },
  });
  const controller = new ReservationRequestsController(
    {} as never,
    {} as never,
    {} as never,
    { detail, update } as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    {
      voucherBrokerName: vi.fn().mockResolvedValue('Canonical broker'),
      voucherLeaderContact,
    } as never,
  );
  const request = {
    actor: {
      userId: 'operator',
      branchIds: ['branch'],
      permissions: ['reservations.read', 'reservations.documents.manage'],
    },
  } as never;
  return { controller, request, update, voucherLeaderContact };
}

describe('voucher directory snapshot and sent-form gate', () => {
  it('validates and persists a canonical 300-character Board and child-band snapshot end to end', async () => {
    const s = setup();
    s.voucherLeaderContact.mockResolvedValueOnce({
      data: {
        id: '20000000-0000-4000-8000-000000000002',
        name: 'Leader',
        phone: null,
        board: 'B'.repeat(300),
      },
    });
    s.update.mockImplementation(async (_id, input) =>
      validateVoucherSettings(input.voucherSettings, ['p']),
    );
    const voucherSettings: VoucherSettingsV1 = {
      brokerId: '10000000-0000-4000-8000-000000000001',
      leaderId: '20000000-0000-4000-8000-000000000002',
      text: Object.fromEntries(
        voucherTextKeys.map((key) => [key, '']),
      ) as VoucherSettingsV1['text'],
      flags: Object.fromEntries(
        voucherFlagKeys.map((key) => [key, true]),
      ) as VoucherSettingsV1['flags'],
      numbers: Object.fromEntries(
        voucherNumberKeys.map((key) => [key, 0]),
      ) as VoucherSettingsV1['numbers'],
      passengers: [
        {
          id: 'p',
          selected: true,
          roomType: 'DBL',
          age: 'CHD',
          hotelChildAgeBand: 'CHD_2_TO_6',
        },
      ],
    };
    const result = await s.controller.workflowUpdate(
      'intake',
      {
        action: 'VOUCHER_SETTINGS',
        expectedVersion: 1,
        note: 'Synthetic',
        voucherSettings,
      },
      s.request,
    );
    expect(result.data).toMatchObject({
      text: { transferBoard: 'B'.repeat(300), leaderPhone: '' },
      passengers: [{ hotelChildAgeBand: 'CHD_2_TO_6' }],
    });
  });
  it('saves the authoritative Board/name/contact instead of client-supplied values', async () => {
    const s = setup();
    const input = {
      action: 'VOUCHER_SETTINGS',
      expectedVersion: 1,
      note: 'Synthetic selection',
      voucherSettings: {
        brokerId: 'broker',
        leaderId: 'leader',
        text: {
          broker: 'Client',
          leaderName: 'Client',
          leaderPhone: 'Client',
          transferBoard: 'Client',
        },
        flags: { tourLeader: false },
      },
    } as unknown as TravelWorkflowCommandV1;
    await s.controller.workflowUpdate('intake', input, s.request);
    expect(s.update).toHaveBeenCalledWith(
      'intake',
      expect.objectContaining({
        voucherSettings: expect.objectContaining({
          text: expect.objectContaining({
            broker: 'Canonical broker',
            leaderName: 'Canonical leader',
            leaderPhone: '',
            transferBoard: 'Canonical board',
          }),
          flags: { tourLeader: true },
        }),
      }),
      expect.anything(),
    );
  });
  it.each(['CONFIRM_SUPPLIER', 'ISSUE_VOUCHER'] as const)(
    'rejects %s before the reservation form was sent',
    async (action) => {
      const s = setup(false);
      await expect(
        s.controller.workflowUpdate(
          'intake',
          { action, expectedVersion: 1, note: 'Synthetic' },
          s.request,
        ),
      ).rejects.toThrow('ابتدا فرم رزرواسیون');
      expect(s.update).not.toHaveBeenCalled();
      expect(s.voucherLeaderContact).not.toHaveBeenCalled();
    },
  );
});
