import { fiscalYearAttributes } from './accounting.fiscal-year';
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  accountingDetailOwners,
  detailOwnerKind,
  type AccountingDetailOwnerKind,
  type AccountingDetailOwnerV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import * as v from './accounting.validation';
type Tx = Prisma.TransactionClient;
type Book = { id: string; branchId: string; baseCurrency: string };
const attrs = (x: unknown) => v.attributes(x);
export function ownerKind(input: unknown) {
  const kind = String(input);
  if (!accountingDetailOwners.some((x) => x.kind === kind))
    v.invalid('نوع عنوان تفصیلی معتبر نیست.');
  return kind as AccountingDetailOwnerKind;
}
const configKind = (kind: AccountingDetailOwnerKind) =>
  kind === 'FISCAL_YEAR'
    ? 'fiscal-years'
    : 'detail-owner-' + kind.toLowerCase();
export const newOwnerTypes = (bookId: string) =>
  accountingDetailOwners.map((x) => ({
    bookId,
    kind: 'detail-types',
    code: 'DT-OWNER-' + x.kind,
    title: x.title,
    attributes: {
      isSystem: true,
      classificationNumberLength: '8',
      defaultFirstCode: '',
      parentTypeId: '',
      enforceParent: false,
    },
  }));
export async function detailOwners(
  tx: Tx,
  book: Book,
  q: Record<string, string>,
) {
  const kind = ownerKind(q.kind),
    page = Number(q.page ?? 1),
    search = v.text(q.search, 160),
    id = v.uuid(q.id, true);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    v.invalid('صفحه معتبر نیست.');
  const config = await tx.accountingConfiguration.findMany({
    where: {
      bookId: book.id,
      kind: configKind(kind),
      ...(id ? { id } : { title: { contains: search, mode: 'insensitive' } }),
    },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    ...(kind === 'CASH' ? {} : { skip: (page - 1) * 30, take: 31 }),
  });
  let rows: AccountingDetailOwnerV1[] = config.map((c) => ({
    id: c.id,
    kind,
    code: c.code,
    title: c.title,
    titleEn: c.titleEn ?? '',
    active: c.active,
    version: c.version,
    currency:
      kind === 'PETTY_CASH'
        ? String(attrs(c.attributes).currency ?? book.baseCurrency)
        : null,
    configurationId: c.id,
    accountId: null,
    attributes: { ...attrs(c.attributes), description: c.description ?? '' },
  }));
  if (['BANK', 'CASH'].includes(kind)) {
    const accounts = await tx.financeSettlementAccount.findMany({
      where: {
        branchId: book.branchId,
        kind,
        isExternal: false,
        deletedAt: null,
        ...(kind === 'CASH'
          ? { treasuryInstrument: { bookId: book.id } }
          : { treasuryBookId: book.id }),
        ...(id ? { id } : { title: { contains: search, mode: 'insensitive' } }),
      },
      include: {
        treasuryInstrument: {
          select: {
            titleEn: true,
            operatorId: true,
            location: true,
            description: true,
            descriptionEn: true,
          },
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * 30,
      take: 31,
    });
    rows = accounts.map((a) => {
      const c = config.find((c) => c.id === a.id);
      return {
        id: a.id,
        kind,
        code: c?.code ?? a.accountingCode ?? '',
        title: a.title,
        titleEn: a.treasuryInstrument?.titleEn ?? c?.titleEn ?? '',
        active: a.isActive,
        version: Math.max(c?.version ?? 0, a.version),
        currency: a.currencyCode,
        configurationId: c?.id ?? null,
        accountId: a.id,
        bankId: a.bankId,
        attributes: {
          ...(c ? attrs(c.attributes) : {}),
          ...(a.treasuryInstrument ?? {}),
          maskedAccountNumber: a.maskedAccountNumber,
        },
      };
    });
  }
  return { rows: rows.slice(0, 30), hasNext: rows.length > 30 };
}
export async function saveDetailOwner(
  tx: Tx,
  book: Book,
  p: Record<string, unknown>,
  expected: number | undefined,
  actorId: string,
) {
  const kind = ownerKind(p.ownerKind);
  if (p.active !== undefined && typeof p.active !== 'boolean')
    v.invalid('وضعیت فعال معتبر نیست.');
  if (kind === 'BANK') v.rule('حساب بانکی را از فرم حساب بانکی شرکت ثبت کنید.');
  const id = v.uuid(p.id, true) ?? randomUUID(),
    old = await tx.accountingConfiguration.findFirst({
      where: { id, bookId: book.id, kind: configKind(kind) },
    });
  const cash = kind === 'CASH';
  const account = cash
    ? await tx.financeSettlementAccount.findFirst({
        where: {
          id,
          branchId: book.branchId,
          kind,
          isExternal: false,
          deletedAt: null,
          treasuryInstrument: { bookId: book.id },
        },
      })
    : null;
  if (p.id && !old && !account)
    throw new NotFoundException('عنوان در این دفتر پیدا نشد.');
  if (
    (old || account) &&
    Math.max(old?.version ?? 0, account?.version ?? 0) !== expected
  )
    throw new ConflictException('عنوان هم‌زمان تغییر کرده است.');
  const code = v.text(p.code, 40, true),
    title = v.text(p.title, 160, true),
    titleEn = v.text(p.titleEn, 160),
    active = p.active !== false,
    input = attrs(p.attributes);
  const data: Record<string, string | boolean> = {
    notes: kind === 'FISCAL_YEAR' ? '[]' : v.text(input.notes, 2000),
  };
  if (kind === 'BRANCH') {
    if (input.isMain !== undefined && typeof input.isMain !== 'boolean')
      v.invalid('وضعیت شعبه اصلی معتبر نیست.');
    data.isMain = input.isMain === true;
    if (
      data.isMain &&
      (await tx.accountingConfiguration.count({
        where: {
          bookId: book.id,
          kind: configKind(kind),
          id: { not: id },
          attributes: { path: ['isMain'], equals: true },
        },
      }))
    )
      v.rule('برای این دفتر یک شعبه اصلی تعریف شده است.');
  }
  if (kind === 'COST_CENTER')
    data.centerType = v.text(input.centerType, 80, true);
  if (kind === 'FUND') {
    data.fundType = v.text(input.fundType, 160, true);
    data.fundClass = v.text(input.fundClass, 80, true);
    data.creditClass = v.text(input.creditClass, 80, true);
  }
  if (kind === 'FISCAL_YEAR')
    Object.assign(
      data,
      fiscalYearAttributes(
        { notes: String(input.notes ?? '[]') },
        old ? attrs(old.attributes) : undefined,
        actorId,
      ),
    );
  if (
    kind === 'FISCAL_YEAR' &&
    old &&
    !active &&
    (await tx.accountingPeriod.count({
      where: { bookId: book.id, fiscalYearId: id, isDefault: true },
    }))
  )
    v.rule('ابتدا سال مالی پیش‌فرض شرکت را تغییر دهید.');
  let currency: string | null = null;

  if (cash || kind === 'PETTY_CASH') {
    const operatorId = v.uuid(input.operatorId)!;
    if (
      !(await tx.accountingDetail.count({
        where: {
          id: operatorId,
          bookId: book.id,
          active: true,
          type: { title: 'شخص', active: true },
        },
      }))
    )
      v.rule('مسئول صندوق یا تنخواه را از اشخاص همین دفتر انتخاب کنید.');
    data.operatorId = operatorId;
    data.location = v.text(input.location, 240);
    data.descriptionEn = v.text(input.descriptionEn, 2000);
    currency = v.text(p.currency, 3, true);
    if (
      !(await tx.masterCurrency.count({
        where: { code: currency, isActive: true },
      }))
    )
      v.rule('ارز فعال انتخاب کنید.');
    data.currency = currency;
    if (kind === 'PETTY_CASH') {
      data.deploymentDate = v.text(input.deploymentDate, 10);
      if (data.deploymentDate) v.date(data.deploymentDate);
      for (const field of [
        'initialCash',
        'operationalInitialCash',
        'maximumCash',
      ])
        data[field] = v.decimalAtScale(input[field] || '0', 4);
    } else {
      if (account && account.currencyCode !== currency)
        v.rule('ارز حساب استفاده‌شده تغییر نمی‌کند.');
      const accountData = { title, currencyCode: currency, isActive: active };
      if (account)
        await tx.financeSettlementAccount.update({
          where: { id, version: account.version },
          data: { ...accountData, version: { increment: 1 } },
        });
      else
        await tx.financeSettlementAccount.create({
          data: {
            id,
            ...accountData,
            branchId: book.branchId,
            kind: 'CASH',
            createdByUserId: actorId,
          },
        });
      await tx.treasuryInstrument.upsert({
        where: { id },
        create: {
          id,
          bookId: book.id,
          operatorId,
          titleEn,
          location: String(data.location),
          description: v.text(p.description, 2000),
          descriptionEn: String(data.descriptionEn),
        },
        update: {
          operatorId,
          titleEn,
          location: String(data.location),
          description: v.text(p.description, 2000),
          descriptionEn: String(data.descriptionEn),
        },
      });
      if (
        !account ||
        (await tx.treasuryCashierAssignment.count({
          where: {
            instrumentId: id,
            bookId: book.id,
            cashierId: operatorId,
            endsAt: null,
          },
        })) === 0
      ) {
        const startsAt = new Date();
        await tx.treasuryCashierAssignment.updateMany({
          where: { instrumentId: id, bookId: book.id, endsAt: null },
          data: { endsAt: startsAt },
        });
        await tx.treasuryCashierAssignment.create({
          data: {
            bookId: book.id,
            instrumentId: id,
            cashierId: operatorId,
            startsAt,
          },
        });
      }
    }
  }
  const record = {
    code,
    title,
    titleEn: titleEn || null,
    description: v.text(p.description, 2000) || null,
    active,
    attributes: data as Prisma.InputJsonValue,
  };
  if (old)
    await tx.accountingConfiguration.update({
      where: { id, version: old.version },
      data: { ...record, version: { increment: 1 } },
    });
  else
    await tx.accountingConfiguration.create({
      data: { id, bookId: book.id, kind: configKind(kind), ...record },
    });
  const result = await detailOwners(tx, book, { kind, id });
  return result.rows[0]!;
}
export async function resolveDetailOwner(
  tx: Tx,
  book: Book,
  title: string,
  p: Record<string, unknown>,
  existing: {
    sourceAccountId?: string | null;
    sourceConfigurationId?: string | null;
  } | null,
) {
  const kind = detailOwnerKind(title);
  if (!kind) {
    if (p.sourceAccountId || p.sourceConfigurationId)
      v.rule('این نوع تفصیلی عنوان مرجع ندارد.');
    return null;
  }
  const id =
    v.uuid(p.sourceAccountId, true) ??
    v.uuid(p.sourceConfigurationId, true) ??
    existing?.sourceAccountId ??
    existing?.sourceConfigurationId ??
    null;
  if (!id) {
    if (existing) return null;
    v.rule('عنوان را از فهرست اختصاصی این نوع انتخاب کنید.');
  }
  if (['CASH', 'BANK'].includes(kind))
    await tx.$queryRaw`SELECT id FROM "FinanceSettlementAccount" WHERE id=${id}::uuid FOR SHARE`;
  else
    await tx.$queryRaw`SELECT id FROM accounting_configurations WHERE id=${id}::uuid AND "bookId"=${book.id}::uuid FOR SHARE`;
  const row = (await detailOwners(tx, book, { kind, id })).rows[0];
  const retained =
    row &&
    existing?.sourceAccountId === row.accountId &&
    existing?.sourceConfigurationId === row.configurationId;
  if (!row || (!row.active && !retained))
    v.rule('عنوان فعال و معتبر در این دفتر انتخاب کنید.');
  return row;
}
