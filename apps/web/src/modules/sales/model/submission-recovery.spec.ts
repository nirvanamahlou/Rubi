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
const payload = { branchId: 'example' } as SalesContractCreateRequest;
afterEach(() => vi.resetAllMocks());
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
    submitOrRecover({ ...payload, branchId: 'different' }, null, memory),
  ).rejects.toThrow();
  expect(salesApi.create).toHaveBeenCalledTimes(1);
});
