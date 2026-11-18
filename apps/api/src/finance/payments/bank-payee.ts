import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import * as v from '../accounting/accounting.validation';

type Tx = Prisma.TransactionClient;
type Book = { id: string; branchId: string };
export async function beneficiaryRegister(tx: Tx, book: Book) {
  const rows = await tx.financeBeneficiary.findMany({
    where: { bookId: book.id },
    select: {
      id: true,
      ownerId: true,
      accountId: true,
      version: true,
      note: true,
      direction: true,
      blacklisted: true,
      bankBranch: {
        select: { code: true, name: true, city: { select: { name: true } } },
      },
      owner: { select: { title: true } },
      account: { select: { maskedAccountNumber: true, title: true } },
    },
    orderBy: { owner: { title: 'asc' } },
  });
  const accounts = await tx.financeSettlementAccount.findMany({
    where: {
      branchId: book.branchId,
      kind: 'BANK',
      isExternal: true,
      isActive: true,
      deletedAt: null,
      accountFingerprint: { not: null },
    },
    select: {
      id: true,
      title: true,
      maskedAccountNumber: true,
      bankId: true,
      currencyCode: true,
    },
    orderBy: { title: 'asc' },
  });
  return { rows, accounts };
}
export async function saveBeneficiary(
  tx: Tx,
  book: Book,
  p: Record<string, unknown>,
  expected?: number,
) {
  if (
    !['ALL', 'PAYMENT', 'RECEIPT'].includes(String(p.direction)) ||
    typeof p.blacklisted !== 'boolean'
  )
    v.invalid('جهت سند یا وضعیت فهرست سیاه معتبر نیست.');
  const note = v.text(p.note, 500),
    data = { direction: String(p.direction), blacklisted: p.blacklisted, note };
  if (p.id) {
    const id = v.uuid(p.id)!;
    if (
      !expected ||
      !(
        await tx.financeBeneficiary.updateMany({
          where: { id, bookId: book.id, version: expected },
          data: { ...data, version: { increment: 1 } },
        })
      ).count
    )
      throw new ConflictException('حساب ذی‌نفع تغییر کرده است.');
    return { id };
  }
  const accountId = v.uuid(p.accountId)!,
    ownerId = v.uuid(p.ownerId)!,
    bankBranchId = v.uuid(p.bankBranchId)!;
  const account = await tx.financeSettlementAccount.findFirst({
    where: {
      id: accountId,
      branchId: book.branchId,
      isExternal: true,
      isActive: true,
      deletedAt: null,
      kind: 'BANK',
    },
  });
  const owner = await tx.accountingDetail.findFirst({
    where: {
      id: ownerId,
      bookId: book.id,
      active: true,
      customerId: { not: null },
    },
    select: { customer: { select: { organizationId: true } } },
  });
  if (
    !owner?.customer ||
    !account?.bankId ||
    !account.accountFingerprint ||
    !(await tx.masterBankBranch.count({
      where: { id: bankBranchId, bankId: account.bankId, isActive: true },
    }))
  )
    v.rule('شخص یا شرکت و حساب بانکی و شعبه متناظر را انتخاب کنید.');
  const brokerId = v.uuid(p.brokerId, true),
    supplierId = v.uuid(p.supplierId, true);
  if (brokerId || supplierId) {
    const party = brokerId
      ? await tx.masterBroker.findFirst({
          where: { id: brokerId, isActive: true },
        })
      : await tx.masterSupplier.findFirst({
          where: { id: supplierId!, isActive: true },
        });
    if (
      (brokerId && supplierId) ||
      !party ||
      (party.organizationId &&
        party.organizationId !== owner.customer.organizationId)
    )
      v.rule('صاحب حساب با طرف خرید منطبق نیست.');
  }
  return tx.financeBeneficiary.create({
    data: {
      ...data,
      accountId,
      ownerId,
      bookId: book.id,
      bankBranchId,
      supplierId,
      brokerId,
      fingerprint: account.accountFingerprint,
      ibanFingerprint: account.ibanFingerprint,
    },
    select: { id: true },
  });
}
export async function validatePayee(
  tx: Tx,
  branchId: string,
  bookId: string | undefined,
  id: unknown,
  currency: string,
  party: {
    brokerId?: string | null;
    organizationId?: string | null;
    supplierId?: string | null;
    name?: string | null;
    ownerId?: string | null;
    customerId?: string | null;
  },
) {
  if (!bookId) v.rule('شرکت و سال مالی را انتخاب کنید.');
  const key = v.uuid(id)!;
  await tx.$queryRaw`SELECT b.id FROM finance_beneficiaries b JOIN "FinanceSettlementAccount" a ON a.id=b."accountId" WHERE b.id=${key}::uuid FOR SHARE OF b,a`;
  const row = await tx.financeBeneficiary.findFirst({
    where: {
      id: key,
      book: { branchId, id: bookId },
      blacklisted: false,
      direction: { in: ['ALL', 'PAYMENT'] },
      owner: { active: true },
      bankBranch: { isActive: true },
      account: {
        kind: 'BANK',
        isExternal: true,
        isActive: true,
        deletedAt: null,
        branchId,
        OR: [{ currencyCode: currency }, { currencyCode: null }],
      },
    },
    include: {
      account: true,
      owner: { include: { customer: { select: { organizationId: true } } } },
      broker: { select: { organizationId: true } },
      supplier: { select: { organizationId: true } },
    },
  });
  if (
    !row ||
    row.fingerprint !== row.account.accountFingerprint ||
    row.ibanFingerprint !== row.account.ibanFingerprint
  )
    throw new NotFoundException('حساب تأییدشده و مجاز ذی‌نفع یافت نشد.');
  const equal = party.brokerId
    ? row.brokerId === party.brokerId
    : party.supplierId
      ? row.supplierId === party.supplierId
      : party.organizationId
        ? row.owner.customer?.organizationId === party.organizationId
        : party.customerId
          ? row.owner.customerId === party.customerId
          : !!party.ownerId && row.ownerId === party.ownerId;
  if (!equal) v.rule('حساب مقصد به طرف این خرید تعلق ندارد.');
  return row.id;
}
