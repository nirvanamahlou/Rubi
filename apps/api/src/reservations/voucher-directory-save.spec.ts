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
  const currencyReference = vi.fn().mockResolvedValue({ code: 'JPY' });
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
      currencyReference,
    } as never,
  );
  const request = {
    actor: {
      userId: 'operator',
      branchIds: ['branch'],
      permissions: ['reservations.read', 'reservations.documents.manage'],
    },
  } as never;
  return {
    controller,
    request,
    update,
    voucherLeaderContact,
    currencyReference,
    detail,
  };
}

describe('voucher directory snapshot and sent-form gate', () => {
  it('validates every chosen quotation currency through the request-scoped registered directory', async () => {
    const s = setup();
    const input = {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: 1,
      voucherSettings: {
        supplierFormPrices: {
          pp: { amount: '1', currencyCode: 'JPY' },
          ratio: { amount: '2', currencyCode: 'JPY' },
        },
      },
    } as never;
    await s.controller.workflowUpdate('intake', input, s.request);
    expect(s.currencyReference).toHaveBeenCalledExactlyOnceWith('JPY');
    s.update.mockClear();
    s.currencyReference.mockRejectedValueOnce(new Error('Unknown currency'));
    await expect(
      s.controller.workflowUpdate('intake', input, s.request),
    ).rejects.toThrow('Unknown currency');
    expect(s.update).not.toHaveBeenCalled();
  });
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

it('validates a separate transfer supplier while preserving explicit per-voucher details', async () => {
  const s = setup();
  const input = {
    action: 'VOUCHER_SETTINGS',
    expectedVersion: 1,
    note: '',
    voucherSettings: {
      brokerId: 'hotel-broker',
      transferBrokerId: 'transfer-broker',
      leaderId: 'leader',
      transferDetailsOverride: true,
      text: {
        broker: '',
        leaderName: 'SPECIAL LEADER',
        leaderPhone: 'SPECIAL PHONE',
        transferBoard: 'SPECIAL BOARD',
      },
      flags: { tourLeader: false },
    },
  } as unknown as TravelWorkflowCommandV1;
  await s.controller.workflowUpdate('intake', input, s.request);
  expect(s.voucherLeaderContact).toHaveBeenCalledWith(
    'transfer-broker',
    'leader',
    expect.anything(),
  );
  expect(s.update).toHaveBeenCalledWith(
    'intake',
    expect.objectContaining({
      voucherSettings: expect.objectContaining({
        brokerId: 'hotel-broker',
        transferBrokerId: 'transfer-broker',
        transferDetailsOverride: true,
        text: expect.objectContaining({
          broker: 'Canonical broker',
          leaderName: 'SPECIAL LEADER',
          leaderPhone: 'SPECIAL PHONE',
          transferBoard: 'SPECIAL BOARD',
        }),
      }),
    }),
    expect.anything(),
  );
});

it.each(['CONFIRM_SUPPLIER', 'ISSUE_VOUCHER'] as const)(
  'permits %s without a leader for a voucher without transfer',
  async (action) => {
    const s = setup();
    s.detail.mockResolvedValue({
      workflow: {
        sentSupplierFormSettings: { brokerId: 'broker' },
        voucherSettings: { brokerId: 'broker', flags: { transfer: false } },
      },
    });
    await s.controller.workflowUpdate(
      'intake',
      { action, expectedVersion: 1, note: '' },
      s.request,
    );
    expect(s.update).toHaveBeenCalled();
    expect(s.voucherLeaderContact).not.toHaveBeenCalled();
  },
);

it('keeps contact authorization mandatory even when manual overrides are requested', async () => {
  const s = setup();
  s.voucherLeaderContact.mockRejectedValueOnce(
    new Error('Contact is not authorized'),
  );
  await expect(
    s.controller.workflowUpdate(
      'intake',
      {
        action: 'VOUCHER_SETTINGS',
        expectedVersion: 1,
        note: '',
        voucherSettings: {
          brokerId: 'broker',
          leaderId: 'foreign-leader',
          transferDetailsOverride: true,
          text: { broker: '', leaderName: 'MANUAL' },
          flags: {},
        } as never,
      },
      s.request,
    ),
  ).rejects.toThrow('Contact is not authorized');
  expect(s.update).not.toHaveBeenCalled();
});

it('preserves an independent transfer supplier when an older editor omits the new fields', async () => {
  const s = setup();
  s.detail.mockResolvedValue({
    workflow: {
      sentSupplierFormSettings: { brokerId: 'broker' },
      voucherSettings: {
        brokerId: 'broker',
        leaderId: 'leader',
        transferBrokerId: 'transfer-broker',
        transferDetailsOverride: true,
      },
    },
  });
  await s.controller.workflowUpdate(
    'intake',
    {
      action: 'VOUCHER_SETTINGS',
      expectedVersion: 1,
      note: '',
      voucherSettings: {
        brokerId: 'broker',
        leaderId: 'leader',
        text: {
          broker: '',
          leaderName: 'KEPT',
          leaderPhone: '',
          transferBoard: 'KEPT BOARD',
        },
        flags: {},
      } as never,
    },
    s.request,
  );
  expect(s.voucherLeaderContact).toHaveBeenCalledWith(
    'transfer-broker',
    'leader',
    expect.anything(),
  );
  expect(s.update).toHaveBeenCalledWith(
    'intake',
    expect.objectContaining({
      voucherSettings: expect.objectContaining({
        transferBrokerId: 'transfer-broker',
        transferDetailsOverride: true,
        text: expect.objectContaining({ transferBoard: 'KEPT BOARD' }),
      }),
    }),
    expect.anything(),
  );
});
