import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceHistoryItemV1,
  FinanceInboxItemV1,
  FinanceSourceReferencesV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { SalesFinanceContractRead } from '../../sales/finance-contract-read.public';
import { ContractCompanyScope } from '../../sales/contract-company-scope.public';
import { financeReservationContractReferences } from '../../reservations/finance-contract-references.public';
import { AccountingCompanyScope } from '../accounting/accounting-company-scope';
import { journalAuxiliaryNumber } from '../accounting/accounting-journal-read';
import { SALES_CONTRACT_EVENT } from '../accounting/sales-contract-accounting.public';

interface Source {
  source: string;
  recordId?: string;
  requestIds?: string[];
  contractIds?: string[];
  paymentIds?: string[];
  intakeIds?: string[];
  purchaseIds?: string[];
}
const unique = (ids: (string | undefined | null)[]) => [
  ...new Set(ids.filter((id): id is string => !!id)),
];
const match = (source: Source): Prisma.FinanceAccountingEventWhereInput => ({
  source: source.source,
  ...(source.source === 'SALES' && source.contractIds?.length
    ? {
        OR: [
          ...(source.recordId ? [{ recordId: source.recordId }] : []),
          { kind: SALES_CONTRACT_EVENT, requestId: { in: source.contractIds } },
        ],
      }
    : source.recordId
      ? { recordId: source.recordId }
      : { requestId: { in: source.requestIds ?? [] } }),
});

/** Batch read projection only: real FKs/source keys, no number/title/amount matching. */
@Injectable()
export class FinanceSourceReferences {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SalesFinanceContractRead)
    private readonly sales: SalesFinanceContractRead,
    @Inject(ContractCompanyScope)
    private readonly contracts: ContractCompanyScope,
    @Inject(AccountingCompanyScope)
    private readonly companies: AccountingCompanyScope,
  ) {}

  private async resolve(
    sources: Source[],
    actor: AuthenticatedActor,
  ): Promise<FinanceSourceReferencesV1[]> {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException();
    const result: FinanceSourceReferencesV1[] = [];
    for (let offset = 0; offset < sources.length; offset += 100)
      result.push(
        ...(await this.resolveBatch(
          sources.slice(offset, offset + 100),
          actor,
        )),
      );
    return result;
  }

  private async resolveBatch(
    sources: Source[],
    actor: AuthenticatedActor,
  ): Promise<FinanceSourceReferencesV1[]> {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException();
    if (!sources.length) return [];
    const events = await this.db.client.financeAccountingEvent.findMany({
      where: {
        branchId: { in: [...actor.branchIds] },
        AND: [
          await this.contracts.eventWhere(actor),
          { OR: sources.map(match) },
        ],
      },
      select: {
        source: true,
        kind: true,
        recordId: true,
        requestId: true,
        journalId: true,
        basisEvent: { select: { source: true, requestId: true } },
      },
    });
    const matching = sources.map((source) =>
      events.filter(
        (event) =>
          event.source === source.source &&
          (source.recordId
            ? event.recordId === source.recordId ||
              (source.source === 'SALES' &&
                event.kind === SALES_CONTRACT_EVENT &&
                source.contractIds?.includes(event.requestId))
            : source.requestIds?.includes(event.requestId)),
      ),
    );
    const operationIds = unique(
      sources.flatMap((s, i) =>
        s.source === 'OPERATIONAL'
          ? [...(s.requestIds ?? []), ...matching[i]!.map((e) => e.requestId)]
          : [],
      ),
    );
    const operations = operationIds.length
      ? await this.db.client.financeOperationalRequest.findMany({
          where: {
            id: { in: operationIds },
            branchId: { in: [...actor.branchIds] },
            AND: [await this.contracts.operationalWhere(actor)],
          },
          select: { id: true, refundReceiptId: true },
        })
      : [];
    const purchaseIds = unique(
      sources.flatMap((s, i) => [
        ...(s.purchaseIds ?? []),
        ...matching[i]!.filter((e) => e.source === 'RESERVATIONS').map(
          (e) => e.requestId,
        ),
      ]),
    );
    const intakes = await financeReservationContractReferences(
      this.db.client,
      actor.branchIds,
      unique(sources.flatMap((s) => s.intakeIds ?? [])),
      purchaseIds,
    );
    const payments = await this.sales.paymentReferences(
      unique([
        ...sources.flatMap((s) => s.paymentIds ?? []),
        ...operations.map((o) => o.refundReceiptId),
      ]),
      actor,
    );
    const ids = sources.map((s, i) =>
      unique([
        ...(s.contractIds ?? []),
        ...payments
          .filter(
            (p) =>
              s.paymentIds?.includes(p.paymentId) ||
              operations.some(
                (o) =>
                  s.source === 'OPERATIONAL' &&
                  (s.requestIds?.includes(o.id) ||
                    matching[i]!.some((e) => e.requestId === o.id)) &&
                  o.refundReceiptId === p.paymentId,
              ),
          )
          .map((p) => p.id),
        ...intakes
          .filter(
            (intake) =>
              s.intakeIds?.includes(intake.id) ||
              intake.servicePurchases.some(
                (p) =>
                  s.purchaseIds?.includes(p.id) ||
                  matching[i]!.some(
                    (e) => e.source === 'RESERVATIONS' && e.requestId === p.id,
                  ),
              ),
          )
          .map((intake) => intake.contractId),
        ...matching[i]!.flatMap((e) => [
          e.source === 'SALES' ? e.requestId : null,
          e.basisEvent?.source === 'SALES' ? e.basisEvent.requestId : null,
        ]),
      ]),
    );
    const contracts = await this.sales.references(unique(ids.flat()), actor);
    let journals: (FinanceSourceReferencesV1['journals'][number] & {
      sourceKey: string | null;
      attributes: Prisma.JsonValue;
    })[] = [];
    if (actor.permissions.includes('finance.journal.read')) {
      const company = await this.companies.current(actor);
      journals = await this.db.client.accountingJournal.findMany({
        where: {
          book: {
            branchId: { in: [...actor.branchIds] },
            ...(company.isAggregate
              ? {}
              : { legalEntityId: company.company!.id }),
          },
          OR: [
            { id: { in: unique(events.map((e) => e.journalId)) } },
            {
              sourceKey: {
                in: sources
                  .filter((s) => s.recordId)
                  .map((s) => `${s.source}:${s.recordId}`),
              },
            },
          ],
        },
        select: {
          id: true,
          bookId: true,
          periodId: true,
          number: true,
          documentDate: true,
          status: true,
          sourceKey: true,
          attributes: true,
        },
      });
    }
    return sources.map((s, i) => ({
      contracts: contracts.filter((c) => ids[i]!.includes(c.id)),
      journals: journals
        .filter(
          (j) =>
            matching[i]!.some((e) => e.journalId === j.id) ||
            (s.recordId &&
              !matching[i]!.some(
                (e) => e.recordId === s.recordId && e.journalId,
              ) &&
              j.sourceKey === `${s.source}:${s.recordId}`),
        )
        .map((j) => ({
          id: j.id,
          bookId: j.bookId,
          periodId: j.periodId,
          number: j.number,
          auxiliaryNumber: journalAuxiliaryNumber(j.attributes),
          documentDate: j.documentDate,
          status: j.status,
        })),
    }));
  }

  async inbox(items: readonly FinanceInboxItemV1[], actor: AuthenticatedActor) {
    const sources = items.map((item): Source => {
      if (item.source === 'SALES')
        return {
          source: 'SALES',
          recordId: item.sourceReference,
          paymentIds: [item.sourceReference],
          contractIds: [item.sourceContextReference],
        };
      if (item.source === 'RESERVATIONS') {
        const purchaseIds = item.reservationPurchase?.lines.map(
          (line) => line.purchaseId,
        ) ?? [item.sourceReference];
        return {
          source: 'RESERVATIONS',
          requestIds: purchaseIds,
          purchaseIds,
          intakeIds: [item.sourceContextReference],
        };
      }
      return {
        source:
          item.source === 'FINANCE' || item.source === 'HR'
            ? 'OPERATIONAL'
            : item.ticketPurchase
              ? 'TICKET'
              : 'INVOICE',
        requestIds: [item.sourceReference],
      };
    });
    const refs = await this.resolve(sources, actor);
    return items.map((item, i) => ({ ...item, references: refs[i]! }));
  }

  async history(
    items: readonly FinanceHistoryItemV1[],
    actor: AuthenticatedActor,
  ) {
    const refs = await this.resolve(
      items.map((item) => ({
        source: item.source,
        recordId: item.id,
        requestIds: [item.requestId],
        ...(item.source === 'SALES' ? { paymentIds: [item.id] } : {}),
        ...(item.source === 'RESERVATIONS'
          ? { purchaseIds: [item.requestId] }
          : {}),
      })),
      actor,
    );
    return items.map((item, i) => ({
      ...item,
      ...(item.source === 'SALES' && refs[i]!.contracts.length === 1
        ? { requestId: refs[i]!.contracts[0]!.id }
        : {}),
      references: refs[i]!,
    }));
  }

  async events(
    items: { source: string; recordId: string; requestId: string }[],
    actor: AuthenticatedActor,
  ) {
    return this.resolve(
      items.map((item) => ({
        source: item.source,
        recordId: item.recordId,
        requestIds: [item.requestId],
      })),
      actor,
    );
  }
}
