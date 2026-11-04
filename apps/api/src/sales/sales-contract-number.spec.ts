import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import {
  allocateSalesContractNumber,
  retrySalesContractCreate,
} from './sales-contract-number';

describe('transactional contract numbering', () => {
  it('allocates a six-digit number using the caller transaction', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ value: 120310 }]) };
    expect(
      await allocateSalesContractNumber(
        tx as unknown as Prisma.TransactionClient,
      ),
    ).toBe('120310');
  });

  it('fails closed when the counter is exhausted or missing', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(
      allocateSalesContractNumber(tx as unknown as Prisma.TransactionClient),
    ).rejects.toThrow('numbering is unavailable or exhausted');
  });

  it('retries a known Serializable rollback and returns the successful result', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValue('saved');
    expect(await retrySalesContractCreate(create)).toBe('saved');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each(['P2002', 'P2028', 'ECONNRESET'])(
    'never retries an uncertain result or non-serialization error (%s)',
    async (code) => {
      const error = { code };
      const create = vi.fn().mockRejectedValue(error);
      await expect(retrySalesContractCreate(create)).rejects.toBe(error);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { code: 'P2010', meta: { code: '40001' } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '40001' } } },
    },
    {
      code: 'P2010',
      meta: {
        driverAdapterError: { cause: { kind: 'TransactionWriteConflict' } },
      },
    },
  ])('retries a proven raw-query serialization abort', async (error) => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('saved');
    expect(await retrySalesContractCreate(create)).toBe('saved');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry a raw unique-key violation', async () => {
    const error = { code: 'P2010', meta: { code: '23505' } };
    const create = vi.fn().mockRejectedValue(error);
    await expect(retrySalesContractCreate(create)).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('bounds repeated serialization failures', async () => {
    const error = { code: 'P2034' };
    const create = vi.fn().mockRejectedValue(error);
    await expect(retrySalesContractCreate(create)).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(5);
  });
});
