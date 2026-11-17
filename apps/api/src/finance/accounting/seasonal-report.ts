import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import type {
  SeasonalLayout,
  SeasonalPreview,
  SeasonalRow,
  TaxMappingView,
  TaxReferenceKind,
} from '@nora/contracts';
import * as v from './accounting.validation';
import { taxMappingView } from './tax-reference';
import { SALES_CONTRACT_EVENT } from './sales-contract-accounting.public';

type Tx = Prisma.TransactionClient;
type Window = { period: { id: string }; from: string; to: string };
export function seasonalLayout(value: unknown): SeasonalLayout {
  if (value !== 'CURRENCY' && value !== 'REGION' && value !== 'CURRENCY_REGION')
    v.invalid('نوع گزارش فصلی معتبر نیست.');
  return value;
}
const journalScope = (bookId: string, window: Window) => ({
  bookId,
  periodId: window.period.id,
  status: 'POSTED',
  documentDate: { gte: window.from, lte: window.to },
  financialEvent: {
    kind: { in: [SALES_CONTRACT_EVENT, 'SUPPLIER_INVOICE_APPROVED'] },
  },
});
function indexReferences(view: TaxMappingView) {
  const entries = new Map(view.entries.map((entry) => [entry.id, entry]));
  const version = view.release?.label;
  return view.sources.map((source) => {
    const entry = source.entryId ? entries.get(source.entryId) : null;
    return {
      ...source,
      target:
        entry && version
          ? { code: entry.code, title: entry.title, version }
          : null,
    };
  });
}
export async function seasonalPreview(
  tx: Tx,
  bookId: string,
  window: Window,
  layout: SeasonalLayout,
): Promise<SeasonalPreview> {
  const journals = await tx.accountingJournal.findMany({
    where: journalScope(bookId, window),
    orderBy: [{ documentDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      number: true,
      documentDate: true,
      reference: true,
      seasonalRegion: { select: { regionId: true } },
      financialEvent: {
        select: {
          kind: true,
          requestId: true,
          trackingNumber: true,
          reference: true,
          currency: true,
          amount: true,
        },
      },
    },
  });
  const currencies =
    layout === 'REGION'
      ? []
      : indexReferences(await taxMappingView(tx, bookId, 'CURRENCY'));
  const regions =
    layout === 'CURRENCY'
      ? []
      : indexReferences(await taxMappingView(tx, bookId, 'REGION'));
  const byCurrency = new Map(currencies.map((source) => [source.code, source]));
  const byRegion = new Map(regions.map((source) => [source.id, source]));
  const rows: SeasonalRow[] = journals.map((j) => {
    const event = j.financialEvent!;
    const regionId =
      layout === 'CURRENCY' ? null : (j.seasonalRegion?.regionId ?? null);
    const currencyTarget = byCurrency.get(event.currency)?.target ?? null;
    const region = regionId ? byRegion.get(regionId) : null;
    const regionTarget = region?.target ?? null;
    const missing: TaxReferenceKind[] = [];
    if (layout !== 'REGION' && !currencyTarget) missing.push('CURRENCY');
    if (layout !== 'CURRENCY' && !regionTarget) missing.push('REGION');
    const sale = event.kind === SALES_CONTRACT_EVENT;
    return {
      journalId: j.id,
      number: j.number,
      date: j.documentDate!,
      contractId: sale ? event.requestId : null,
      reference:
        event.trackingNumber ?? j.reference ?? (sale ? null : event.reference),
      kind: event.kind,
      amount: event.amount.toString(),
      currency: event.currency,
      regionId,
      region: region?.title ?? null,
      currencyTarget,
      regionTarget,
      missing,
    };
  });
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        bookId,
        window.period.id,
        window.from,
        window.to,
        layout,
        rows,
      ]),
    )
    .digest('hex');
  const history = await tx.seasonalReportSnapshot.findMany({
    where: {
      bookId,
      periodId: window.period.id,
      dateFrom: window.from,
      dateTo: window.to,
      layout,
    },
    orderBy: { approvedAt: 'desc' },
    select: { id: true, approvedAt: true },
  });
  return {
    rows,
    digest,
    regionOptions: regions.map(({ id, code, title }) => ({ id, code, title })),
    history: history.map((item) => ({
      ...item,
      approvedAt: item.approvedAt.toISOString(),
    })),
  };
}
export async function setSeasonalRegion(
  tx: Tx,
  bookId: string,
  window: Window,
  p: Record<string, unknown>,
) {
  const journalId = v.uuid(p.journalId)!;
  const journal = await tx.accountingJournal.findFirst({
    where: { ...journalScope(bookId, window), id: journalId },
    select: { seasonalRegion: { select: { regionId: true } } },
  });
  if (!journal) throw new NotFoundException();
  if ((journal.seasonalRegion?.regionId ?? null) !== p.previousRegionId)
    throw new ConflictException();
  const regionId = v.uuid(p.regionId, true);
  if (regionId) {
    const regions = await taxMappingView(tx, bookId, 'REGION');
    if (!regions.sources.some((r) => r.id === regionId))
      v.invalid('منطقه انتخاب‌شده معتبر نیست.');
    await tx.seasonalJournalRegion.upsert({
      where: { journalId },
      create: { journalId, regionId },
      update: { regionId },
    });
  } else await tx.seasonalJournalRegion.deleteMany({ where: { journalId } });
  return { journalId, regionId };
}
export async function finalizeSeasonal(
  tx: Tx,
  bookId: string,
  window: Window,
  layout: SeasonalLayout,
  digest: unknown,
  actorId: string,
) {
  const preview = await seasonalPreview(tx, bookId, window, layout);
  if (!preview.rows.length) v.rule('برای این بازه ردیفی وجود ندارد.');
  if (preview.rows.some((row) => row.missing.length))
    v.rule('معادل مالیاتی ردیف‌های مشخص‌شده تعیین نشده است.');
  if (digest !== preview.digest)
    throw new ConflictException(
      'گزارش تغییر کرده است. پیش‌نمایش را دوباره بررسی کنید.',
    );
  const key = {
    bookId,
    periodId: window.period.id,
    dateFrom: window.from,
    dateTo: window.to,
    layout,
    digest: preview.digest,
  };
  const saved = await tx.seasonalReportSnapshot.upsert({
    where: { bookId_periodId_dateFrom_dateTo_layout_digest: key },
    update: {},
    create: { ...key, rows: preview.rows, approvedById: actorId },
    select: { id: true },
  });
  return saved;
}
export async function seasonalSnapshot(
  tx: Tx,
  bookId: string,
  periodId: string,
  id: string,
) {
  const row = await tx.seasonalReportSnapshot.findFirst({
    where: { id: v.uuid(id)!, bookId, periodId },
    select: {
      rows: true,
      approvedAt: true,
      dateFrom: true,
      dateTo: true,
      layout: true,
      id: true,
    },
  });
  if (!row) throw new NotFoundException();
  return row;
}
