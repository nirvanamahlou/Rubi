import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import * as v from './accounting.validation';
import { setupNotes } from './accounting.setup-notes';

const entityTitles: Record<string, string> = {
  شخص: 'شخص/شرکت',
  شرکت: 'شخص/شرکت',
  شعبه: 'شعبه',
  'مرکز هزینه': 'مرکز هزینه',
  پروژه: 'پروژه',
  'منبع تامین اعتبار': 'منبع تأمین اعتبار',
  'دوره مالی': 'دوره مالی',
};
const checkVersion = (actual: number, expected: unknown) => {
  if (actual !== expected)
    throw new ConflictException(
      'اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
    );
};

/** Account setup only: never rewrites posted journals or invokes another module. */
export async function executeAccountSetup(
  tx: Prisma.TransactionClient,
  bookId: string,
  action: string,
  p: Record<string, unknown>,
  expected: number | undefined,
  actor: AuthenticatedActor,
  actorName = actor.userId,
) {
  if (action === 'save-subsidiary-mappings') {
    if (
      !Array.isArray(p.rows) ||
      p.rows.length > 500 ||
      !Array.isArray(p.versions)
    )
      v.invalid('ردیف‌های نگاشت معتبر نیست.');
    const existing = await tx.accountingSubsidiaryMapping.findMany({
      where: { bookId },
    });
    const versions = p.versions.map((value) => v.object(value));
    if (
      versions.length !== existing.length ||
      new Set(versions.map((row) => row.id)).size !== versions.length ||
      existing.some(
        (row) =>
          !versions.some(
            (value) => value.id === row.id && value.version === row.version,
          ),
      )
    )
      throw new ConflictException(
        'نگاشت‌ها تغییر کرده‌اند؛ دوباره بارگذاری کنید.',
      );
    const rows = [];
    const seen = new Set<string>();
    for (const raw of p.rows) {
      const row = v.object(raw),
        sourceAccountId = v.uuid(row.sourceAccountId)!.toLowerCase(),
        targetAccountId = v.uuid(row.targetAccountId)!.toLowerCase();
      const sourceDetail4Id =
        v.uuid(row.sourceDetail4Id, true)?.toLowerCase() ?? null;
      const sourceDetail5Id =
        v.uuid(row.sourceDetail5Id, true)?.toLowerCase() ?? null;
      const sourceDetail6Id =
        v.uuid(row.sourceDetail6Id, true)?.toLowerCase() ?? null;
      if (
        (sourceDetail5Id && !sourceDetail4Id) ||
        (sourceDetail6Id && !sourceDetail5Id)
      )
        v.rule('سطوح تفصیلی اصلی باید به ترتیب انتخاب شوند.');
      const sourceKey = [
        sourceAccountId,
        sourceDetail4Id ?? '',
        sourceDetail5Id ?? '',
        sourceDetail6Id ?? '',
      ].join(':');
      if (seen.has(sourceKey)) v.rule('مسیر معین اصلی تکراری است.');
      seen.add(sourceKey);
      const source = await tx.accountingAccount.findFirst({
        where: {
          id: sourceAccountId,
          bookId,
          level: 'SUBSIDIARY',
          active: true,
        },
      });
      const target = await tx.accountingAccount.findFirst({
        where: { id: targetAccountId, level: 'SUBSIDIARY', active: true },
        include: { book: true },
      });
      if (
        !source ||
        !target ||
        target.bookId === bookId ||
        !target.book.active ||
        !actor.branchIds.includes(target.book.branchId)
      )
        v.rule('معین اصلی و معین فرعی باید در دو دفتر مجاز و متفاوت باشند.');
      for (const [level, detailId] of [
        [4, sourceDetail4Id],
        [5, sourceDetail5Id],
        [6, sourceDetail6Id],
      ] as const) {
        if (detailId)
          await validateSetupDetail(tx, bookId, source, detailId, level);
      }
      const detailIds = {
        detail4Id: v.uuid(row.detail4Id, true),
        detail5Id: v.uuid(row.detail5Id, true),
        detail6Id: v.uuid(row.detail6Id, true),
      };
      const attrs = v.attributes(target.attributes);
      for (const level of [4, 5, 6] as const) {
        const id = detailIds[`detail${level}Id`];
        if (!id) {
          if (attrs[`detail${level}Required`] === true)
            v.rule('تفصیلی اجباری معین فرعی انتخاب نشده است.');
          continue;
        }
        await validateSetupDetail(tx, target.bookId, target, id, level);
      }
      rows.push({
        sourceAccountId,
        sourceDetail4Id,
        sourceDetail5Id,
        sourceDetail6Id,
        sourceKey,
        targetAccountId,
        ...detailIds,
      });
    }
    await tx.accountingSubsidiaryMapping.deleteMany({
      where: { bookId, sourceKey: { notIn: [...seen] } },
    });
    for (const row of rows) {
      const old = existing.find((item) => item.sourceKey === row.sourceKey);
      if (old)
        await tx.accountingSubsidiaryMapping.update({
          where: { id: old.id },
          data: { ...row, version: { increment: 1 } },
        });
      else
        await tx.accountingSubsidiaryMapping.create({
          data: { bookId, ...row },
        });
    }
    return {
      rows: await tx.accountingSubsidiaryMapping.findMany({
        where: { bookId },
        orderBy: { sourceAccountId: 'asc' },
      }),
    };
  }
  if (action === 'save-detail-type-conversion') {
    const id = v.uuid(p.id, true),
      userTypeId = v.uuid(p.userTypeId)!,
      systemTypeId = v.uuid(p.systemTypeId)!;
    const existing = id
      ? await tx.accountingDetailTypeConversion.findFirst({
          where: { id, bookId },
        })
      : null;
    if (id && !existing) throw new NotFoundException();
    if (existing) {
      checkVersion(existing.version, expected);
      if (existing.state !== 'REGISTERED')
        v.rule('تبدیل اجراشده قابل تغییر نیست.');
    }
    const types = await tx.accountingConfiguration.findMany({
      where: {
        bookId,
        kind: 'detail-types',
        active: true,
        id: { in: [userTypeId, systemTypeId] },
      },
    });
    const user = types.find((row) => row.id === userTypeId),
      system = types.find((row) => row.id === systemTypeId);
    if (
      !user ||
      !system ||
      user.id === system.id ||
      v.attributes(user.attributes).isSystem === true ||
      v.attributes(system.attributes).isSystem !== true
    )
      v.rule('نوع تفصیلی کاربر و سیستم معتبر انتخاب کنید.');
    const entity = entityTitles[system.title];
    if (!entity) v.rule('این نوع سیستم موجودیت قابل تبدیل ندارد.');
    const data = {
      bookId,
      userTypeId,
      systemTypeId,
      entity,
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      description: v.text(p.description, 2000) || null,
      notes:
        p.notes === undefined
          ? (existing?.notes ?? [])
          : setupNotes(p.notes, existing?.notes, actorName),
    };
    return existing
      ? tx.accountingDetailTypeConversion.update({
          where: { id: existing.id },
          data: { ...data, version: { increment: 1 } },
        })
      : tx.accountingDetailTypeConversion.create({ data });
  }
  if (action === 'delete-detail-type-conversion') {
    const id = v.uuid(p.id)!;
    const row = await tx.accountingDetailTypeConversion.findFirst({
      where: { id, bookId },
    });
    if (!row) throw new NotFoundException();
    checkVersion(row.version, expected);
    if (row.state !== 'REGISTERED') v.rule('تبدیل اجراشده قابل حذف نیست.');
    await tx.accountingDetailTypeConversion.delete({ where: { id } });
    return { id, deleted: true };
  }
  return undefined;
}

export async function validateSetupDetail(
  tx: Prisma.TransactionClient,
  bookId: string,
  account: { attributes: unknown },
  detailId: string,
  level?: 4 | 5 | 6,
) {
  const detail = await tx.accountingDetail.findFirst({
    where: { id: detailId, bookId, active: true },
  });
  if (!detail) v.rule('تفصیلی فعال متعلق به همین دفتر انتخاب کنید.');
  const attrs = v.attributes(account.attributes);
  const levels = level ? [level] : [4, 5, 6];
  const allowed = levels.some((n) => {
    if (
      Array.isArray(attrs.detailLevels) &&
      !attrs.detailLevels.includes(String(n))
    )
      return false;
    const types = attrs[`detail${n}TypeIds`];
    const single = attrs[`detail${n}TypeId`];
    return (
      (!Array.isArray(types) ||
        !types.length ||
        types.includes(detail.typeId)) &&
      (!single || single === detail.typeId)
    );
  });
  if (!allowed) v.rule('نوع تفصیلی با حساب و سطح انتخابی سازگار نیست.');
  return detail;
}
export async function validateGroupDetailAllocations(
  tx: Prisma.TransactionClient,
  bookId: string,
  raw: unknown,
  memberIds: string[],
) {
  if (!Array.isArray(raw) || raw.length > 2000)
    v.invalid('تخصیص‌های تفصیلی معتبر نیست.');
  const rows: { bookId: string; accountId: string; detailId: string }[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const row = v.object(value),
      accountId = v.uuid(row.accountId)!.toLowerCase(),
      detailId = v.uuid(row.detailId)!.toLowerCase();
    if (!memberIds.includes(accountId) || seen.has(`${accountId}:${detailId}`))
      v.rule('تخصیص تفصیلی تکراری یا حساب خارج از گروه است.');
    const account = await tx.accountingAccount.findFirst({
      where: { id: accountId, bookId, active: true, level: 'SUBSIDIARY' },
    });
    if (!account) v.rule('برای تخصیص تفصیلی معین فعال انتخاب کنید.');
    await validateSetupDetail(tx, bookId, account, detailId);
    seen.add(`${accountId}:${detailId}`);
    rows.push({ bookId, accountId, detailId });
  }
  return rows;
}
