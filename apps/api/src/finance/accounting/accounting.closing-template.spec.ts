import { describe, expect, it, vi } from 'vitest';
import { AccountingService } from './accounting.service';
const id = '10000000-0000-4000-8000-000000000001';
const accountId = '10000000-0000-4000-8000-000000000002';
const service = Object.create(AccountingService.prototype) as AccountingService;
const fixture = () => {
  const create = vi.fn().mockResolvedValue({});
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  const tx = {
    accountingTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
      create,
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id, attributes: {}, lines: [] }),
    },
    accountingTemplateLine: { createMany },
    accountingAccount: {
      findFirst: vi.fn().mockResolvedValue({ id: accountId, attributes: {} }),
    },
  };
  const payload = {
    kind: 'CLOSING',
    sourceForm: 'rahkaran-closing-v1',
    code: '1',
    title: 'Closing',
    active: false,
    lines: [
      { accountId, role: 'TARGET', percentage: '100', include: true },
      { accountId, role: 'SOURCE', include: false, parentPosition: 0 },
    ],
  };
  const save = (p: Record<string, unknown> = payload) =>
    service['execute'](
      tx as unknown as Parameters<(typeof service)['execute']>[0],
      { id } as Parameters<(typeof service)['execute']>[1],
      'save-template',
      p,
      1,
      {} as Parameters<(typeof service)['execute']>[5],
    );
  return { tx, payload, save, create, createMany };
};
describe('observed closing template persistence', () => {
  it('persists counterpart assignments and inclusion rows without inferred header accounts', async () => {
    const f = fixture();
    await f.save();
    expect(f.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherTypeId: null,
        retainedAccountId: null,
        active: false,
        attributes: expect.objectContaining({
          sourceForm: 'rahkaran-closing-v1',
          sourceAssignments: '{"1":0}',
        }),
      }),
    });
    expect(f.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          role: 'TARGET',
          percentage: '100',
          include: true,
        }),
        expect.objectContaining({ role: 'SOURCE', include: false }),
      ],
    });
    expect(f.tx.accountingAccount.findFirst).toHaveBeenCalledWith({
      where: { id: accountId, bookId: id, active: true, level: 'SUBSIDIARY' },
    });
  });
  it('rejects roles from a different source form before writing', async () => {
    const f = fixture();
    f.payload.lines[0]!.role = 'OFFSET';
    await expect(f.save()).rejects.toThrow();
    expect(f.create).not.toHaveBeenCalled();
  });
  it('does not reinterpret an existing legacy template', async () => {
    const f = fixture();
    f.tx.accountingTemplate.findFirst.mockResolvedValue({
      id,
      version: 1,
      attributes: {},
    } as never);
    await expect(f.save({ ...f.payload, id })).rejects.toThrow();
    expect(f.create).not.toHaveBeenCalled();
  });
  it('rejects inferred header fields', async () => {
    const f = fixture();
    await expect(
      f.save({ ...f.payload, retainedAccountId: accountId }),
    ).rejects.toThrow();
    expect(f.create).not.toHaveBeenCalled();
  });
});
