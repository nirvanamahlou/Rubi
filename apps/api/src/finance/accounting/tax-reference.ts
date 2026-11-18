import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import {
  parseTaxReferenceCsv,
  type TaxMappingView,
  type TaxReferenceKind,
} from '@nora/contracts';
import { taxSourceDirectory } from '../../master-data/tax-source-directory.public';
import * as v from './accounting.validation';

type Tx = Prisma.TransactionClient;
export function taxKind(value: unknown): TaxReferenceKind {
  if (value !== 'CURRENCY' && value !== 'REGION')
    v.invalid('نوع فهرست مرجع معتبر نیست.');
  return value;
}
const current = (tx: Tx, bookId: string, kind: TaxReferenceKind) =>
  tx.taxReferenceRelease.findFirst({
    where: { bookId, kind, active: true },
    select: { id: true, label: true },
  });
function unchanged(actual: string | null, expected: unknown) {
  if (actual !== expected)
    throw new ConflictException(
      'اطلاعات تغییر کرده است. صفحه را دوباره بارگذاری کنید.',
    );
}
export async function taxMappingView(
  tx: Tx,
  bookId: string,
  kind: TaxReferenceKind,
): Promise<TaxMappingView> {
  const release = await current(tx, bookId, kind);
  const sources = await taxSourceDirectory(tx, kind);
  const entries = release
    ? await tx.taxReferenceEntry.findMany({
        where: { releaseId: release.id },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, title: true },
      })
    : [];
  const mappings = release
    ? await tx.taxReferenceMapping.findMany({
        where: { bookId, entry: { releaseId: release.id } },
        select: { currencyId: true, regionId: true, entryId: true },
      })
    : [];
  const bySource = new Map(
    mappings.map((row) => [row.currencyId ?? row.regionId, row.entryId]),
  );
  return {
    release,
    entries,
    sources: sources.map((row) => ({
      ...row,
      entryId: bySource.get(row.id) ?? null,
    })),
  };
}
export async function importTaxReference(
  tx: Tx,
  bookId: string,
  p: Record<string, unknown>,
  actorId: string,
) {
  const kind = taxKind(p.kind);
  const label = v.text(p.label, 80, true);
  const previous = await current(tx, bookId, kind);
  unchanged(previous?.id ?? null, p.previousReleaseId);
  if (typeof p.csv !== 'string' || Buffer.byteLength(p.csv) > 1024 * 1024)
    v.invalid('اندازه فایل مرجع بیش از یک مگابایت است.');
  let rows;
  try {
    rows = parseTaxReferenceCsv(v.text(p.csv, 1024 * 1024, true));
  } catch (error) {
    v.invalid(error instanceof Error ? error.message : 'فایل مرجع معتبر نیست.');
  }
  if (
    await tx.taxReferenceRelease.findUnique({
      where: { bookId_kind_label: { bookId, kind, label } },
    })
  )
    v.rule('این نسخه فهرست قبلاً وارد شده است.');
  if (previous)
    await tx.taxReferenceRelease.update({
      where: { id: previous.id },
      data: { active: false },
    });
  const release = await tx.taxReferenceRelease.create({
    data: { bookId, kind, label, importedById: actorId },
  });
  for (let start = 0; start < rows.length; start += 1000) {
    await tx.taxReferenceEntry.createMany({
      data: rows
        .slice(start, start + 1000)
        .map((row) => ({ ...row, releaseId: release.id })),
    });
  }
  if (previous) {
    // A renamed or retired code needs a deliberate new selection. Historical snapshots keep their old values.
    await tx.$executeRaw`UPDATE tax_reference_mappings m SET "entryId"=n.id
      FROM tax_reference_entries old, tax_reference_entries n
      WHERE m."bookId"=${bookId}::uuid AND m."entryId"=old.id AND old."releaseId"=${previous.id}::uuid
      AND n."releaseId"=${release.id}::uuid AND n.code=old.code AND n.title=old.title`;
  }
  return { id: release.id, count: rows.length };
}
export async function saveTaxMapping(
  tx: Tx,
  bookId: string,
  p: Record<string, unknown>,
) {
  const kind = taxKind(p.kind);
  const sourceId = v.uuid(p.sourceId)!;
  const release = await current(tx, bookId, kind);
  if (!release) v.rule('فهرست رسمی وارد نشده است.');
  unchanged(release.id, p.releaseId);
  if (
    !(await taxSourceDirectory(tx, kind)).some(
      (source) => source.id === sourceId,
    )
  )
    v.invalid('مبدأ نگاشت معتبر نیست.');
  const source =
    kind === 'CURRENCY' ? { currencyId: sourceId } : { regionId: sourceId };
  const old = await tx.taxReferenceMapping.findFirst({
    where: { bookId, ...source },
    include: { entry: { select: { releaseId: true } } },
  });
  unchanged(
    old?.entry.releaseId === release.id ? old.entryId : null,
    p.previousEntryId,
  );
  const entryId = v.uuid(p.entryId, true);
  if (!entryId) {
    if (old) await tx.taxReferenceMapping.delete({ where: { id: old.id } });
  } else {
    if (
      !(await tx.taxReferenceEntry.findFirst({
        where: { id: entryId, releaseId: release.id },
      }))
    )
      v.invalid('معادل را از فهرست رسمی فعال انتخاب کنید.');
    if (old)
      await tx.taxReferenceMapping.update({
        where: { id: old.id },
        data: { entryId },
      });
    else
      await tx.taxReferenceMapping.create({
        data: { bookId, ...source, entryId },
      });
  }
  return { sourceId, entryId };
}
