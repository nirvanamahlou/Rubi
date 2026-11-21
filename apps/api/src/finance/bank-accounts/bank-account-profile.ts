import { BadRequestException } from '@nestjs/common';
import type { TreasuryBankProfileInputV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { eligibleBankSigners } from '../../customers/bank-signers.public';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { bankInput, bankUuid } from './bank-account.validation';

const fields = [
  'creditLimit',
  'reserveBalance',
  'materiality',
  'backupAccountId',
  'automaticTransfer',
  'transferMethodId',
  'description',
  'descriptionEn',
  'notes',
  'signerIds',
] as const;
const invalid = () =>
  new BadRequestException('اطلاعات تکمیلی حساب بانکی معتبر نیست.');

function amount(raw: unknown) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > 40) throw invalid();
  const value = raw
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
    )
    .replace('٫', '.');
  if (!/^\d{1,20}(\.\d{1,4})?$/.test(value)) throw invalid();
  const [whole, fraction = ''] = value.split('.');
  const digits = whole!.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');
  return decimals ? digits + '.' + decimals : digits;
}

function text(raw: unknown, max: number) {
  if (typeof raw !== 'string' || raw.length > max) throw invalid();
  return raw.trim();
}

export function normalizeTreasuryBankProfile(
  raw: unknown,
): TreasuryBankProfileInputV1 {
  const data = bankInput(raw, fields);
  if (
    typeof data.automaticTransfer !== 'boolean' ||
    !Array.isArray(data.signerIds) ||
    data.signerIds.length > 50
  )
    throw invalid();
  const backupAccountId =
    data.backupAccountId == null ? null : bankUuid(data.backupAccountId);
  const transferMethodId =
    data.transferMethodId == null ? null : bankUuid(data.transferMethodId);
  if (data.automaticTransfer && (!backupAccountId || !transferMethodId))
    throw new BadRequestException(
      'برای انتقال خودکار، حساب پشتیبان و روش انتقال را انتخاب کنید.',
    );
  return {
    creditLimit: amount(data.creditLimit),
    reserveBalance: amount(data.reserveBalance),
    materiality: amount(data.materiality),
    backupAccountId,
    automaticTransfer: data.automaticTransfer,
    transferMethodId,
    description: text(data.description, 2000),
    descriptionEn: text(data.descriptionEn, 2000),
    notes: text(data.notes, 4000),
    signerIds: [...new Set(data.signerIds.map(bankUuid))].sort(),
  };
}

export async function readTreasuryBankProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
) {
  const profile = await tx.financeBankAccountProfile.findUnique({
    where: { accountId },
    include: {
      signers: {
        select: { person: { select: { id: true, displayName: true } } },
        orderBy: { personId: 'asc' },
      },
    },
  });
  if (!profile) return undefined;
  return {
    creditLimit: profile.creditLimit?.toFixed() ?? null,
    reserveBalance: profile.reserveBalance?.toFixed() ?? null,
    materiality: profile.materiality?.toFixed() ?? null,
    backupAccountId: profile.backupAccountId,
    automaticTransfer: profile.automaticTransfer,
    transferMethodId: profile.transferMethodId,
    description: profile.description ?? '',
    descriptionEn: profile.descriptionEn ?? '',
    notes: profile.notes ?? '',
    signerIds: profile.signers.map(({ person }) => person.id),
    signers: profile.signers.map(({ person }) => ({
      id: person.id,
      name: person.displayName,
    })),
  };
}

export async function assertTreasuryBankProfile(
  tx: Prisma.TransactionClient,
  directory: MasterProcurementDirectory,
  account: {
    id: string;
    branchId: string;
    bookId: string;
    currencyCode: string | null;
  },
  profile: TreasuryBankProfileInputV1,
  retained?: TreasuryBankProfileInputV1,
) {
  if (
    profile.backupAccountId &&
    profile.backupAccountId !== retained?.backupAccountId
  ) {
    const backup =
      profile.backupAccountId === account.id
        ? null
        : await tx.financeSettlementAccount.findFirst({
            where: {
              id: profile.backupAccountId,
              branchId: account.branchId,
              treasuryBookId: account.bookId,
              currencyCode: account.currencyCode,
              kind: 'BANK',
              isExternal: false,
              deletedAt: null,
              isActive: true,
            },
            select: { id: true },
          });
    if (!backup)
      throw new BadRequestException(
        'حساب پشتیبان باید حساب فعال دیگری در همین دفتر و با همین ارز باشد.',
      );
  }
  if (
    profile.transferMethodId &&
    profile.transferMethodId !== retained?.transferMethodId &&
    !(await directory.activeOutgoingPaymentMethod(profile.transferMethodId, tx))
  ) {
    throw new BadRequestException('روش انتقال خروجی معتبر نیست.');
  }
  const added = profile.signerIds.filter(
    (id) => !retained?.signerIds.includes(id),
  );
  if (
    added.length &&
    (await eligibleBankSigners(tx, account.branchId, added)).length !==
      added.length
  )
    throw new BadRequestException(
      'امضاکننده باید شخص فعال در شعبه این دفتر باشد.',
    );
}

export async function saveTreasuryBankProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
  profile: TreasuryBankProfileInputV1,
) {
  const { signerIds, ...data } = profile;
  await tx.financeBankAccountProfile.upsert({
    where: { accountId },
    create: { accountId, ...data },
    update: data,
  });
  await tx.financeBankAccountSigner.deleteMany({
    where: { accountId, personId: { notIn: signerIds } },
  });
  if (signerIds.length)
    await tx.financeBankAccountSigner.createMany({
      data: signerIds.map((personId) => ({ accountId, personId })),
      skipDuplicates: true,
    });
}
