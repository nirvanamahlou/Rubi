import { ConflictException } from '@nestjs/common';
import {
  financeCodingCapacity,
  financeCodingWidth,
  financeCodingProfileForValue,
  type FinanceCodingProfile,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';

const globalKey = 'GLOBAL';
const periodKey = 'ALL';

async function lockProfile(
  tx: Prisma.TransactionClient,
  profile: FinanceCodingProfile,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${profile.typeCode}, 0))`;
}

/** The caller owns the entity transaction and verifies create permissions first. */
export async function issueFinanceCode(
  tx: Prisma.TransactionClient,
  profile: FinanceCodingProfile,
  actorUserId: string,
  idempotencyKey: string,
  occupied: (codes: readonly string[]) => Promise<ReadonlySet<string>>,
) {
  await lockProfile(tx, profile);
  const scheme = await tx.systemNumberingScheme.upsert({
    where: { code_scopeKey: { code: profile.typeCode, scopeKey: globalKey } },
    update: {},
    create: {
      code: profile.typeCode,
      scope: 'GLOBAL',
      scopeKey: globalKey,
      prefix: profile.prefix,
      calendar: 'GREGORIAN',
      padding: financeCodingWidth - 1,
      resetPolicy: 'NEVER',
      includeFiscalYear: false,
      reason: 'FIN-CODING-001 finance detail numbering',
      createdByUserId: actorUserId,
    },
  });
  if (
    await tx.systemIssuedNumber.findUnique({
      where: {
        schemeId_idempotencyKey: { schemeId: scheme.id, idempotencyKey },
      },
      select: { id: true },
    })
  )
    throw new ConflictException('این شناسه قبلاً کد تفصیلی گرفته است.');

  const where = { schemeId_periodKey: { schemeId: scheme.id, periodKey } };
  const last =
    (await tx.systemNumberingSequence.findUnique({ where }))?.lastValue ?? 0n;
  const batchSize = 64n;
  for (
    let start = last + 1n;
    start <= financeCodingCapacity;
    start += batchSize
  ) {
    const candidates: string[] = [];
    for (
      let step = 0n;
      step < batchSize && start + step <= financeCodingCapacity;
      step++
    )
      candidates.push(
        profile.prefix +
          (start + step).toString().padStart(financeCodingWidth - 1, '0'),
      );
    const unavailable = new Set([
      ...(await occupied(candidates)),
      ...(
        await tx.systemIssuedNumber.findMany({
          where: { issuedValue: { in: candidates } },
          select: { issuedValue: true },
        })
      ).map((row) => row.issuedValue),
    ]);
    const code = candidates.find((candidate) => !unavailable.has(candidate));
    if (!code) continue;
    const sequenceValue = BigInt(code.slice(1));
    await tx.systemNumberingSequence.upsert({
      where,
      create: { schemeId: scheme.id, periodKey, lastValue: sequenceValue },
      update: { lastValue: sequenceValue, version: { increment: 1 } },
    });
    await tx.systemIssuedNumber.create({
      data: {
        schemeId: scheme.id,
        idempotencyKey,
        issuedValue: code,
        sequenceValue,
        periodKey,
        actorUserId,
      },
    });
    return code;
  }
  throw new ConflictException('بازه کد این نوع تفصیلی تکمیل شده است.');
}

/** Protect already issued values from unrelated manual edits through Accounting. */
export async function assertFinanceCodeUnissued(
  tx: Prisma.TransactionClient,
  code: string,
) {
  const profile = financeCodingProfileForValue(code);
  if (!profile) return;
  await lockProfile(tx, profile);
  if (
    await tx.systemIssuedNumber.findUnique({
      where: { issuedValue: code },
      select: { id: true },
    })
  )
    throw new ConflictException('این کد تفصیلی قبلاً صادر شده است.');
}
