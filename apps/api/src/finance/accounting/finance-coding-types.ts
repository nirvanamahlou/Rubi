import {
  detailTypeKey,
  financeCodingProfiles,
  financeCodingWidth,
  type FinanceCodingProfile,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { issueFinanceCode } from '../../system-management/finance-coding.public';
import * as v from './accounting.validation';

export function newFinanceCodingTypes(bookId: string) {
  return financeCodingProfiles.map((profile) => ({
    bookId,
    kind: 'detail-types',
    code: profile.typeCode,
    title: profile.title,
    attributes: {
      isSystem: true,
      classificationNumberLength: String(financeCodingWidth),
      defaultFirstCode: profile.firstCode,
      parentTypeId: '',
      enforceParent: false,
    },
  }));
}

export async function setupFinanceCodingTypes(
  tx: Prisma.TransactionClient,
  bookId: string,
) {
  const existing = await tx.accountingConfiguration.findMany({
    where: { bookId, kind: 'detail-types' },
    select: { code: true, title: true },
  });
  const missing = newFinanceCodingTypes(bookId).filter(
    (record) => !existing.some((row) => row.code === record.code),
  );
  const occupiedTitles = new Set(
    existing.map((row) => detailTypeKey(row.title)),
  );
  const ready = missing.filter(
    (row) => !occupiedTitles.has(detailTypeKey(row.title)),
  );
  if (ready.length)
    await tx.accountingConfiguration.createMany({ data: ready });
  return {
    created: ready.length,
    conflicts: missing
      .filter((row) => !ready.includes(row))
      .map((row) => row.title),
  };
}

export function assertFinanceCodingTypeUnchanged(
  profile: FinanceCodingProfile,
  attributes: ReturnType<typeof v.attributes>,
) {
  if (
    attributes.classificationNumberLength !== String(financeCodingWidth) ||
    attributes.defaultFirstCode !== profile.firstCode ||
    attributes.isSystem !== true ||
    attributes.enforceParent === true ||
    attributes.parentTypeId
  )
    v.rule('قواعد نوع تفصیلی ۸ رقمی ثابت است.');
}

export async function allocateFinanceAccountingCode(
  tx: Prisma.TransactionClient,
  profile: FinanceCodingProfile,
  actorUserId: string,
  detailId: string,
) {
  return issueFinanceCode(
    tx,
    profile,
    actorUserId,
    `accounting-detail:${detailId}`,
    async (codes) =>
      new Set(
        (
          await tx.accountingDetail.findMany({
            where: { code: { in: [...codes] } },
            select: { code: true },
          })
        ).map((row) => row.code),
      ),
  );
}
