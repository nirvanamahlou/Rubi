import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { ProcurementMissionPort } from './procurement-mission.module';
import type { DatabaseService } from '../database/database.service';
import type { DocumentsService } from '../documents/documents.service';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: ['hr.manage'],
} as AuthenticatedActor;
function setup(reversed = false) {
  const entry = {
    id: 'entry',
    fundId: 'fund',
    amount: new Prisma.Decimal(-250),
    fund: { branchId: 'branch', custodianId: 'owner' },
  };
  const tx = {
    $queryRaw: vi.fn(),
    procurementPettyEntry: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(entry),
      findUnique: vi
        .fn()
        .mockResolvedValue(reversed ? { id: 'reversal' } : null),
      create: vi.fn(),
    },
    procurementPettyFund: { update: vi.fn() },
  };
  const port = new ProcurementMissionPort(
    {} as DatabaseService,
    {} as DocumentsService,
  );
  return { entry, tx, port };
}
describe('mission petty-cash reversal', () => {
  it('keeps the original debit and restores the exact amount through a linked credit', async () => {
    const { entry, tx, port } = setup();
    await port.reverse(
      tx as unknown as Prisma.TransactionClient,
      'entry',
      'branch',
      actor,
    );
    const credit = tx.procurementPettyEntry.create.mock.calls[0]![0].data;
    expect(credit.requestKey).toBe('entry');
    expect(credit.amount.toString()).toBe('250');
    expect(entry.amount.toString()).toBe('-250');
    expect(
      tx.procurementPettyFund.update.mock.calls[0]![0].data.balance.increment.toString(),
    ).toBe('250');
  });
  it('does not credit the same entry twice', async () => {
    const { tx, port } = setup(true);
    await port.reverse(
      tx as unknown as Prisma.TransactionClient,
      'entry',
      'branch',
      actor,
    );
    expect(tx.procurementPettyEntry.create).not.toHaveBeenCalled();
    expect(tx.procurementPettyFund.update).not.toHaveBeenCalled();
  });
  it('rejects callers without HR scope or ownership of the fund', async () => {
    const { tx, port } = setup();
    await expect(
      port.reverse(
        tx as unknown as Prisma.TransactionClient,
        'entry',
        'branch',
        { ...actor, userId: 'other' },
      ),
    ).rejects.toThrow();
    await expect(
      port.reverse(
        tx as unknown as Prisma.TransactionClient,
        'entry',
        'other',
        actor,
      ),
    ).rejects.toThrow();
    expect(tx.procurementPettyEntry.create).not.toHaveBeenCalled();
  });
});
