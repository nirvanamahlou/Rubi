import {
  allowsManualFinanceCode,
  detailTypeKey,
  financeCodingCapacity,
  financeCodingProfileForValue,
  financeCodingProfiles,
  financeCodingWidth,
  type FinanceCodingProfile,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import {
  issueFinanceCode,
  issuedFinanceCodesInRange,
} from '../../system-management/finance-coding.public';
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

/** Find the first gap across both saved details and permanent issuance history. */
export async function suggestFinanceAccountingCode(
  tx: Prisma.TransactionClient,
  profile: FinanceCodingProfile,
) {
  const first = profile.firstCode;
  const last = profile.prefix + financeCodingCapacity;
  const pattern = '^' + profile.prefix + '[0-9]{7}$';
  const [result] = await tx.$queryRaw<{ code: string }[]>(Prisma.sql`
    WITH used_codes AS (
      SELECT code FROM accounting_details WHERE code BETWEEN ${first} AND ${last}
      UNION
      ${issuedFinanceCodesInRange(first, last)}
    ), ordered_codes AS (
      SELECT code::bigint AS value, ROW_NUMBER() OVER (ORDER BY code) AS position
      FROM used_codes
      WHERE code ~ ${pattern}
    )
    SELECT (
      ${first}::bigint - 1 + COALESCE(
        MIN(position) FILTER (WHERE value > ${first}::bigint - 1 + position),
        COUNT(*) + 1
      )
    )::text AS code
    FROM ordered_codes
  `);
  const code = result?.code ?? '';
  return financeCodingProfileForValue(code) === profile ? code : null;
}

export async function allocateFinanceAccountingCode(
  tx: Prisma.TransactionClient,
  profile: FinanceCodingProfile,
  actorUserId: string,
  detailId: string,
  requestedCode: string,
) {
  const manual = allowsManualFinanceCode(profile);
  if (requestedCode) {
    if (!manual) v.rule('کد تفصیلی ۸ رقمی به‌صورت خودکار صادر می‌شود.');
    if (financeCodingProfileForValue(requestedCode) !== profile)
      v.rule(
        'کد تفصیلی باید ۸ رقم، با پیش‌شماره نوع تفصیلی و شماره بزرگ‌تر از صفر باشد.',
      );
  }
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
    manual
      ? {
          requestedCode,
          firstAvailable: () => suggestFinanceAccountingCode(tx, profile),
        }
      : undefined,
  );
}
