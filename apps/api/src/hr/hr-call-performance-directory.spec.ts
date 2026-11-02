import { describe, it, expect, vi } from 'vitest';
import { callPerformanceStaff } from './hr-call-performance-directory';
describe('HR expert report public boundary', () => {
  it('returns all physical extensions for canonical accounts and applies branch/user scope', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        {
          userId: 'u',
          name: 'Synthetic',
          records: [{ values: ['001', '002', null, 5] }],
        },
      ]);
    expect(
      await callPerformanceStaff(
        { hrEmployee: { findMany } } as never,
        'branch',
        ['u'],
      ),
    ).toEqual([{ id: 'u', name: 'Synthetic', extensions: ['001', '002'] }]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch',
          deletedAt: null,
          status: 'فعال',
          userId: { in: ['u'] },
        }),
      }),
    );
  });
  it('fails closed rather than truncating roster', async () => {
    await expect(
      callPerformanceStaff(
        { hrEmployee: { findMany: async () => Array(1001).fill({}) } } as never,
        'b',
        null,
      ),
    ).rejects.toThrow('STAFF_REPORT_LIMIT');
  });
});
