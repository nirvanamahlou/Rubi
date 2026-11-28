import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from './accounting.service';

const actor = {
  permissions: [
    'finance.read',
    'finance.journal.read',
    'legal-entity.aggregate.read',
  ],
  branchIds: ['west'],
} as AuthenticatedActor;
function setup(isAggregate: boolean) {
  const journal = {
    count: vi.fn().mockResolvedValue(1),
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: 'j', number: 5, book: { branchId: 'west', legalEntityId: 'c' } },
      ]),
  };
  const db = {
    client: {
      accountingJournal: journal,
      $transaction: (calls: Promise<unknown>[]) => Promise.all(calls),
    },
  };
  const ledger = {
    current: vi.fn().mockResolvedValue({
      isAggregate,
      companies: [{ id: 'c', title: 'Company' }],
    }),
  };
  return {
    journal,
    service: new AccountingService(
      db as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      ledger as never,
    ),
  };
}
it('restricts the register to aggregate readers, actor branches and visible companies', async () => {
  const { service, journal } = setup(true);
  const result = await service.journalRegister('POSTED', '1', actor);
  expect(result.data[0]?.company).toEqual({ id: 'c', name: 'Company' });
  const where = {
    status: 'POSTED',
    book: {
      branchId: { in: ['west'] },
      OR: [{ legalEntityId: null }, { legalEntityId: { in: ['c'] } }],
    },
  };
  expect(journal.count).toHaveBeenCalledWith({ where });
  expect(journal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where, take: 50, orderBy: { id: 'asc' } }),
  );
});
it('fails before reading records for a different company context, missing grants or unsupported status', async () => {
  const global = setup(true),
    single = setup(false);
  await expect(
    single.service.journalRegister('POSTED', '1', actor),
  ).rejects.toThrow();
  await expect(
    global.service.journalRegister('DRAFT', '1', {
      ...actor,
      permissions: ['finance.read', 'finance.journal.read'],
    }),
  ).rejects.toThrow();
  await expect(
    global.service.journalRegister('OTHER', '1', actor),
  ).rejects.toThrow();
  expect(single.journal.findMany).not.toHaveBeenCalled();
  expect(global.journal.findMany).not.toHaveBeenCalled();
});
