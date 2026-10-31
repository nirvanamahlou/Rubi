import { randomUUID } from 'node:crypto';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor, ProcurementDraftV1 } from '@nora/contracts';
import { decimal, requireRule } from './domain/procurement.rules';
import * as v from './procurement.validation';
type Tx = Prisma.TransactionClient;
export async function debitPettyFund(
  tx: Tx,
  requestId: string,
  draft: ProcurementDraftV1,
  actor: AuthenticatedActor,
) {
  const fund = await tx.procurementPettyFund.findUnique({
    where: { branchId: draft.branchId },
  });
  if (!fund) return; // Legacy requests remain operational until this branch configures its independent ledger.
  requireRule(
    fund.custodianId === actor.userId ||
      actor.permissions.includes('procurement.assign'),
    'FORBIDDEN',
    'فقط مسئول تنخواه یا مدیر خرید می‌تواند هزینه ثبت کند.',
  );
  requireRule(
    fund.currencyCode === draft.currencyCode,
    'VALIDATION_ERROR',
    'ارز درخواست باید با تنخواه یکسان باشد.',
  );
  requireRule(
    decimal(draft.estimatedAmount ?? '') > 0n,
    'VALIDATION_ERROR',
    'مبلغ درخواست را وارد کنید.',
    'estimatedAmount',
  );
  const amount = new Prisma.Decimal(draft.estimatedAmount!);
  const prior = await tx.procurementPettyEntry.findUnique({
    where: { requestKey: requestId },
  });
  if (prior) {
    requireRule(
      prior.fundId === fund.id && prior.amount.negated().equals(amount),
      'INVALID_STATE',
      'مبلغ یا شعبه هزینه ثبت‌شده قابل تغییر نیست.',
    );
    return;
  }
  const changed = await tx.procurementPettyFund.updateMany({
    where: {
      id: fund.id,
      currencyCode: draft.currencyCode,
      custodianId: fund.custodianId,
      version: fund.version,
      balance: { gte: amount },
    },
    data: { balance: { decrement: amount }, version: { increment: 1 } },
  });
  requireRule(
    changed.count === 1,
    'CONFLICT',
    'موجودی کافی نیست یا تنخواه هم‌زمان تغییر کرده است؛ دوباره بررسی کنید.',
  );
  await tx.procurementPettyEntry.create({
    data: {
      id: randomUUID(),
      fundId: fund.id,
      requestKey: requestId,
      requestId,
      actorId: actor.userId,
      amount: amount.negated(),
    },
  });
}
export async function savePettyFund(
  tx: Tx,
  input: Record<string, unknown>,
  actor: AuthenticatedActor,
) {
  const branchId = v.uuid(input.branchId);
  requireRule(
    actor.branchIds.includes(branchId),
    'FORBIDDEN',
    'شعبه مجاز نیست.',
  );
  requireRule(
    actor.permissions.includes('procurement.assign'),
    'FORBIDDEN',
    'مجوز مدیریت تنخواه لازم است.',
  );
  const balance = v.text(input.balance, 'balance', 26);
  decimal(balance);
  const currencyCode = v.text(input.currencyCode, 'currencyCode', 3);
  requireRule(
    /^[A-Z]{3}$/.test(currencyCode),
    'VALIDATION_ERROR',
    'ارز معتبر نیست.',
  );
  const prior = await tx.procurementPettyFund.findUnique({
    where: { branchId },
  });
  const version = Number(input.version ?? 0);
  requireRule(
    (prior?.version ?? 0) === version,
    'CONFLICT',
    'موجودی تغییر کرده است؛ دوباره دریافت کنید.',
  );
  requireRule(
    !prior || prior.currencyCode === currencyCode,
    'INVALID_STATE',
    'ارز تنخواه ایجادشده قابل تغییر نیست.',
  );
  const data = {
    balance: new Prisma.Decimal(balance),
    currencyCode,
    bankName: v.text(input.bankName, 'bankName', 120, true),
    accountNumber: v.text(input.accountNumber, 'accountNumber', 40, true),
    iban: v.text(input.iban, 'iban', 34, true).toUpperCase(),
    cardNumber: v.text(input.cardNumber, 'cardNumber', 20, true),
  };
  requireRule(
    !data.iban || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(data.iban),
    'VALIDATION_ERROR',
    'شماره شبا معتبر نیست.',
  );
  requireRule(
    !data.cardNumber || /^\d{16}$/.test(data.cardNumber),
    'VALIDATION_ERROR',
    'شماره کارت باید ۱۶ رقم باشد.',
  );
  const row = prior
    ? await tx.procurementPettyFund.updateMany({
        where: { id: prior.id, version },
        data: { ...data, version: { increment: 1 } },
      })
    : null;
  requireRule(
    !row || row.count === 1,
    'CONFLICT',
    'تنخواه هم‌زمان تغییر کرده است.',
  );
  const fund = prior
    ? await tx.procurementPettyFund.findUniqueOrThrow({
        where: { id: prior.id },
      })
    : await tx.procurementPettyFund.create({
        data: { ...data, branchId, custodianId: actor.userId },
      });
  await tx.procurementPettyEntry.create({
    data: {
      fundId: fund.id,
      actorId: actor.userId,
      amount: data.balance.sub(prior?.balance ?? 0),
    },
  });
  return pettyFundDto(fund);
}

export function pettyFundDto(
  fund: Prisma.ProcurementPettyFundGetPayload<null>,
) {
  return {
    balance: fund.balance.toString(),
    currencyCode: fund.currencyCode,
    bankName: fund.bankName,
    accountNumber: fund.accountNumber,
    iban: fund.iban,
    cardNumber: fund.cardNumber,
    version: fund.version,
  };
}
