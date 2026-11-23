import type { Prisma } from '@nora/database';
import type { TaxReferenceKind } from '@nora/contracts';

/** Accounting displays canonical identifiers, including retired references on historical journals. */
export async function taxSourceDirectory(
  tx: Prisma.TransactionClient,
  kind: TaxReferenceKind,
) {
  const fields = { id: true, code: true, name: true };
  if (kind === 'CURRENCY') {
    const rows = await tx.masterCurrency.findMany({
      select: fields,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ id, code, name }) => ({ id, code, title: name }));
  }
  const rows = await tx.masterRegion.findMany({
    select: { ...fields, country: { select: { name: true } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return rows.map(({ id, code, name, country }) => ({
    id,
    code,
    title: country.name + ' / ' + name,
  }));
}
