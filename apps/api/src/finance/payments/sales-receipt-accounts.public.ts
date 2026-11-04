import {
  BadRequestException,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { BankAccountCrypto } from '../bank-accounts/bank-account.crypto';
import { MasterDataModule } from '../../master-data/master-data.module';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';

/** Called only after Sales authorizes access to the specific contract. */
export async function salesReceiptAccounts(
  db: Pick<
    Prisma.TransactionClient,
    'financeSettlementAccount' | 'financeBankAccountAudit'
  >,
  branchId: string,
  crypto: BankAccountCrypto,
  actorUserId: string,
) {
  const rows = await db.financeSettlementAccount.findMany({
    where: { branchId, isActive: true },
    select: {
      id: true,
      title: true,
      currencyCode: true,
      kind: true,
      maskedIdentifier: true,
      branchId: true,
      bankId: true,
      bankIdentifiers: true,
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
  return Promise.all(
    rows.map(async ({ bankIdentifiers, branchId: accountBranch, ...row }) => {
      const identifiers = crypto.open(
        bankIdentifiers,
        `finance:company-bank:v1:${accountBranch}:${row.bankId}:${row.id}`,
      );
      if (bankIdentifiers !== null) {
        await db.financeBankAccountAudit.create({
          data: {
            accountId: row.id,
            actorUserId,
            action: 'REVEAL',
            metadata: {
              source: 'sales-payment-destination',
              branchId: accountBranch,
            },
          },
        });
      }
      return { ...row, ...identifiers };
    }),
  );
}

/** Sales must authorize the contract and payment capability before calling. */
@Injectable()
export class SalesReceiptAccountsPublic {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BankAccountCrypto) private readonly crypto: BankAccountCrypto,
    @Inject(MasterProcurementDirectory)
    private readonly directory: MasterProcurementDirectory,
  ) {}
  list(branchId: string, actorUserId: string) {
    return this.database.client.$transaction(async (tx) => {
      const rows = await salesReceiptAccounts(
        tx,
        branchId,
        this.crypto,
        actorUserId,
      );
      const banks = await this.directory.bankNames(
        [...new Set(rows.flatMap((row) => (row.bankId ? [row.bankId] : [])))],
        tx,
      );
      const names = new Map(banks.map((bank) => [bank.id, bank.name]));
      return rows.map(({ bankId, ...row }) => ({
        ...row,
        bankName: bankId ? (names.get(bankId) ?? null) : null,
      }));
    });
  }
}

@Module({
  imports: [MasterDataModule],
  providers: [BankAccountCrypto, SalesReceiptAccountsPublic],
  exports: [SalesReceiptAccountsPublic],
})
export class SalesReceiptAccountsModule {}

/** Validate in the Sales payment transaction; never confirms a receipt. */
export async function salesReceiptDestination(
  db: Pick<Prisma.TransactionClient, 'financeSettlementAccount'>,
  input: { destinationAccountId?: string | null; currencyCode: string },
  branchId: string,
) {
  if (!input.destinationAccountId) return {};
  const account = await db.financeSettlementAccount.findFirst({
    where: {
      id: input.destinationAccountId,
      branchId,
      currencyCode: input.currencyCode.toUpperCase(),
      isActive: true,
    },
    select: { id: true, title: true },
  });
  if (!account)
    throw new BadRequestException(
      'حساب مقصد برای شعبه و ارز پرداخت معتبر نیست.',
    );
  return {
    destinationAccountId: account.id,
    destinationAccountTitle: account.title,
  };
}
