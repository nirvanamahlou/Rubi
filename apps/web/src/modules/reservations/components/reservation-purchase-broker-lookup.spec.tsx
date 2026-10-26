import { beforeEach, expect, it, vi } from 'vitest';
import { searchOptions } from '@/components/ui/search-combobox';
import { travelRequest } from './travel-workflow-form';
import {
  loadPurchaseBrokers,
  purchaseBrokerOption,
  selectedPurchaseBrokerLabel,
} from './reservation-purchase-broker-lookup';

vi.mock('./travel-workflow-form', () => ({ travelRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it('displays the registered English name while searching by either name', () => {
  const option = purchaseBrokerOption({
    id: 'broker',
    name: 'کارگزار نمونه',
    englishName: '  Example Travel  ',
  });
  expect(option).toMatchObject({ value: 'broker', label: 'Example Travel' });
  expect(searchOptions([option], 'نمونه')).toEqual([option]);
  expect(searchOptions([option], 'example')).toEqual([option]);
  expect(
    selectedPurchaseBrokerLabel([option], { id: 'broker', name: 'نام قدیمی' }),
  ).toBe('Example Travel');
});

it('uses a display-only Latin transcription when English is missing and preserves historical selections', () => {
  expect(
    purchaseBrokerOption({ id: 'broker', name: 'نام موجود', englishName: '  ' })
      .label,
  ).not.toMatch(/[\u0600-\u06ff]/u);
  expect(purchaseBrokerOption({ id: 'broker', name: 'Existing' }).label).toBe(
    'Existing',
  );
  expect(
    selectedPurchaseBrokerLabel([], {
      id: 'archived',
      name: 'Archived supplier',
    }),
  ).toBe('Archived supplier');
  expect(selectedPurchaseBrokerLabel([], null)).toBeUndefined();
  expect(
    selectedPurchaseBrokerLabel([], { id: 'archived', name: 'جی تی اس' }),
  ).toBe('GTS');
  const option = purchaseBrokerOption({ id: 'broker', name: 'دی تور' });
  expect(option.label).toBe('D Tour');
  expect(searchOptions([option], 'دی')).toEqual([option]);
  expect(searchOptions([option], 'D Tour')).toEqual([option]);
});

it('loads every authorized directory page including a saved broker beyond page one', async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({
    id: `broker-${i}`,
    name: `Supplier ${i}`,
  }));
  vi.mocked(travelRequest)
    .mockResolvedValueOnce({ data: first, meta: { total: 101 } })
    .mockResolvedValueOnce({
      data: [{ id: 'last', name: 'آخرین', englishName: 'Last Travel' }],
      meta: { total: 101 },
    });
  const options = await loadPurchaseBrokers('request');
  expect(options).toHaveLength(101);
  expect(travelRequest).toHaveBeenNthCalledWith(
    1,
    'reservations/requests/request/voucher-brokers?page=1',
  );
  expect(travelRequest).toHaveBeenNthCalledWith(
    2,
    'reservations/requests/request/voucher-brokers?page=2',
  );
  expect(
    selectedPurchaseBrokerLabel(options, { id: 'last', name: 'آخرین' }),
  ).toBe('Last Travel');
});

it('stops on an empty page and propagates directory errors instead of inventing options', async () => {
  vi.mocked(travelRequest).mockResolvedValueOnce({
    data: [],
    meta: { total: 20 },
  });
  expect(await loadPurchaseBrokers('request')).toEqual([]);
  vi.mocked(travelRequest).mockRejectedValueOnce(new Error('Forbidden'));
  await expect(loadPurchaseBrokers('request')).rejects.toThrow('Forbidden');
});
