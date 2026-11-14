import { expect, it, vi, afterEach } from 'vitest';
import type { SalesContractCreateRequest } from '@nora/contracts';
import { submitOrRecover, type Attempt } from './submission-recovery';
import { salesApi } from '../api/client';
vi.mock('../api/client', () => ({
  salesApi: { create: vi.fn(), submissionStatus: vi.fn(), detail: vi.fn() },
  SalesApiError: class extends Error {
    status = 500;
  },
}));
const payload: SalesContractCreateRequest = {
  customerId: 'example',
  tripType: 'ONE_WAY',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2026-11-12',
  services: [],
  passengers: [],
  priceComponents: [],
};
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it('reuses the secure fallback UUID and original payload after an unresolved network response on LAN HTTP', async () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => {
    bytes.fill(42);
    return bytes;
  });
  vi.stubGlobal('crypto', { getRandomValues });
  const memory: { current: Attempt | null } = { current: null };
  vi.mocked(salesApi.create)
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce({ data: { id: 'saved' } } as never);
  vi.mocked(salesApi.submissionStatus).mockResolvedValue({ data: null });
  await expect(submitOrRecover(payload, null, memory)).rejects.toThrow();
  const key = memory.current?.key;
  expect(key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(await submitOrRecover(payload, null, memory)).toMatchObject({
    data: { id: 'saved' },
  });
  expect(vi.mocked(salesApi.create).mock.calls).toEqual([
    [payload, key],
    [payload, key],
  ]);
  expect(getRandomValues).toHaveBeenCalledOnce();
});
it('recovers an acknowledged server record after the create response was lost, without submitting again', async () => {
  const memory: { current: Attempt | null } = { current: null };
  vi.mocked(salesApi.create).mockRejectedValue(new TypeError('offline'));
  vi.mocked(salesApi.submissionStatus).mockResolvedValue({
    data: {
      id: 'saved',
      contractNumber: 'X',
      status: 'DRAFT',
      reservationStatus: 'NOT_SENT',
    },
  } as never);
  vi.mocked(salesApi.detail).mockResolvedValue({
    data: { id: 'saved' },
  } as never);
  expect(await submitOrRecover(payload, null, memory)).toMatchObject({
    data: { id: 'saved' },
  });
  expect(await submitOrRecover(payload, null, memory)).toMatchObject({
    data: { id: 'saved' },
  });
  expect(salesApi.create).toHaveBeenCalledTimes(1);
  expect(salesApi.submissionStatus).toHaveBeenCalledWith(memory.current?.key);
});
it('refuses a different payload while the previous write remains unresolved', async () => {
  const memory: { current: Attempt | null } = { current: null };
  vi.mocked(salesApi.create).mockRejectedValue(new TypeError('offline'));
  vi.mocked(salesApi.submissionStatus).mockResolvedValue({ data: null });
  await expect(submitOrRecover(payload, null, memory)).rejects.toThrow();
  await expect(
    submitOrRecover({ ...payload, customerId: 'different' }, null, memory),
  ).rejects.toThrow();
  expect(salesApi.create).toHaveBeenCalledTimes(1);
});
