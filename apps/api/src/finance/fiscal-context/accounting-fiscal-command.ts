import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import type { FinanceFiscalStorage } from './finance-fiscal-storage';
import * as v from '../accounting/accounting.validation';

const journalActions = new Set([
  'journal-save',
  'journal-document-save',
  'journal-memorandum-save',
  'journal-notes-save',
  'review-document',
  'unreview-document',
  'submit',
  'approve',
  'post',
  'return',
  'cancel',
  'restore',
  'reverse',
]);
const bulkJournalActions = new Set([
  'journal-delete-documents',
  'review-documents',
  'unreview-documents',
  'post-documents',
  'document-posting-preview',
  'move-drafts',
  'number-drafts',
  'reorder-journals',
  'document-transfer-preview',
  'document-transfer-run',
]);

/** Runs under the same book lock as the financial command. Targets are validated natively. */
export async function assertAccountingFiscalCommand(
  tx: Prisma.TransactionClient,
  bookId: string,
  action: string,
  payload: Record<string, unknown>,
  fiscal: FinanceFiscalStorage,
) {
  const selected = fiscal.require(bookId)!;
  const fresh = await tx.accountingPeriod.findFirst({
    where: { id: selected.id, bookId, fiscalYear: { kind: 'fiscal-years' } },
    include: { fiscalYear: true },
  });
  if (
    !fresh ||
    fresh.version !== selected.version ||
    (fiscal.current()?.mode === 'default' && !fresh.isDefault)
  )
    throw new ConflictException(
      'سال مالی فعال تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
    );
  if (
    !fresh.fiscalYear.active &&
    !action.endsWith('-preview') &&
    action !== 'export-batch'
  )
    throw new ConflictException(
      'ثبت عملیات در سال مالی بایگانی‌شده مجاز نیست.',
    );
  // Moving drafts explicitly names the destination in periodId; their source IDs stay scoped.
  if (action !== 'move-drafts') fiscal.assertPeriod(bookId, payload.periodId);
  if (action === 'close-period') fiscal.assertPeriod(bookId, payload.id);
  const ids: string[] = [];
  if (journalActions.has(action) && payload.id) ids.push(v.uuid(payload.id)!);
  if (bulkJournalActions.has(action)) {
    if (Array.isArray(payload.ids))
      ids.push(...payload.ids.map((id) => v.uuid(id)!));
    if (Array.isArray(payload.items))
      for (const item of payload.items) ids.push(v.uuid(v.object(item).id)!);
  }
  if (ids.length) {
    const journals = await tx.accountingJournal.findMany({
      where: { bookId, id: { in: [...new Set(ids)] } },
      select: { periodId: true, status: true },
    });
    if (
      journals.some(
        (row) =>
          row.periodId !== selected.id &&
          !(
            row.periodId === null &&
            row.status === 'MEMORANDUM' &&
            ['journal-memorandum-save', 'journal-document-save'].includes(
              action,
            )
          ),
      )
    )
      throw new NotFoundException('سند در سال مالی فعال در دسترس نیست.');
  }
  if (action === 'general-document-date') {
    const document = await tx.accountingGeneralDocument.findFirst({
      where: { id: v.uuid(payload.id)!, bookId },
      select: { periodId: true },
    });
    if (document && document.periodId !== selected.id)
      throw new NotFoundException();
  }
  if (
    ['journal-statement-save', 'journal-statement-cancel'].includes(action) &&
    payload.id
  ) {
    const statement = await tx.accountingStatement.findFirst({
      where: { id: v.uuid(payload.id)!, bookId },
      select: { periodId: true },
    });
    if (statement && statement.periodId !== selected.id)
      throw new NotFoundException();
  }
  if (action === 'export-batch') {
    const batch = await tx.accountingConfiguration.findFirst({
      where: { id: v.uuid(payload.id)!, bookId, kind: 'posting-batches' },
    });
    if (batch)
      fiscal.assertPeriod(bookId, v.attributes(batch.attributes).periodId);
  }
  if (['workflow-cancel', 'workflow-journal'].includes(action) && payload.id) {
    const workflow = await tx.accountingWorkflow.findFirst({
      where: { id: v.uuid(payload.id)!, bookId },
    });
    if (workflow && !fiscal.includes(workflow.occurredAt))
      throw new NotFoundException('گردش کار در سال مالی فعال در دسترس نیست.');
  }
  const opening =
    action === 'year-end-opening' ||
    (action === 'year-end-preview' && payload.operation === 'year-end-opening');
  // Year-end opening and explicit draft moves use a separately validated target year/date.
  if (!opening && action !== 'move-drafts')
    for (const key of ['documentDate', 'date', 'fromDate', 'toDate', 'asOf']) {
      if (typeof payload[key] === 'string' && payload[key])
        fiscal.assertDate(payload[key]);
    }
}
