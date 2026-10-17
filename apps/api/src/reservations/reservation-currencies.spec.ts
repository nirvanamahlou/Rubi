import { expect, it, vi } from 'vitest';
import { ReservationRequestsController } from './reservations-runtime.module';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';

it('publishes only active master-data currency reference fields', async () => {
  const list = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'currency',
        code: 'EUR',
        name: 'Euro',
        attributes: { unrelated: 'private' },
      },
    ],
    meta: { total: 1 },
  });
  const directory = new MasterTravelDirectory({ list } as never);
  expect(await directory.voucherCurrencies(2)).toEqual({
    data: [{ id: 'currency', code: 'EUR', name: 'Euro' }],
    meta: { total: 1 },
  });
  expect(list).toHaveBeenCalledWith(
    'currencies',
    expect.objectContaining({ status: 'active', page: 2, pageSize: 100 }),
  );
});
it('requires native Reservations read and actual request branch access without requiring Master Data grants', async () => {
  const detail = vi.fn().mockResolvedValue({});
  const voucherCurrencies = vi
    .fn()
    .mockResolvedValue({ data: [], meta: { total: 0 } });
  const controller = new ReservationRequestsController(
    {} as never,
    {} as never,
    {} as never,
    { detail } as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    { voucherCurrencies } as never,
  );
  const request = {
    actor: { permissions: ['reservations.read'], branchIds: ['branch'] },
  } as never;
  await controller.voucherCurrencies('request', request, '1');
  expect(detail).toHaveBeenCalledWith('request', ['branch']);
  expect(voucherCurrencies).toHaveBeenCalledWith(1);
  voucherCurrencies.mockClear();
  await expect(
    controller.voucherCurrencies(
      'request',
      { actor: { permissions: [], branchIds: ['branch'] } } as never,
      '1',
    ),
  ).rejects.toThrow();
  expect(voucherCurrencies).not.toHaveBeenCalled();
  await expect(
    controller.voucherCurrencies('request', request, '0'),
  ).rejects.toThrow('صفحه معتبر نیست');
  expect(voucherCurrencies).not.toHaveBeenCalled();
  detail.mockRejectedValueOnce(new Error('outside branch'));
  await expect(
    controller.voucherCurrencies('other-request', request, '1'),
  ).rejects.toThrow('outside branch');
  expect(voucherCurrencies).not.toHaveBeenCalled();
});
