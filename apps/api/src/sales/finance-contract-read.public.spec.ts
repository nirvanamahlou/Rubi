import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { ContractCompanyScope } from './contract-company-scope.public';
import type { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import type { MasterSalesDirectory } from '../master-data/master-sales-directory';
import { SalesFinanceContractRead } from './finance-contract-read.public';

const present = vi.hoisted(() =>
  vi
    .fn()
    .mockReturnValue({ id: 'contract', contractNumber: '00025', version: 2 }),
);
vi.mock('./sales.service', () => ({ presentSalesContract: present }));
const actor = {
  userId: 'user',
  branchIds: ['allowed-branch'],
  permissions: ['finance.read'],
} as AuthenticatedActor;
const id = '00000000-0000-4000-8000-000000000025';
function fixture() {
  const row = { id, originId: 'origin', destinationId: 'destination' };
  const db = {
    client: {
      salesContract: {
        findFirst: vi.fn().mockResolvedValue(row),
        findMany: vi.fn().mockResolvedValue([{ id, contractNumber: '00025' }]),
      },
      salesContractPaymentEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'payment', contract: { id, contractNumber: '00025' } },
          ]),
      },
    },
  };
  const scope = {
    where: vi
      .fn()
      .mockResolvedValue({ legalEntityId: 'company', financeHiddenAt: null }),
  };
  const crypto = {} as SalesBuyerContactCrypto;
  const directory = {
    detail: vi.fn(async (_kind: string, city: string) => ({
      data: { name: city === 'origin' ? 'تهران' : 'شیراز' },
    })),
  };
  const service = new SalesFinanceContractRead(
    db as unknown as DatabaseService,
    scope as unknown as ContractCompanyScope,
    crypto,
    directory as unknown as MasterSalesDirectory,
  );
  return { service, db, scope, directory, crypto };
}
describe('Sales-owned Finance contract reader', () => {
  it('reads only the exact authorized branch/company/unhidden contract, using the existing stored-contract presenter', async () => {
    const { service, db, scope, crypto } = fixture();
    expect(await service.read(id, actor)).toMatchObject({
      contract: {
        contractNumber: '00025',
        originName: 'تهران',
        destinationName: 'شیراز',
      },
    });
    expect(scope.where).toHaveBeenCalledWith(actor, false, 'financeHiddenAt');
    expect(db.client.salesContract.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        AND: [
          {
            legalEntityId: 'company',
            financeHiddenAt: null,
            branchId: { in: ['allowed-branch'] },
          },
          { id },
        ],
      },
    });
    expect(present).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      undefined,
      crypto,
    );
  });
  it('does not read the database for an unauthorized actor', async () => {
    const { service, db } = fixture();
    await expect(
      service.read(id, { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.client.salesContract.findFirst).not.toHaveBeenCalled();
  });
  it('returns not-found for an inaccessible ID without a number/title search or master-data read', async () => {
    const { service, db, directory } = fixture();
    db.client.salesContract.findFirst.mockResolvedValue(null);
    await expect(service.read(id, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directory.detail).not.toHaveBeenCalled();
    expect(db.client.salesContract.findMany).not.toHaveBeenCalled();
  });
  it('uses a real payment-to-contract relation for receipt references and preserves leading zeros', async () => {
    const { service, db } = fixture();
    expect(await service.paymentReferences(['payment'], actor)).toEqual([
      { paymentId: 'payment', id, number: '00025' },
    ]);
    expect(
      db.client.salesContractPaymentEntry.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        id: { in: ['payment'] },
        contract: {
          legalEntityId: 'company',
          financeHiddenAt: null,
          branchId: { in: ['allowed-branch'] },
        },
      },
    });
  });
});
