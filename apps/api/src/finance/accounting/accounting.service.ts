import {
  SALES_CONTRACT_EVENT,
  hasPendingSalesContractAccounting,
  assertSalesContractJournalReversible,
  validateSalesContractAccounts,
  validateSalesContractAccountingSource,
} from './sales-contract-accounting.public';
import {
  workflowPostingContext,
  captureWorkflow,
  workflowJournal,
  cancelWorkflow,
  workflowList,
  workflowSources,
  assertWorkflowsClosed,
} from './accounting.workflows';
import {
  isReceiptAllocation,
  postedReceiptBasis,
} from './receipt-funds.public';
import { receiptAllocationLines } from './receipt-allocation-journal';
import { accountingFinancialEventLabels } from '@nora/contracts';
import {
  FINANCIAL_RULE_KIND,
  financialDate,
  financialEventLines,
  ruleMatches,
} from './accounting.financial-events';
import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AccountingAttributes,
  AccountingFinancialEventPageV1,
  AccountingCommandV1,
  AuthenticatedActor,
  IamPermissionCode,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { MasterDataService } from '../../master-data/master-data.service';
import { accountingCurrencies } from './accounting.currency-directory';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';
import {
  executeAccountSetup,
  validateGroupDetailAllocations,
  validateSetupDetail,
} from './accounting.accounts';
import { setupNotes } from './accounting.setup-notes';
import { allocationTargets, allocateAmount } from './accounting.allocation';
import {
  accountControlFilters,
  validateAccountForm,
} from './accounting.account-form';
import { FinanceInboxService } from '../finance-inbox.service';
import {
  reorderJournals,
  numberJournalPreview,
  compareDocumentOrder,
  validateTemplateAssignments,
} from './accounting.documents';
import { documentSqlFilter } from './accounting.document-sql-filters';
import {
  documentFigures,
  documentFigureStatuses,
} from './accounting.document-figures';
import {
  documentPostingPreview,
  documentPostingInterval,
} from './accounting.document-posting';
import { automaticDocumentPreview } from './accounting.document-automatic';
import { generalDocumentPreview } from './accounting.document-general';
import { sourceRevaluationPreview } from './accounting.document-revaluation';
import { documentTransferPreview } from './accounting.document-transfer';
import { documentStatementBasis } from './accounting.document-statement';
import {
  distributeClosing,
  selectClosingLots,
  validateHistoricalCarry,
} from './accounting.year-end';

type Tx = Prisma.TransactionClient;
type BufferedStateEvent = {
  journalId: string;
  eventType: 'CREATE' | 'STATUS' | 'MOVE';
  fromStatus?: string | null;
  toStatus?: string | null;
  journalVersion: number;
  oldPeriodId?: string | null;
  newPeriodId?: string | null;
  oldDocumentDate?: string | null;
  newDocumentDate?: string | null;
  reason?: string | null;
};
type AccountingTemplateWithLines = Prisma.AccountingTemplateGetPayload<{
  include: { lines: true };
}>;
const templateSourceAssignments = (
  attributes: unknown,
): Record<string, number> => {
  const value = v.attributes(attributes).sourceAssignments;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return v.object(parsed) as Record<string, number>;
  } catch {
    v.rule('تخصیص حساب‌های الگو معتبر نیست.');
  }
};
const templateDto = (template: AccountingTemplateWithLines) => ({
  ...template,
  lines: template.lines.map((line) => ({
    ...line,
    percentage: v.decimal(line.percentage.toFixed(8))!,
    parentPosition:
      templateSourceAssignments(template.attributes)[String(line.position)] ??
      null,
  })),
});
const journalInclude = { lines: { orderBy: { position: 'asc' as const } } };
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value;
const without = (
  input: Record<string, string | boolean | string[]>,
  keys: readonly string[],
) =>
  Object.fromEntries(
    Object.entries(input).filter(([key]) => !keys.includes(key)),
  );
const journalWritableAttributes = ['auxiliaryNumber', 'descriptionEn'];
const lineWritableAttributes = [
  'descriptionEn',
  'trackingNumber',
  'trackingDate',
];
const resetApprovalAttributes = (value: unknown) =>
  without(v.attributes(value), [
    'approvalPolicyId',
    'approvalPolicyVersion',
    'warnings',
  ]);
const kinds = [
  'approval-policies',
  'fiscal-years',
  'voucher-types',
  'detail-types',
  'account-mappings',
  'allocation-templates',
  'posting-rules',
  'tax-settings',
  'tax-invoices',
  'tax-returns',
];
// Compare posting semantics, treating absent optional form fields as defaults.
const accountRules = (value: unknown, permanent = true) => {
  const attrs = v.attributes(value);
  return {
    ...Object.fromEntries(
      [
        'traceable',
        'multiCurrency',
        'revaluable',
        'zeroBalanceAtClose',
        'detail4Required',
        'detail5Required',
        'detail6Required',
      ].map((key) => [key, attrs[key] === true]),
    ),
    natureControl: attrs.natureControl || 'NONE',
    natureControlScope:
      attrs.natureControlScope ||
      (attrs.natureControl && attrs.natureControl !== 'NONE'
        ? 'ACCOUNT'
        : 'NONE'),
    accountType: attrs.accountType || (permanent ? 'PERMANENT' : 'TEMPORARY'),
    ...Object.fromEntries(
      [4, 5, 6].flatMap((n) => [
        [
          `detail${n}TypeIds`,
          Array.isArray(attrs[`detail${n}TypeIds`])
            ? [...(attrs[`detail${n}TypeIds`] as string[])].sort()
            : attrs[`detail${n}TypeId`]
              ? [attrs[`detail${n}TypeId`]]
              : [],
        ],
        [
          `detail${n}NatureTypeIds`,
          Array.isArray(attrs[`detail${n}NatureTypeIds`])
            ? [...(attrs[`detail${n}NatureTypeIds`] as string[])].sort()
            : [],
        ],
      ]),
    ),
  };
};

@Injectable()
export class AccountingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamFinanceDirectory) private readonly identity: IamFinanceDirectory,
    @Optional()
    @Inject(FinanceInboxService)
    private readonly finance?: FinanceInboxService,
    @Optional()
    @Inject(MasterDataService)
    private readonly master?: MasterDataService,
  ) {}
  private require(
    actor: AuthenticatedActor,
    permission: IamPermissionCode = 'finance.journal.read',
  ) {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes(permission)
    )
      throw new ForbiddenException({
        code: 'ACCOUNTING_FORBIDDEN',
        message: 'مجوز این عملیات حسابداری را ندارید.',
      });
  }
  private async book(tx: Tx, id: string, actor: AuthenticatedActor) {
    v.uuid(id);
    const row = await tx.accountingBook.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
    });
    if (!row) throw new NotFoundException('دفتر حسابداری پیدا نشد.');
    return row;
  }
  async books(actor: AuthenticatedActor) {
    this.require(actor);
    return {
      books: await this.database.client.accountingBook.findMany({
        where: { branchId: { in: actor.branchIds } },
        orderBy: { code: 'asc' },
      }),
      branches: await this.identity.branches(actor.branchIds),
    };
  }
  async createBook(input: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'finance.account.manage');
    const p = v.object(input);
    const id = v.uuid(p.id)!;
    const branchId = v.uuid(p.branchId)!;
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    const branch = await this.identity.branches([branchId]);
    if (!branch.length) throw new ForbiddenException();
    if (p.approvalPolicy !== 'DUAL_CONTROL')
      v.rule('قاعده تأیید مستقل دفتر را انتخاب کنید.');
    const code = v.text(p.code, 20, true),
      title = v.text(p.title, 160, true),
      baseCurrency = v.text(p.baseCurrency, 3, true);
    if (!/^[A-Z]{3}$/.test(baseCurrency)) v.invalid('کد ارز معتبر نیست.');
    return this.database.client.$transaction(async (tx) => {
      const existing = await tx.accountingBook.findUnique({ where: { id } });
      if (existing) {
        if (
          existing.branchId !== branchId ||
          existing.code !== code ||
          existing.title !== title ||
          existing.baseCurrency !== baseCurrency ||
          existing.titleEn !== (v.text(p.titleEn, 160) || null) ||
          existing.description !== (v.text(p.description, 2000) || null) ||
          existing.notes !== (v.text(p.notes, 2000) || null) ||
          existing.isMain !== (p.isMain === true) ||
          existing.active !== (p.active !== false) ||
          existing.allowsPosting !== (p.allowsPosting !== false)
        )
          throw new ConflictException(
            'شناسه قبلاً با اطلاعات دیگری ثبت شده است.',
          );
        return existing;
      }
      const created = await tx.accountingBook.create({
        data: {
          id,
          branchId,
          code,
          title,
          baseCurrency,
          isMain: p.isMain === true,
          titleEn: v.text(p.titleEn, 160) || null,
          description: v.text(p.description, 2000) || null,
          notes: v.text(p.notes, 2000) || null,
          active: p.active !== false,
          allowsPosting: p.allowsPosting !== false,
        },
      });
      await tx.accountingConfiguration.create({
        data: {
          bookId: id,
          kind: 'approval-policies',
          code: 'DUAL-CONTROL',
          title: 'تأیید مستقل اسناد',
          attributes: {
            currency: baseCurrency,
            minAmount: '0',
            maxAmount: '',
            permission: 'finance.journal.approve',
          },
          active: true,
        },
      });
      return created;
    });
  }
  async snapshot(id: string, actor: AuthenticatedActor) {
    this.require(actor);
    return this.database.client.$transaction(
      async (tx) => {
        const book = await this.book(tx, id, actor);
        const [
          periods,
          accounts,
          details,
          configurations,
          fxRates,
          accountGroups,
          detailGroups,
          templates,
          subsidiaryMappings,
          detailConversions,
        ] = await Promise.all([
          tx.accountingPeriod.findMany({
            where: { bookId: id },
            orderBy: { startDate: 'desc' },
          }),
          tx.accountingAccount.findMany({
            where: { bookId: id },
            orderBy: { code: 'asc' },
          }),
          tx.accountingDetail.findMany({
            where: { bookId: id },
            orderBy: { code: 'asc' },
          }),
          tx.accountingConfiguration.findMany({
            where: {
              bookId: id,
              NOT: { kind: { startsWith: 'taxpayer-draft-' } },
            },
            orderBy: { code: 'asc' },
          }),
          tx.accountingFxSnapshot.findMany({
            where: { bookId: id },
            orderBy: { validFrom: 'desc' },
          }),
          tx.accountingAccountGroup.findMany({
            where: { bookId: id },
            include: {
              members: { orderBy: { accountId: 'asc' } },
              detailAllocations: true,
            },
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
          }),
          tx.accountingDetailGroup.findMany({
            where: { bookId: id },
            include: { members: { orderBy: { detailId: 'asc' } } },
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
          }),
          tx.accountingTemplate.findMany({
            where: { bookId: id },
            include: { lines: { orderBy: { position: 'asc' } } },
            orderBy: [{ kind: 'asc' }, { code: 'asc' }, { id: 'asc' }],
          }),
          tx.accountingSubsidiaryMapping.findMany({
            where: { bookId: id },
            orderBy: { sourceAccountId: 'asc' },
          }),
          tx.accountingDetailTypeConversion.findMany({
            where: { bookId: id },
            orderBy: { date: 'desc' },
          }),
        ]);
        return {
          book,
          periods,
          accounts,
          details,
          configurations,
          fxRates,
          accountGroups,
          detailGroups,
          templates: templates.map(templateDto),
          subsidiaryMappings,
          detailConversions,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async journals(
    bookId: string,
    query: Record<string, string>,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    await this.book(this.database.client, bookId, actor);
    const exporting = query.export === 'true';
    if (query.sourceKind && query.sourceKind !== 'revaluation')
      v.invalid('نوع فهرست معتبر نیست.');
    if (exporting) this.require(actor, 'finance.export');
    const page = exporting ? 1 : Math.max(1, Number(query.page) || 1),
      pageSize = exporting
        ? 10000
        : query.pageSize === undefined
          ? 30
          : Number(query.pageSize);
    if (!exporting && ![30, 50].includes(pageSize))
      v.invalid('اندازه صفحه معتبر نیست.');
    if (!Number.isSafeInteger(page) || page > 100000)
      v.invalid('شماره صفحه معتبر نیست.');
    const where: Prisma.AccountingJournalWhereInput = {
      bookId,
      ...(query.sourceKind === 'revaluation'
        ? {
            sourceKey: { startsWith: 'REVALUE:' },
            AND: [
              {
                attributes: {
                  path: ['revaluationCurrency'],
                  not: Prisma.AnyNull,
                },
              },
            ],
          }
        : {}),
      ...(query.id ? { id: v.uuid(query.id)! } : {}),
      ...(query.periodId ? { periodId: v.uuid(query.periodId)! } : {}),
      ...(query.status
        ? { status: query.status }
        : query.excludeCancelled === 'true'
          ? { status: { not: 'CANCELLED' } }
          : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: v.text(query.search, 160) } },
              { reference: { contains: v.text(query.search, 160) } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            documentDate: {
              ...(query.from ? { gte: v.date(query.from)! } : {}),
              ...(query.to ? { lte: v.date(query.to)! } : {}),
            },
          }
        : {}),
    };
    const currencies =
      query.sourceKind === 'revaluation' ||
      query.sort === 'revaluationCurrency' ||
      query.group === 'revaluationCurrency' ||
      query.filter?.includes('revaluationCurrency')
        ? await accountingCurrencies(this.master)
        : [];
    const currencyName = currencies.length
      ? Prisma.sql`CASE j.attributes->>'revaluationCurrency' ${Prisma.join(
          currencies.map(
            (currency) =>
              Prisma.sql`WHEN ${currency.code} THEN ${currency.name}`,
          ),
          ' ',
        )} ELSE NULL END`
      : Prisma.sql`NULL`;
    const expression = (value: string | Prisma.Sql) =>
      typeof value === 'string' ? Prisma.raw(value) : value;
    const actorSortFields = ['makerId', 'approverId', 'lastModifierId'];
    let actorSortNames: { id: string; displayName: string }[] = [];
    if (
      [query.sort, query.group].some(
        (field) => field && actorSortFields.includes(field),
      )
    ) {
      const ids = await this.database.client.$queryRaw<
        { id: string }[]
      >(Prisma.sql`
        SELECT id FROM (
          SELECT "makerId"::text AS id FROM accounting_journals WHERE "bookId"=${bookId}::uuid
          UNION SELECT "approverId"::text FROM accounting_journals WHERE "bookId"=${bookId}::uuid
          UNION SELECT attributes->>'lastModifierId' FROM accounting_journals WHERE "bookId"=${bookId}::uuid
        ) actors WHERE id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        ORDER BY id LIMIT 2001`);
      if (ids.length > 2000)
        v.rule('مرتب‌سازی نام کاربران از محدوده پشتیبانی خارج است.');
      actorSortNames = await this.identity.displayNames(
        ids.map((row) => row.id),
        actor.branchIds,
      );
    }
    const actorName = (field: string) =>
      actorSortNames.length
        ? Prisma.sql`CASE ${Prisma.raw(field)} ${Prisma.join(
            actorSortNames.map(
              (user) => Prisma.sql`WHEN ${user.id} THEN ${user.displayName}`,
            ),
            ' ',
          )} ELSE NULL END`
        : Prisma.sql`NULL`;
    const pageResult = await this.database.client.$transaction(
      async (tx) => {
        const sortColumns: Record<string, string | Prisma.Sql> = {
          number: 'j.number',
          documentDate: 'j."documentDate"',
          reference: 'j.reference',
          description: 'j.description',
          status: 'j.status',
          isCurrency:
            'EXISTS (SELECT 1 FROM accounting_journal_lines l JOIN accounting_accounts a ON a.id=l."accountId" AND a."bookId"=j."bookId" WHERE l."journalId"=j.id AND a.attributes->>\'multiCurrency\'=\'true\')',
          typeId:
            '(SELECT c.title FROM accounting_configurations c WHERE c.id=j."typeId" AND c."bookId"=j."bookId")',
          amount:
            'COALESCE((SELECT SUM(l.debit) FROM accounting_journal_lines l WHERE l."journalId"=j.id),0)',
          makerId: actorName('j."makerId"::text'),
          approverId: actorName('j."approverId"::text'),
          lastModifierId: actorName("j.attributes->>'lastModifierId'"),
          deletedAt:
            '(SELECT MAX(e."occurredAt") FROM accounting_journal_state_events e WHERE e."journalId"=j.id AND e."toStatus"=\'CANCELLED\')',
          referenceNumber: "j.attributes->>'referenceNumber'",
          auxiliaryNumber: "j.attributes->>'auxiliaryNumber'",
          revaluationCurrency: currencyName,
          revaluationRate:
            '(SELECT r.rate FROM accounting_fx_snapshots r WHERE r.id::text=j.attributes->>\'revaluationRateId\' AND r."bookId"=j."bookId")',
          dailyNumber:
            "CASE WHEN j.attributes->>'dailyNumber' ~ '^[0-9]{1,9}$' THEN (j.attributes->>'dailyNumber')::integer END",
        };
        if (query.sort && !Object.hasOwn(sortColumns, query.sort))
          v.invalid('ستون مرتب‌سازی معتبر نیست.');
        if (query.direction && !['asc', 'desc'].includes(query.direction))
          v.invalid('جهت مرتب‌سازی معتبر نیست.');
        const groupColumns: Record<string, string | Prisma.Sql> = sortColumns;
        if (query.group && !Object.hasOwn(groupColumns, query.group))
          v.invalid('ستون گروه‌بندی معتبر نیست.');
        let filteredIds: string[] | undefined;
        let filteredTotal: number | undefined;
        if (query.filter || query.sort || query.group) {
          const scopes: Prisma.Sql[] = [Prisma.sql`j."bookId"=${bookId}::uuid`];
          if (query.sourceKind === 'revaluation')
            scopes.push(
              Prisma.sql`j."sourceKey" LIKE 'REVALUE:%' AND j.attributes->>'revaluationCurrency' IS NOT NULL`,
            );
          if (query.filter)
            scopes.push(
              documentSqlFilter(
                this.parseDocumentFilter(query.filter),
                'journal',
                currencyName,
              ),
            );
          if (query.id)
            scopes.push(Prisma.sql`j.id=${v.uuid(query.id)!}::uuid`);
          if (query.periodId)
            scopes.push(
              Prisma.sql`j."periodId"=${v.uuid(query.periodId)!}::uuid`,
            );
          if (query.status) scopes.push(Prisma.sql`j.status=${query.status}`);
          else if (query.excludeCancelled === 'true')
            scopes.push(Prisma.sql`j.status<>'CANCELLED'`);
          if (query.from)
            scopes.push(Prisma.sql`j."documentDate">=${v.date(query.from)!}`);
          if (query.to)
            scopes.push(Prisma.sql`j."documentDate"<=${v.date(query.to)!}`);
          if (query.search) {
            const term = v.text(query.search, 160);
            scopes.push(
              Prisma.sql`(STRPOS(j.description,${term})>0 OR STRPOS(j.reference,${term})>0)`,
            );
          }
          const clauses = Prisma.join(
            scopes.map((scope) => Prisma.sql`(${scope})`),
            ' AND ',
          );
          const rowOrder = query.sort
            ? Prisma.sql`${expression(sortColumns[query.sort]!)} ${Prisma.raw(query.direction === 'asc' ? 'ASC' : 'DESC')} NULLS LAST, j.id ASC`
            : Prisma.raw('j."documentDate" DESC, j."createdAt" DESC, j.id ASC');
          const order = query.group
            ? Prisma.sql`${expression(groupColumns[query.group]!)} ASC NULLS LAST, ${rowOrder}`
            : rowOrder;
          const ids = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT j.id FROM accounting_journals j WHERE ${clauses} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
          );
          const counts = await tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`SELECT COUNT(*) AS total FROM accounting_journals j WHERE ${clauses}`,
          );
          filteredIds = ids.map((row) => row.id);
          filteredTotal = Number(counts[0]?.total ?? 0);
        }
        const items = await tx.accountingJournal.findMany({
          where: filteredIds ? { ...where, id: { in: filteredIds } } : where,
          include: journalInclude,
          orderBy: [
            { documentDate: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          ...(filteredIds
            ? {}
            : { skip: (page - 1) * pageSize, take: pageSize }),
        });
        if (filteredIds) {
          const positions = new Map(
            filteredIds.map((id, index) => [id, index]),
          );
          items.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
        }
        const deletionEvents =
          query.status === 'CANCELLED'
            ? await tx.accountingJournalStateEvent.findMany({
                where: {
                  bookId,
                  journalId: { in: items.map((item) => item.id) },
                  toStatus: 'CANCELLED',
                },
                orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
              })
            : [];
        return {
          items,
          deletionEvents,
          total: filteredTotal ?? (await tx.accountingJournal.count({ where })),
          page,
          pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    if (exporting && pageResult.total > 10000)
      v.rule('خروجی بیش از ۱۰۰۰۰ سند است؛ محدوده فیلتر را کوچک‌تر کنید.');
    const names = new Map(
      (
        await this.identity.displayNames(
          [
            ...pageResult.items.flatMap((item) =>
              [
                item.makerId,
                item.approverId,
                String(v.attributes(item.attributes).lastModifierId ?? ''),
              ].filter((id): id is string => Boolean(id)),
            ),
            ...pageResult.deletionEvents.map((event) => event.actorId),
          ],
          actor.branchIds,
        )
      ).map((user) => [user.id, user.displayName]),
    );
    return {
      total: pageResult.total,
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      items: pageResult.items.map((item) => ({
        ...item,
        makerName: names.get(item.makerId) ?? null,
        approverName: item.approverId
          ? (names.get(item.approverId) ?? null)
          : null,
        lastModifierName:
          names.get(
            String(v.attributes(item.attributes).lastModifierId ?? ''),
          ) ?? null,
        deletedAt:
          pageResult.deletionEvents.find((event) => event.journalId === item.id)
            ?.occurredAt ?? null,
        deletedByName:
          names.get(
            pageResult.deletionEvents.find(
              (event) => event.journalId === item.id,
            )?.actorId ?? '',
          ) ?? null,
      })),
    };
  }
  private parseDocumentFilter(value: string): unknown {
    if (value.length > 24000) v.invalid('فیلتر بیش از حد بزرگ است.');
    try {
      return JSON.parse(value);
    } catch {
      v.invalid('فیلتر معتبر نیست.');
    }
  }
  async financialEventReconciliation(
    bookId: string,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'finance.journal.read');
    const book = await this.book(this.database.client, bookId, actor);
    const rows = await this.database.client.$queryRaw<
      {
        kind: string;
        currency: string;
        state: string;
        count: number;
        amount: string;
      }[]
    >`
      WITH classified AS (
        SELECT e.kind, e.currency, e.amount,
          CASE WHEN j.id IS NULL THEN 'UNLINKED' WHEN j."bookId"<>${book.id}::uuid THEN 'OTHER_BOOK'
            WHEN EXISTS (SELECT 1 FROM accounting_journals r WHERE r."reversalOfId"=j.id AND r.status='POSTED') THEN 'REVERSED'
            ELSE j.status END AS state
        FROM finance_accounting_events e LEFT JOIN accounting_journals j ON j.id=e."journalId"
        WHERE e."branchId"=${book.branchId}::uuid
      ) SELECT kind,currency,state,COUNT(*)::int AS count,SUM(amount)::text AS amount FROM classified
      GROUP BY kind,currency,state ORDER BY currency,kind,state`;
    return { version: 1 as const, rows };
  }

  async financialEvents(
    bookId: string,
    actor: AuthenticatedActor,
    query: Record<string, string> = {},
  ): Promise<AccountingFinancialEventPageV1> {
    this.require(actor, 'finance.journal.read');
    const book = await this.book(this.database.client, bookId, actor);
    const before = query.before
      ? await this.database.client.financeAccountingEvent.findFirst({
          where: { id: v.uuid(query.before)!, branchId: book.branchId },
        })
      : null;
    if (query.before && !before)
      throw new NotFoundException('نشانگر رویداد در شعبه مجاز پیدا نشد.');
    const events = await this.database.client.financeAccountingEvent.findMany({
      where: {
        branchId: book.branchId,
        ...(query.pending === 'true' ? { journalId: null } : {}),
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      include: {
        journal: {
          select: { id: true, bookId: true, status: true, version: true },
        },
      },
    });
    const items = events.slice(0, 50);
    return {
      version: 1 as const,
      items: items.map((e) => ({
        id: e.id,
        source: e.source,
        ...(e.basisEventId
          ? {
              basisEventId: e.basisEventId,
              carryingAmount: e.carryingAmount!.toString(),
              carryingCurrency: e.carryingCurrency!,
            }
          : {}),
        kind: e.kind,
        requestId: e.requestId,
        trackingNumber: e.trackingNumber ?? e.requestId,
        trackingDate: e.trackingDate ?? financialDate(e.occurredAt),
        reference:
          e.kind === SALES_CONTRACT_EVENT ? e.trackingNumber : e.reference,
        amount: e.amount.toString(),
        currency: e.currency,
        occurredAt: e.occurredAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
        lastError: e.lastError,
        journal: e.journal,
      })),
      nextCursor: events.length > 50 ? items.at(-1)!.id : null,
    };
  }

  async workflows(bookId: string, actor: AuthenticatedActor) {
    this.require(actor, 'finance.journal.read');
    return this.database.client.$transaction(async (tx) =>
      workflowList(tx, await this.book(tx, bookId, actor)),
    );
  }
  async workflowSources(
    bookId: string,
    search: string,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'finance.journal.create');
    return this.database.client.$transaction(async (tx) =>
      workflowSources(
        tx,
        await this.book(tx, bookId, actor),
        v.text(search, 160),
      ),
    );
  }
  async command(
    bookId: string,
    action: string,
    body: unknown,
    actor: AuthenticatedActor,
  ) {
    const permission: IamPermissionCode =
      action === 'workflow-cancel'
        ? 'finance.journal.approve'
        : action.startsWith('workflow-')
          ? 'finance.journal.create'
          : action === 'export-batch'
            ? 'finance.export'
            : [
                  'approve',
                  'approve-fx',
                  'review-document',
                  'unreview-document',
                  'review-documents',
                  'unreview-documents',
                  'review-all-preview',
                  'review-all-documents',
                ].includes(action)
              ? 'finance.journal.approve'
              : [
                    'post',
                    'document-posting-preview',
                    'post-documents',
                    'general-document-preview',
                    'general-document-issue',
                    'general-document-date',
                  ].includes(action)
                ? 'finance.journal.post'
                : action === 'reverse'
                  ? 'finance.journal.reverse'
                  : [
                        'close-period',
                        'year-end-closing',
                        'year-end-opening',
                        'year-end-preview',
                        'year-end-final',
                        'year-end-nature-adjustment',
                      ].includes(action)
                    ? 'finance.period.close'
                    : [
                          'source-journal',
                          'financial-event-journal',
                          'allocation-run',
                          'allocation-preview',
                          'automatic-preview',
                          'automatic-run',
                          'document-revaluation-preview',
                          'document-revaluation-run',
                          'document-transfer-preview',
                          'document-transfer-run',
                          'document-import-run',
                          'revaluation-preview',
                          'revaluation-run',
                          'number-drafts',
                          'number-journal-preview',
                          'move-drafts',
                          'reorder-journals',
                        ].includes(action) ||
                        action.startsWith('journal') ||
                        ['submit', 'return', 'cancel', 'restore'].includes(
                          action,
                        )
                      ? 'finance.journal.create'
                      : 'finance.account.manage';
    this.require(actor, permission);
    const c = v.object(body) as unknown as AccountingCommandV1;
    const key = v.text(c.key, 100, true),
      p = v.object(c.payload);
    const hash = createHash('sha256')
      .update(
        JSON.stringify(
          canonical({ action, payload: p, expectedVersion: c.expectedVersion }),
        ),
      )
      .digest('hex');
    return this.database.client.$transaction(
      async (tx) => {
        await this.book(tx, bookId, actor);
        // A per-book lock serializes configuration, period closure, serials and journal posting.
        await tx.$queryRaw`SELECT id FROM accounting_books WHERE id=${bookId}::uuid FOR UPDATE`;
        const previous = await tx.accountingCommand.findUnique({
          where: { bookId_key: { bookId, key } },
        });
        if (previous) {
          if (previous.hash !== hash || previous.actorId !== actor.userId)
            throw new ConflictException('کلید درخواست قبلاً استفاده شده است.');
          return previous.result;
        }
        const book = await this.book(tx, bookId, actor);
        const commandId = randomUUID();
        const stateEvents: BufferedStateEvent[] = [];
        const result = await this.execute(
          tx,
          book,
          action,
          p,
          c.expectedVersion,
          actor,
          false,
          stateEvents,
        );
        await tx.accountingCommand.create({
          data: {
            id: commandId,
            bookId,
            actorId: actor.userId,
            key,
            hash,
            action,
            result: json(result),
          },
        });
        if (stateEvents.length)
          await tx.accountingJournalStateEvent.createMany({
            data: stateEvents.map((event, index) => ({
              ...event,
              bookId,
              commandId,
              actorId: actor.userId,
              sequence: index + 1,
            })),
          });
        return result;
      },
      { timeout: 20000 },
    );
  }
  private version(actual: number, expected: unknown) {
    if (actual !== expected)
      throw new ConflictException({
        code: 'ACCOUNTING_VERSION_CONFLICT',
        message: 'اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
      });
  }
  private async execute(
    tx: Tx,
    book: Prisma.AccountingBookGetPayload<object>,
    action: string,
    p: Record<string, unknown>,
    expected: number | undefined,
    actor: AuthenticatedActor,
    internal = false,
    stateEvents: BufferedStateEvent[] = [],
    financialSourceRebuild = false,
  ): Promise<unknown> {
    const bookId = book.id;
    if (action === 'workflow-create')
      return captureWorkflow(tx, book, p, actor);
    if (action === 'workflow-cancel') return cancelWorkflow(tx, book, p, actor);
    if (action === 'workflow-journal') {
      const result = await workflowJournal(
        tx,
        book,
        p,
        actor,
        async (payload) =>
          this.execute(
            tx,
            book,
            'journal-save',
            payload,
            undefined,
            actor,
            true,
            stateEvents,
          ) as Promise<{ id: string }>,
      );
      if ('noJournal' in result) return result;
      const journal = await tx.accountingJournal.findUniqueOrThrow({
        where: { id: result.id },
        include: journalInclude,
      });
      await this.validatePosting(tx, book, journal);
      return journal;
    }
    if (
      action === 'close-period' ||
      action === 'year-end-final' ||
      (action === 'year-end-preview' && p.operation === 'year-end-final')
    ) {
      const period = await tx.accountingPeriod.findFirst({
        where: {
          id: v.uuid(action === 'close-period' ? p.id : p.periodId)!,
          bookId,
        },
      });
      if (!period) throw new NotFoundException();
      await assertWorkflowsClosed(tx, book, period.startDate, period.endDate);
      const [pending] = await tx.$queryRaw<
        { count: number }[]
      >`SELECT count(*)::int AS count FROM finance_accounting_events e
        LEFT JOIN accounting_journals j ON j.id=e."journalId"
        WHERE e.kind<>${SALES_CONTRACT_EVENT} AND e."branchId"=${book.branchId}::uuid AND (e."journalId" IS NULL OR j.status='CANCELLED')
          AND (e."occurredAt" AT TIME ZONE 'Asia/Tehran')::date BETWEEN ${period.startDate}::date AND ${period.endDate}::date`;
      if (
        pending?.count ||
        (await hasPendingSalesContractAccounting(
          tx,
          book.branchId,
          period.startDate,
          period.endDate,
        ))
      )
        v.rule(
          'منابع مالی بدون سند این شعبه در بازه دوره باید پیش از بستن دوره تعیین تکلیف شوند.',
        );
    }
    if (action === 'journal-statement-preview') {
      const currencies =
        p.currencyMode === true ? await accountingCurrencies(this.master) : [];
      const basis = await documentStatementBasis(tx, book, p, currencies);
      const maker = (
        await this.identity.displayNames([actor.userId], actor.branchIds)
      )[0];
      return { ...basis, makerName: maker?.displayName ?? '' };
    }
    if (
      action === 'journal-statement-save' ||
      action === 'journal-statement-cancel'
    ) {
      const id = v.uuid(p.id, true);
      const existing = id
        ? await tx.accountingStatement.findFirst({ where: { id, bookId } })
        : null;
      if (id && !existing) throw new NotFoundException();
      if (existing) this.version(existing.version, expected);
      if (action === 'journal-statement-cancel' && !existing)
        v.rule('اعلامیه ذخیره‌شده را انتخاب کنید.');
      const names = await this.identity.displayNames(
        [actor.userId],
        actor.branchIds,
      );
      const actorName = names[0]?.displayName ?? '';
      const statementStatus =
        action === 'journal-statement-cancel'
          ? 'CANCELLED'
          : v.text(p.status, 16, true);
      if (!['CREATED', 'SENT', 'CANCELLED'].includes(statementStatus))
        v.invalid('وضعیت اعلامیه معتبر نیست.');
      const periodId = existing?.periodId ?? v.uuid(p.periodId)!;
      if (existing && p.periodId !== undefined && p.periodId !== periodId)
        v.rule('دوره مالی اعلامیه ذخیره‌شده قابل تغییر نیست.');
      const documentDate =
        action === 'journal-statement-cancel'
          ? existing!.documentDate
          : v.date(p.documentDate)!;
      const period = await tx.accountingPeriod.findFirst({
        where: { id: periodId, bookId },
      });
      if (
        !period ||
        documentDate < period.startDate ||
        documentDate > period.endDate
      )
        v.rule('تاریخ اعلامیه باید در دوره مالی انتخاب‌شده باشد.');
      const description =
        action === 'journal-statement-cancel'
          ? existing!.description
          : v.text(p.description, 2000);
      const notes = json(
        action === 'journal-statement-cancel'
          ? existing!.notes
          : setupNotes(p.notes, existing?.notes, actorName),
      );
      let record;
      if (existing) {
        record = await tx.accountingStatement.update({
          where: { id: existing.id },
          data: {
            documentDate,
            description,
            status: statementStatus,
            notes,
            lastModifierId: actor.userId,
            version: { increment: 1 },
          },
        });
      } else {
        const currencies =
          p.currencyMode === true
            ? await accountingCurrencies(this.master)
            : [];
        const basis = await documentStatementBasis(tx, book, p, currencies);
        if (basis.checksum !== p.checksum)
          throw new ConflictException(
            'اقلام اعلامیه تغییر کرده‌اند؛ پیش‌نمایش را دوباره باز کنید.',
          );
        const sequence = await tx.accountingStatement.aggregate({
          where: { bookId, periodId },
          _max: { number: true },
        });
        const recipientSequence = await tx.accountingStatement.aggregate({
          where: { bookId, periodId, recipientId: basis.recipientId },
          _max: { recipientNumber: true },
        });
        record = await tx.accountingStatement.create({
          data: {
            bookId,
            journalId: basis.journalId,
            periodId,
            recipientId: basis.recipientId,
            level: basis.level,
            currencyMode: basis.currencyMode,
            number: (sequence._max.number ?? 0) + 1,
            recipientNumber: (recipientSequence._max.recipientNumber ?? 0) + 1,
            documentDate,
            description,
            type: basis.type,
            status: statementStatus,
            makerId: actor.userId,
            snapshot: json(basis),
            notes,
          },
        });
      }
      const users = await this.identity.displayNames(
        [
          record.makerId,
          ...(record.lastModifierId ? [record.lastModifierId] : []),
        ],
        actor.branchIds,
      );
      return {
        ...record,
        makerName:
          users.find((user) => user.id === record.makerId)?.displayName ?? null,
        lastModifierName:
          users.find((user) => user.id === record.lastModifierId)
            ?.displayName ?? null,
      };
    }
    if (action === 'document-import-run') {
      if (!['TEMP', 'MEMORANDUM'].includes(String(p.saveMode)))
        v.invalid('وضعیت ورود سند معتبر نیست.');
      if (
        !Array.isArray(p.documents) ||
        !p.documents.length ||
        p.documents.length > 100
      )
        v.invalid('حداکثر ۱۰۰ سند معتبر قابل ورود است.');
      const documents = p.documents.map((item) => v.object(item));
      const totalLines = documents.reduce(
        (total, document) =>
          total + (Array.isArray(document.lines) ? document.lines.length : 0),
        0,
      );
      if (totalLines > 5000) v.rule('حداکثر ۵۰۰۰ قلم در هر دریافت مجاز است.');
      const typeId = v.uuid(p.typeId)!;
      const created: unknown[] = [];
      for (const document of documents) {
        created.push(
          await this.execute(
            tx,
            book,
            p.saveMode === 'MEMORANDUM'
              ? 'journal-memorandum-save'
              : 'journal-document-save',
            {
              periodId: document.periodId,
              typeId,
              documentDate: document.documentDate,
              description: document.description,
              lines: document.lines,
              attributes: {
                auxiliaryNumber: v.text(document.auxiliaryNumber, 100),
                descriptionEn: v.text(document.descriptionEn, 2000),
              },
            },
            undefined,
            actor,
            false,
            stateEvents,
          ),
        );
      }
      return { items: created, total: created.length };
    }
    if (
      ['unreview-document', 'return', 'cancel', 'reverse'].includes(action) &&
      p.id
    ) {
      if (
        await tx.accountingJournalTransfer.findFirst({
          where: { sourceBookId: bookId, sourceJournalId: v.uuid(p.id)! },
        })
      )
        v.rule(
          'سند ارسال‌شده به دفتر فرعی تا تعیین تکلیف سند مقصد قابل لغو یا برگشت نیست.',
        );
    }
    if (
      action === 'document-transfer-preview' ||
      action === 'document-transfer-run'
    ) {
      const first = await documentTransferPreview(tx, book, p, actor);
      if (action === 'document-transfer-preview') return first;
      if (!first.documents.length) v.rule('سند قابل ارسال وجود ندارد.');
      const basis =
        p.basisChecksum !== undefined
          ? await documentTransferPreview(
              tx,
              book,
              { ...p, ids: undefined },
              actor,
            )
          : first;
      // Main books only send to subsidiary books: acquiring destination locks cannot form a reverse-transfer cycle.
      for (const id of [
        ...new Set(basis.documents.map((doc) => doc.targetBookId)),
      ].sort()) {
        await this.book(tx, id, actor);
        await tx.$queryRaw`SELECT id FROM accounting_books WHERE id=${id}::uuid FOR UPDATE`;
      }
      if (p.basisChecksum !== undefined) {
        const reviewed = await documentTransferPreview(
          tx,
          book,
          { ...p, ids: undefined },
          actor,
        );
        if (p.basisChecksum !== reviewed.checksum)
          throw new ConflictException(
            'فهرست بررسی‌شده تغییر کرده است؛ فیلتر را دوباره اجرا کنید.',
          );
      }
      const preview = await documentTransferPreview(tx, book, p, actor);
      if (p.checksum !== preview.checksum)
        throw new ConflictException(
          'سند، نگاشت یا دفتر مقصد تغییر کرده است؛ فهرست را دوباره بخوانید.',
        );
      const items = [];
      for (const [index, doc] of preview.documents.entries()) {
        const destination = await this.book(tx, doc.targetBookId, actor);
        const events: BufferedStateEvent[] = [];
        const sourceKey = `TRANSFER:${bookId}:${preview.checksum}:${index}`;
        const created = (await this.execute(
          tx,
          destination,
          'journal-document-save',
          {
            periodId: doc.periodId,
            typeId: doc.typeId,
            documentDate: doc.documentDate,
            description: doc.description,
            lines: doc.lines,
            sourceKey,
            attributes: { transferSourceBookId: bookId },
          },
          undefined,
          actor,
          true,
          events,
        )) as { id: string };
        const commandId = randomUUID();
        await tx.accountingCommand.create({
          data: {
            id: commandId,
            bookId: destination.id,
            actorId: actor.userId,
            key: `TRANSFER:${preview.checksum}:${index}`,
            hash: createHash('sha256')
              .update(JSON.stringify(doc))
              .digest('hex'),
            action: 'document-transfer-receive',
            result: json(created),
          },
        });
        if (events.length)
          await tx.accountingJournalStateEvent.createMany({
            data: events.map((event, sequence) => ({
              ...event,
              bookId: destination.id,
              commandId,
              actorId: actor.userId,
              sequence: sequence + 1,
            })),
          });
        await tx.accountingJournalTransfer.createMany({
          data: doc.sourceIds.map((sourceJournalId) => ({
            sourceBookId: bookId,
            sourceJournalId,
            targetBookId: destination.id,
            targetJournalId: created.id,
          })),
        });
        items.push({ bookId: destination.id, journal: created });
      }
      return { items, total: items.length };
    }
    if (action === 'document-posting-preview' || action === 'post-documents') {
      if (!actor.permissions.includes('finance.journal.post'))
        throw new ForbiddenException();
      const preview = await documentPostingPreview(tx, book, p);
      const warnings = [...preview.warnings];
      for (const journal of preview.rows)
        warnings.push(...(await this.validatePosting(tx, book, journal)));
      const uniqueWarnings = [...new Set(warnings)];
      const checksum = createHash('sha256')
        .update(
          JSON.stringify({
            basis: preview.checksum,
            warnings: uniqueWarnings,
          }),
        )
        .digest('hex');
      if (action === 'document-posting-preview')
        return { ...preview, warnings: uniqueWarnings, checksum };
      if (p.checksum !== checksum)
        throw new ConflictException(
          'اسناد یا مانده‌های پیش‌نمایش تغییر کرده‌اند؛ دوباره پیش‌نمایش بگیرید.',
        );
      if (!preview.rows.length)
        v.rule('سند بررسی‌شده‌ای برای قطعی‌کردن وجود ندارد.');
      if (uniqueWarnings.length && p.acknowledgeWarnings !== true)
        v.rule('اخطارهای پیش‌نمایش باید پیش از قطعی‌کردن تأیید شوند.');
      const items: unknown[] = [];
      for (const journal of preview.rows) {
        const actualWarnings = await this.validatePosting(tx, book, journal);
        if (actualWarnings.some((warning) => !uniqueWarnings.includes(warning)))
          v.rule(
            'اخطار جدید در مانده حساب‌ها ایجاد شده است؛ دوباره پیش‌نمایش بگیرید.',
          );
        items.push(
          await this.execute(
            tx,
            book,
            'post',
            { id: journal.id },
            journal.version,
            actor,
            true,
            stateEvents,
          ),
        );
      }
      return { items, fromDate: preview.fromDate, toDate: preview.toDate };
    }
    if (action === 'general-document-date') {
      if (!actor.permissions.includes('finance.journal.post'))
        throw new ForbiddenException();
      const document = await tx.accountingGeneralDocument.findFirst({
        where: { id: v.uuid(p.id)!, bookId },
        include: { period: true, members: { include: { journal: true } } },
      });
      if (!document) throw new NotFoundException();
      this.version(document.version, expected);
      const documentDate = v.date(p.documentDate)!;
      if (
        document.period.status !== 'OPEN' ||
        documentDate < document.period.startDate ||
        documentDate > document.period.endDate
      )
        v.rule('تاریخ سند کل باید در دوره مالی باز باشد.');
      if (
        document.members.some(
          (member) => member.journal.documentDate! > documentDate,
        )
      )
        v.rule('تاریخ سند کل نباید قبل از بزرگترین تاریخ اسناد آن باشد.');
      const next = await tx.accountingGeneralDocument.findFirst({
        where: {
          bookId,
          periodId: document.periodId,
          number: { gt: document.number },
        },
        orderBy: { number: 'asc' },
      });
      if (next && documentDate > next.documentDate)
        v.rule('تاریخ سند کل نباید بعد از سند کل بعدی باشد.');
      if (
        documentDate !== document.documentDate &&
        (await tx.accountingJournal.findFirst({
          where: {
            bookId,
            periodId: document.periodId,
            documentDate: {
              gte:
                documentDate < document.documentDate
                  ? documentDate
                  : document.documentDate,
              lte:
                documentDate > document.documentDate
                  ? documentDate
                  : document.documentDate,
              not: document.documentDate,
            },
            status: { not: 'CANCELLED' },
          },
        }))
      )
        v.rule('بین تاریخ قبلی و تاریخ جدید سند حسابداری وجود دارد.');
      return tx.accountingGeneralDocument.update({
        where: { id: document.id },
        data: { documentDate, version: { increment: 1 } },
        include: { lines: true, members: true },
      });
    }
    if (
      action === 'general-document-preview' ||
      action === 'general-document-issue'
    ) {
      if (!actor.permissions.includes('finance.journal.post'))
        throw new ForbiddenException();
      const preview = await generalDocumentPreview(tx, bookId, p);
      if (action === 'general-document-preview') {
        const [names, branches] = await Promise.all([
          this.identity.displayNames(
            preview.items.map((row) => row.makerId),
            [book.branchId],
          ),
          this.identity.branches([book.branchId]),
        ]);
        return {
          ...preview,
          branchName: branches[0]?.name ?? '',
          branchCode: branches[0]?.code ?? '',
          items: preview.items.map((row) => ({
            ...row,
            makerName:
              names.find((name) => name.id === row.makerId)?.displayName ?? '',
          })),
        };
      }
      if (!preview.documents.length)
        v.rule('سند قطعی که برای آن سند کل صادر نشده باشد وجود ندارد.');
      if (v.text(p.checksum, 64, true) !== preview.checksum)
        throw new ConflictException(
          'مبنای سند کل تغییر کرده است؛ پیش‌نمایش را دوباره بخوانید.',
        );
      const documents = [];
      for (const [position, group] of preview.documents.entries()) {
        const header = await tx.accountingGeneralDocument.create({
          data: {
            bookId,
            periodId: preview.periodId,
            number: preview.nextNumber + position,
            documentDate: group.documentDate,
            method: preview.method,
            makerId: actor.userId,
          },
        });
        await tx.accountingGeneralDocumentMember.createMany({
          data: group.journalIds.map((journalId) => ({
            bookId,
            documentId: header.id,
            journalId,
          })),
        });
        await tx.accountingGeneralDocumentLine.createMany({
          data: group.lines.map((line) => ({
            bookId,
            documentId: header.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
          })),
        });
        documents.push(
          await tx.accountingGeneralDocument.findUniqueOrThrow({
            where: { id: header.id },
            include: { lines: true, members: true },
          }),
        );
      }
      return { documents };
    }
    if (action === 'review-all-preview' || action === 'review-all-documents') {
      const periodId = v.uuid(p.periodId)!;
      const period = await tx.accountingPeriod.findFirst({
        where: { id: periodId, bookId, status: 'OPEN' },
      });
      if (!period) v.rule('دوره مالی باز همین دفتر لازم است.');
      if (typeof p.undo !== 'boolean') v.invalid('عملیات بررسی معتبر نیست.');
      const undo = p.undo === true;
      const filter = documentSqlFilter(
        p.filter ?? { type: 'group', mode: 'all', children: [] },
      );
      const statuses = undo
        ? Prisma.sql`j.status='APPROVED'`
        : Prisma.sql`j.status IN ('DRAFT','PENDING_APPROVAL')`;
      const items = await tx.$queryRaw<
        { id: string; expectedVersion: number }[]
      >(
        Prisma.sql`SELECT j.id,j.version AS "expectedVersion" FROM accounting_journals j WHERE j."bookId"=${bookId}::uuid AND j."periodId"=${periodId}::uuid AND ${statuses} AND (${filter}) ORDER BY j."documentDate",j.number,j.id LIMIT 501`,
      );
      if (items.length > 500) v.rule('فیلتر را به حداکثر ۵۰۰ سند محدود کنید.');
      const checksum = createHash('sha256')
        .update(
          JSON.stringify({
            bookId,
            periodId,
            periodVersion: period.version,
            undo,
            filter: p.filter,
            items,
          }),
        )
        .digest('hex');
      if (action === 'review-all-preview')
        return { items, total: items.length, checksum };
      if (p.checksum !== checksum)
        throw new ConflictException(
          'فهرست یا نسخه اسناد تغییر کرده است؛ دوباره بررسی کنید.',
        );
      if (!items.length) v.rule('سندی برای عملیات انتخاب نشده است.');
      return this.execute(
        tx,
        book,
        undo ? 'unreview-documents' : 'review-documents',
        { items, reason: p.reason },
        undefined,
        actor,
        false,
        stateEvents,
      );
    }
    if (action === 'review-documents' || action === 'unreview-documents') {
      if (!actor.permissions.includes('finance.journal.approve'))
        throw new ForbiddenException();
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 500)
        v.invalid('بین یک تا ۵۰۰ سند انتخاب کنید.');
      const items = p.items.map((raw) => {
        const item = v.object(raw);
        const expectedVersion = Number(item.expectedVersion);
        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
          v.invalid('نسخه معتبر همه اسناد لازم است.');
        return { id: v.uuid(item.id)!, expectedVersion };
      });
      if (new Set(items.map((item) => item.id)).size !== items.length)
        v.invalid('انتخاب تکراری سند مجاز نیست.');
      const reason = v.text(p.reason, 2000);
      const result: unknown[] = [];
      for (const item of items)
        result.push(
          await this.execute(
            tx,
            book,
            action === 'review-documents'
              ? 'review-document'
              : 'unreview-document',
            { id: item.id, reason },
            item.expectedVersion,
            actor,
            false,
            stateEvents,
          ),
        );
      return { items: result, total: result.length };
    }
    if (action === 'review-document' || action === 'unreview-document') {
      const id = v.uuid(p.id)!;
      const reason = v.text(p.reason, 2000);
      const journal = await tx.accountingJournal.findFirst({
        where: { id, bookId },
      });
      if (!journal) throw new NotFoundException();
      this.version(journal.version, expected);
      if (!actor.permissions.includes('finance.journal.approve'))
        throw new ForbiddenException();
      if (action === 'unreview-document') {
        if (journal.status !== 'APPROVED')
          v.rule('فقط سند بررسی‌شده قابل لغو بررسی است.');
        const accountIds = new Set(
          (
            await tx.accountingJournalLine.findMany({
              where: { journalId: id, journal: { bookId } },
              select: { accountId: true },
            })
          ).map((line) => line.accountId),
        );
        if (
          accountIds.has(null) ||
          (await tx.accountingAccount.count({
            where: {
              bookId,
              active: true,
              level: 'SUBSIDIARY',
              id: {
                in: [...accountIds].filter((value): value is string => !!value),
              },
            },
          })) !== accountIds.size
        )
          v.rule('سند دارای حساب معین غیرفعال قابل لغو بررسی نیست.');
        return this.execute(
          tx,
          book,
          'return',
          { id, reason },
          journal.version,
          actor,
          false,
          stateEvents,
        );
      }
      let version = journal.version;
      if (journal.status === 'DRAFT') {
        const submitted = (await this.execute(
          tx,
          book,
          'submit',
          { id, reason },
          version,
          actor,
          false,
          stateEvents,
        )) as { version: number };
        version = submitted.version;
      } else if (journal.status !== 'PENDING_APPROVAL')
        v.rule('وضعیت سند برای بررسی معتبر نیست.');
      return this.execute(
        tx,
        book,
        'approve',
        { id, reason },
        version,
        actor,
        false,
        stateEvents,
      );
    }
    const hasNotes =
      p.notes !== undefined ||
      (p.attributes &&
        typeof p.attributes === 'object' &&
        'notes' in p.attributes);
    const actorName = hasNotes
      ? ((await this.identity.displayNames([actor.userId], actor.branchIds))[0]
          ?.displayName ?? actor.userId)
      : actor.userId;
    const setupResult = await executeAccountSetup(
      tx,
      bookId,
      action,
      p,
      expected,
      actor,
      actorName,
    );
    if (setupResult !== undefined) return setupResult;
    if (action === 'delete-base-record') {
      const id = v.uuid(p.id)!.toLowerCase();
      const entity = v.text(p.entity, 30, true);
      const row =
        entity === 'configuration'
          ? await tx.accountingConfiguration.findFirst({
              where: { id, bookId },
            })
          : entity === 'account'
            ? await tx.accountingAccount.findFirst({ where: { id, bookId } })
            : entity === 'detail'
              ? await tx.accountingDetail.findFirst({ where: { id, bookId } })
              : entity === 'account-group'
                ? await tx.accountingAccountGroup.findFirst({
                    where: { id, bookId },
                  })
                : entity === 'detail-group'
                  ? await tx.accountingDetailGroup.findFirst({
                      where: { id, bookId },
                    })
                  : entity === 'template'
                    ? await tx.accountingTemplate.findFirst({
                        where: { id, bookId },
                      })
                    : null;
      if (!row) throw new NotFoundException('رکورد اطلاعات پایه پیدا نشد.');
      this.version(row.version, expected);
      if (
        entity === 'configuration' &&
        'kind' in row &&
        (typeof row.kind !== 'string' ||
          ![
            'fiscal-years',
            'voucher-types',
            'detail-types',
            'allocation-templates',
            'account-mappings',
          ].includes(row.kind))
      )
        v.rule('حذف این نوع رکورد عملیاتی پشتیبانی نمی‌شود.');
      if (
        entity === 'configuration' &&
        'attributes' in row &&
        v.attributes(row.attributes).isSystem === true
      )
        v.rule('نوع تفصیلی سیستم قابل حذف نیست.');
      // JSON references supplement the restrictive foreign keys; never orphan a
      // mapping, template or hierarchy setting that refers to the selected UUID.
      const [configurations, accounts, templates, journals] = await Promise.all(
        [
          tx.accountingConfiguration.findMany({
            where: { bookId },
            select: { id: true, attributes: true },
          }),
          tx.accountingAccount.findMany({
            where: { bookId },
            select: { id: true, attributes: true },
          }),
          tx.accountingTemplate.findMany({
            where: { bookId },
            include: { lines: true },
          }),
          tx.accountingJournal.findMany({
            where: { bookId },
            select: { id: true, attributes: true },
          }),
        ],
      );
      if (
        configurations.some(
          (item) =>
            !(entity === 'configuration' && item.id === id) &&
            JSON.stringify(item.attributes).toLowerCase().includes(id),
        ) ||
        accounts.some(
          (item) =>
            !(entity === 'account' && item.id === id) &&
            JSON.stringify(item.attributes).toLowerCase().includes(id),
        ) ||
        templates.some(
          (item) =>
            !(entity === 'template' && item.id === id) &&
            JSON.stringify(item).toLowerCase().includes(id),
        ) ||
        journals.some((item) =>
          JSON.stringify(item.attributes).toLowerCase().includes(id),
        )
      )
        v.rule('رکورد در نگاشت، تنظیمات یا الگو استفاده شده و قابل حذف نیست.');
      // DeleteMany includes book and version even under the per-book command lock.
      // Restrict FKs reject any referenced period, journal, detail or group member.
      try {
        const deleted =
          entity === 'configuration'
            ? await tx.accountingConfiguration.deleteMany({
                where: { id, bookId, version: row.version },
              })
            : entity === 'account'
              ? await tx.accountingAccount.deleteMany({
                  where: { id, bookId, version: row.version },
                })
              : entity === 'detail'
                ? await tx.accountingDetail.deleteMany({
                    where: { id, bookId, version: row.version },
                  })
                : entity === 'account-group'
                  ? await tx.accountingAccountGroup.deleteMany({
                      where: { id, bookId, version: row.version },
                    })
                  : entity === 'detail-group'
                    ? await tx.accountingDetailGroup.deleteMany({
                        where: { id, bookId, version: row.version },
                      })
                    : await tx.accountingTemplate.deleteMany({
                        where: { id, bookId, version: row.version },
                      });
        if (deleted.count !== 1)
          throw new ConflictException('رکورد هم‌زمان تغییر کرده است.');
      } catch (cause) {
        if (
          cause &&
          typeof cause === 'object' &&
          'code' in cause &&
          cause.code === 'P2003'
        )
          v.rule('رکورد در اطلاعات حسابداری استفاده شده و قابل حذف نیست.');
        throw cause;
      }
      return { id, entity, deleted: true };
    }
    if (
      [
        'year-end-preview',
        'year-end-closing',
        'year-end-opening',
        'year-end-final',
        'year-end-nature-adjustment',
      ].includes(action)
    ) {
      if (
        Object.keys(p).some(
          (key) =>
            ![
              'periodId',
              'nextPeriodId',
              'retainedAccountId',
              'typeId',
              'documentDate',
              'fxCarryPolicy',
              'templateId',
              'templateVersion',
              'accountIds',
              'operation',
              'checksum',
              'auxiliaryNumber',
              'reverseAdjustment',
            ].includes(key),
        )
      )
        v.invalid('فیلد پایان سال معتبر نیست.');
      if (p.reverseAdjustment === true)
        v.rule('برگشت تعدیل ماهیت به فرمان مستقل نیاز دارد.');
      const periodId = v.uuid(p.periodId)!,
        period = await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId },
        });
      if (!period) throw new NotFoundException();
      const currencyReference = this.master
        ? (await accountingCurrencies(this.master)).find(
            (c) => c.code === book.baseCurrency,
          )
        : undefined;
      // Existing posting validation requires integer IRR amounts regardless of generic currency metadata.
      const scale =
        book.baseCurrency === 'IRR'
          ? 0
          : (currencyReference?.decimalDigits ??
            (['USD', 'EUR', 'TRY', 'AED'].includes(book.baseCurrency)
              ? 2
              : -1));
      if (!Number.isInteger(scale) || scale < 0 || scale > 8)
        v.rule('دقت ارز پایه برای عملیات پایان سال تعریف نشده است.');
      const operation =
        action === 'year-end-preview'
          ? (p.operation ?? 'year-end-closing')
          : action;
      if (
        ![
          'year-end-closing',
          'year-end-opening',
          'year-end-final',
          'year-end-nature-adjustment',
        ].includes(String(operation))
      )
        v.invalid('عملیات پایان سال معتبر نیست.');
      const closingTemplateId =
        operation === 'year-end-closing' ? v.uuid(p.templateId, true) : null;
      const closingTemplate = closingTemplateId
        ? await tx.accountingTemplate.findFirst({
            where: {
              id: closingTemplateId,
              bookId,
              kind: 'CLOSING',
              active: true,
            },
            include: { lines: true },
          })
        : null;
      if (closingTemplateId && !closingTemplate)
        v.rule('الگوی بستن حساب فعال همین دفتر لازم است.');
      if (closingTemplate) {
        this.version(closingTemplate.version, p.templateVersion);
      }
      const sourceKey =
        operation === 'year-end-opening'
          ? `OPEN:${periodId}`
          : operation === 'year-end-final'
            ? `FINAL:${periodId}`
            : operation === 'year-end-nature-adjustment'
              ? `NATURE:${periodId}`
              : `CLOSE:${periodId}`;
      const accounts = await tx.accountingAccount.findMany({
          where: { bookId },
          orderBy: { id: 'asc' },
        }),
        accountMap = new Map(accounts.map((a) => [a.id, a]));
      const lots = await tx.$queryRaw<
        {
          accountId: string;
          detail4Id: string | null;
          detail5Id: string | null;
          detail6Id: string | null;
          currency: string | null;
          fxSnapshotId: string | null;
          rate: Prisma.Decimal | null;
          sourceLineIds: string[];
          trackingNumber: string | null;
          trackingDate: string | null;
          valuationCurrency: string | null;
          balance: Prisma.Decimal;
          foreignBalance: Prisma.Decimal | null;
        }[]
      >`
        SELECT l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",l.currency,l."fxSnapshotId",l.rate,l.attributes->>'trackingNumber' AS "trackingNumber",l.attributes->>'trackingDate' AS "trackingDate",l.attributes->>'valuationCurrency' AS "valuationCurrency",
          ARRAY_AGG(l.id ORDER BY l.id) AS "sourceLineIds", SUM(l.debit-l.credit) AS balance,
          SUM(CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE -l."foreignAmount" END) AS "foreignBalance"
        FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
        WHERE j."bookId"=${bookId}::uuid AND j."periodId"=${periodId}::uuid AND j.status='POSTED'
          AND (${operation !== 'year-end-opening'} OR j."sourceKey" IS NULL OR j."sourceKey" NOT LIKE 'FINAL:%')
        GROUP BY l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",l.currency,l."fxSnapshotId",l.rate,l.attributes->>'trackingNumber',l.attributes->>'trackingDate',l.attributes->>'valuationCurrency'`;
      lots.sort((a, b) =>
        JSON.stringify([
          a.accountId,
          a.detail4Id,
          a.detail5Id,
          a.detail6Id,
          a.currency,
          a.fxSnapshotId,
          a.rate?.toFixed(),
          a.valuationCurrency,
          a.trackingNumber,
          a.trackingDate,
        ]).localeCompare(
          JSON.stringify([
            b.accountId,
            b.detail4Id,
            b.detail5Id,
            b.detail6Id,
            b.currency,
            b.fxSnapshotId,
            b.rate?.toFixed(),
            b.valuationCurrency,
            b.trackingNumber,
            b.trackingDate,
          ]),
        ),
      );
      for (const lot of lots)
        validateHistoricalCarry(
          lot.balance.toFixed(),
          lot.foreignBalance?.toFixed() ?? null,
        );
      const balances = lots
        .filter((r) => !DecimalValue.parse(r.balance.toFixed()).isZero)
        .map((r) => ({
          ...r,
          balance: r.balance.toFixed(),
          permanent: accountMap.get(r.accountId)?.permanent ?? true,
        }));
      const drafts = await tx.accountingJournal.count({
        where: {
          bookId,
          periodId,
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
        },
      });
      const sourceJournals = await tx.accountingJournal.findMany({
        where: { bookId, periodId, status: { not: 'CANCELLED' } },
        select: { id: true, version: true, status: true },
        orderBy: { id: 'asc' },
      });
      const checksum = createHash('sha256')
        .update(
          JSON.stringify(
            canonical({
              book: { id: book.id, version: book.version },
              period,
              accounts,
              closingTemplate,
              currencyPolicy: {
                id: currencyReference?.id ?? 'DEC-OPEN-004',
                version: currencyReference?.version ?? 1,
                scale,
                declaredScale: currencyReference?.decimalDigits ?? null,
                postingPolicy:
                  book.baseCurrency === 'IRR'
                    ? 'IRR_INTEGER'
                    : 'CURRENCY_REFERENCE',
              },
              lots,
              sourceJournals,
              operation,
              payload: { ...p, checksum: undefined, operation: undefined },
            }),
          ),
        )
        .digest('hex');
      if (action === 'year-end-preview' && p.operation === undefined)
        return {
          period,
          unfinished: drafts,
          checksum,
          balances: balances.map((r) => ({
            accountId: r.accountId,
            detail4Id: r.detail4Id,
            detail5Id: r.detail5Id,
            detail6Id: r.detail6Id,
            balance: r.balance,
            permanent: r.permanent,
          })),
        };
      this.require(actor, 'finance.journal.create');
      let existing = await tx.accountingJournal.findUnique({
        where: { bookId_sourceKey: { bookId, sourceKey } },
        include: journalInclude,
      });
      const operationInput = JSON.stringify(
        canonical({ ...p, checksum: undefined, operation: undefined }),
      );
      const reissueOfId = existing?.status === 'CANCELLED' ? existing.id : null;
      if (existing && action !== 'year-end-preview') {
        if (existing.status === 'CANCELLED') {
          await tx.accountingJournal.update({
            where: { id: existing.id },
            data: {
              sourceKey: `${sourceKey}:CANCELLED:${existing.id}`,
              version: { increment: 1 },
              attributes: json({
                ...v.attributes(existing.attributes),
                supersededSourceKey: sourceKey,
              }),
            },
          });
          existing = null;
        } else {
          if (
            v.attributes(existing.attributes).operationInput !== operationInput
          )
            throw new ConflictException(
              'این عملیات قبلاً با مشخصات دیگری صادر شده است.',
            );
          return existing;
        }
      }
      if (drafts) v.rule('تمام اسناد دوره باید تعیین تکلیف شده باشند.');
      const hasFx = balances.some(
        (r) => r.currency && r.currency !== book.baseCurrency,
      );
      if (hasFx && p.fxCarryPolicy !== 'HISTORICAL_LOTS')
        v.rule(
          'برای انتقال ارزی، سیاست حفظ ارزش تاریخی و نرخ‌های سند مبدأ را انتخاب کنید.',
        );
      const targetDate = v.date(p.documentDate)!;
      if (
        operation !== 'year-end-opening' &&
        (await tx.accountingJournal.findFirst({
          where: {
            bookId,
            periodId,
            status: 'POSTED',
            documentDate: { gt: targetDate },
          },
        }))
      )
        v.rule('تاریخ سند پایان سال نباید قبل از آخرین سند قطعی دوره باشد.');
      let targetPeriodId = periodId,
        rows: Record<string, unknown>[] = [];
      if (operation === 'year-end-closing') {
        if (period.status !== 'OPEN') v.rule('دوره مبدأ باید باز باشد.');
        const retainedId = closingTemplate?.retainedAccountId
            ? closingTemplate.retainedAccountId
            : v.uuid(p.retainedAccountId)!,
          retained = accountMap.get(retainedId);
        if (
          !retained ||
          !retained.active ||
          retained.level !== 'SUBSIDIARY' ||
          !retained.permanent
        )
          v.rule('حساب دائمی مقصد سود و زیان لازم است.');
        const sourceSelections = (closingTemplate?.lines ?? []).filter(
          (line) => !accountMap.get(line.accountId)?.permanent,
        );
        const targets = (closingTemplate?.lines ?? [])
          .filter(
            (line) => accountMap.get(line.accountId)?.permanent && line.include,
          )
          .sort((a, b) => a.position - b.position);
        if (targets.length)
          distributeClosing(
            '0',
            targets.map((line) => line.percentage.toString()),
            scale,
          );
        const temp = selectClosingLots(balances, sourceSelections);
        if (!temp.length) v.rule('حساب موقت با مانده باقی نمانده است.');
        let net = DecimalValue.zero();
        rows = temp.map((r) => {
          const value = DecimalValue.parse(r.balance);
          net = net.add(value);
          return {
            accountId: r.accountId,
            detail4Id: r.detail4Id,
            detail5Id: r.detail5Id,
            detail6Id: r.detail6Id,
            currency: r.currency,
            fxSnapshotId: r.fxSnapshotId,
            attributes: {
              sourceLineIds: r.sourceLineIds,
              ...(r.valuationCurrency
                ? { valuationCurrency: r.valuationCurrency }
                : {}),
              ...(r.trackingNumber ? { trackingNumber: r.trackingNumber } : {}),
              ...(r.trackingDate ? { trackingDate: r.trackingDate } : {}),
            },
            rate: r.rate?.toFixed() ?? null,
            foreignAmount: r.foreignBalance
              ? DecimalValue.parse(r.foreignBalance.toFixed()).isNegative
                ? DecimalValue.zero()
                    .subtract(DecimalValue.parse(r.foreignBalance.toFixed()))
                    .toString()
                : r.foreignBalance.toFixed()
              : null,
            debit: value.isNegative
              ? DecimalValue.zero().subtract(value).toString()
              : '0',
            credit: value.isNegative ? '0' : value.toString(),
          };
        });
        const destinations = targets.length
          ? targets
          : [
              {
                accountId: retainedId,
                detail4Id: null,
                detail5Id: null,
                detail6Id: null,
                percentage: '100',
              },
            ];
        // Validate percentages even when selected positive and negative balances net to zero.
        const shares = distributeClosing(
          net.toString(),
          destinations.map((line) => line.percentage.toString()),
          scale,
        );
        for (const [index, target] of destinations.entries()) {
          const value = DecimalValue.parse(shares[index]!);
          if (!value.isZero)
            rows.push({
              accountId: target.accountId,
              detail4Id: target.detail4Id,
              detail5Id: target.detail5Id,
              detail6Id: target.detail6Id,
              debit: value.isNegative ? '0' : value.toString(),
              credit: value.isNegative
                ? DecimalValue.zero().subtract(value).toString()
                : '0',
            });
        }
      } else if (
        operation === 'year-end-final' ||
        operation === 'year-end-nature-adjustment'
      ) {
        if (period.status !== 'OPEN') v.rule('دوره مبدأ باید باز باشد.');
        if (
          operation === 'year-end-final' &&
          balances.some((r) => !r.permanent)
        )
          v.rule('حساب‌های موقت هنوز بسته نشده‌اند.');
        const counterpartId = v.uuid(p.retainedAccountId)!;
        const counterpart = accountMap.get(counterpartId);
        if (
          !counterpart?.active ||
          !counterpart.permanent ||
          counterpart.level !== 'SUBSIDIARY'
        )
          v.rule('حساب دائمی طرف مقابل لازم است.');
        if (
          operation === 'year-end-final' &&
          balances.some((r) => r.accountId === counterpartId)
        )
          v.rule('حساب واسطه اختتامیه باید بدون مانده باشد.');
        const selectedIds =
          operation === 'year-end-nature-adjustment'
            ? Array.isArray(p.accountIds)
              ? p.accountIds.map((id) => v.uuid(id)!)
              : []
            : [];
        if (
          operation === 'year-end-nature-adjustment' &&
          (!selectedIds.length ||
            new Set(selectedIds).size !== selectedIds.length)
        )
          v.rule('حساب‌های مجاز تعدیل را بدون تکرار انتخاب کنید.');
        if (selectedIds.includes(counterpartId))
          v.rule('طرف مقابل نمی‌تواند حساب مبدأ باشد.');
        if (
          selectedIds.some(
            (id) =>
              !accountMap.get(id)?.active ||
              accountMap.get(id)?.nature === 'ANY',
          )
        )
          v.rule('حساب مجاز با ماهیت کنترل‌شده لازم است.');
        const accountBalances = new Map<string, DecimalValue>();
        for (const r of balances)
          accountBalances.set(
            r.accountId,
            (accountBalances.get(r.accountId) ?? DecimalValue.zero()).add(
              DecimalValue.parse(r.balance),
            ),
          );
        const selected = balances.filter((r) => {
          if (operation === 'year-end-final')
            return r.accountId !== counterpartId;
          const account = accountMap.get(r.accountId)!;
          const value = accountBalances.get(r.accountId)!;
          return (
            selectedIds.includes(r.accountId) &&
            !value.isZero &&
            account.nature !== 'ANY' &&
            (account.nature === 'DEBIT' ? value.isNegative : !value.isNegative)
          );
        });
        if (!selected.length) v.rule('مانده مجازی برای عملیات وجود ندارد.');
        let net = DecimalValue.zero();
        rows = selected.map((r) => {
          const value = DecimalValue.parse(r.balance);
          net = net.add(value);
          return {
            accountId: r.accountId,
            detail4Id: r.detail4Id,
            detail5Id: r.detail5Id,
            detail6Id: r.detail6Id,
            currency: r.currency,
            fxSnapshotId: r.fxSnapshotId,
            rate: r.rate?.toFixed() ?? null,
            attributes: {
              sourceLineIds: r.sourceLineIds,
              ...(r.valuationCurrency
                ? { valuationCurrency: r.valuationCurrency }
                : {}),
              ...(r.trackingNumber ? { trackingNumber: r.trackingNumber } : {}),
              ...(r.trackingDate ? { trackingDate: r.trackingDate } : {}),
            },
            foreignAmount: r.foreignBalance
              ? r.foreignBalance.abs().toFixed()
              : null,
            debit: value.isNegative
              ? DecimalValue.zero().subtract(value).toString()
              : '0',
            credit: value.isNegative ? '0' : value.toString(),
          };
        });
        if (operation === 'year-end-final') {
          if (!net.isZero) v.rule('مانده‌های دائمی برای اختتامیه تراز نیستند.');
        } else {
          rows.push(
            ...selected.map((r, index) => ({
              ...rows[index]!,
              accountId: counterpartId,
              debit: rows[index]!.credit,
              credit: rows[index]!.debit,
            })),
          );
        }
      } else {
        if (period.status !== 'CLOSED') v.rule('ابتدا دوره مبدأ را ببندید.');
        const nextId = v.uuid(p.nextPeriodId)!,
          next = await tx.accountingPeriod.findFirst({
            where: { id: nextId, bookId, status: 'OPEN' },
          });
        if (!next || next.startDate <= period.endDate)
          v.rule('دوره باز بعدی لازم است.');
        if (balances.some((r) => r.permanent === false))
          v.rule('حساب‌های موقت هنوز بسته نشده‌اند.');
        if (!balances.length) v.rule('مانده‌ای برای انتقال وجود ندارد.');
        if (
          !(await tx.accountingJournal.findFirst({
            where: {
              bookId,
              periodId,
              sourceKey: `FINAL:${periodId}`,
              status: 'POSTED',
            },
          }))
        )
          v.rule('اختتامیه قطعی مبدأ برای افتتاحیه لازم است.');
        targetPeriodId = nextId;
        rows = balances.map((r) => {
          const value = DecimalValue.parse(r.balance);
          return {
            accountId: r.accountId,
            detail4Id: r.detail4Id,
            detail5Id: r.detail5Id,
            detail6Id: r.detail6Id,
            currency: r.currency,
            fxSnapshotId: r.fxSnapshotId,
            attributes: {
              sourceLineIds: r.sourceLineIds,
              ...(r.valuationCurrency
                ? { valuationCurrency: r.valuationCurrency }
                : {}),
              ...(r.trackingNumber ? { trackingNumber: r.trackingNumber } : {}),
              ...(r.trackingDate ? { trackingDate: r.trackingDate } : {}),
            },
            rate: r.rate?.toFixed() ?? null,
            foreignAmount: r.foreignBalance
              ? DecimalValue.parse(r.foreignBalance.toFixed()).isNegative
                ? DecimalValue.zero()
                    .subtract(DecimalValue.parse(r.foreignBalance.toFixed()))
                    .toString()
                : r.foreignBalance.toFixed()
              : null,
            debit: value.isNegative ? '0' : value.toString(),
            credit: value.isNegative
              ? DecimalValue.zero().subtract(value).toString()
              : '0',
          };
        });
        if (!rows.length) v.rule('مانده‌ای برای انتقال وجود ندارد.');
      }
      await this.references(tx, bookId, v.lines(rows, true));
      if (action === 'year-end-preview')
        return {
          period,
          unfinished: drafts,
          checksum,
          balances,
          lines: rows,
          operation,
        };
      if (action !== 'year-end-preview' && p.checksum !== checksum)
        throw new ConflictException(
          'مبنای پایان سال تغییر کرده است؛ دوباره پیش‌نمایش بگیرید.',
        );
      const result = (await this.execute(
        tx,
        book,
        'journal-save',
        {
          periodId: targetPeriodId,
          typeId: closingTemplate?.voucherTypeId ?? p.typeId,
          documentDate: targetDate,
          description:
            operation === 'year-end-opening'
              ? 'افتتاحیه دوره عملیاتی'
              : operation === 'year-end-final'
                ? 'اختتامیه دوره عملیاتی'
                : operation === 'year-end-nature-adjustment'
                  ? 'تعدیل ماهیت حساب‌ها'
                  : 'بستن حساب‌های موقت',
          lines: rows,
        },
        undefined,
        actor,
        true,
        stateEvents,
      )) as { id: string };
      const generated = await tx.accountingJournal.update({
        where: { id: result.id },
        data: {
          sourceKey,
          attributes: {
            sourcePeriodId: periodId,
            operation,
            operationInput,
            currencyPolicyId: currencyReference?.id ?? 'DEC-OPEN-004',
            currencyPolicyVersion: String(currencyReference?.version ?? 1),
            currencyScale: String(scale),
            declaredCurrencyScale: String(
              currencyReference?.decimalDigits ?? scale,
            ),
            currencyScalePolicy:
              book.baseCurrency === 'IRR'
                ? 'IRR_INTEGER'
                : 'CURRENCY_REFERENCE',
            ...(reissueOfId ? { reissueOfId } : {}),
            auxiliaryNumber: v.text(p.auxiliaryNumber, 100),
            sourceChecksum: checksum,
            sourceJournalChecksum: createHash('sha256')
              .update(JSON.stringify(sourceJournals))
              .digest('hex'),
            sourceAccountChecksum: createHash('sha256')
              .update(JSON.stringify(canonical(accounts)))
              .digest('hex'),
            fxCarryPolicy: hasFx ? 'HISTORICAL_LOTS' : 'BASE',
            ...(closingTemplate
              ? {
                  templateId: closingTemplate.id,
                  templateVersion: String(closingTemplate.version),
                  voucherTypeId: closingTemplate.voucherTypeId ?? '',
                  retainedAccountId: closingTemplate.retainedAccountId ?? '',
                }
              : {}),
          },
        },
        include: journalInclude,
      });
      await this.validatePosting(tx, book, generated);
      return generated;
    }
    if (action === 'revaluation-preview' || action === 'revaluation-run') {
      const periodId = v.uuid(p.periodId)!,
        asOf = v.date(p.asOfDate)!;
      const basis = await this.revaluationBasis(tx, book, periodId, asOf);
      const templateId = v.uuid(p.templateId, true),
        template = templateId
          ? await tx.accountingTemplate.findFirst({
              where: {
                id: templateId,
                bookId,
                kind: 'REVALUATION',
                active: true,
              },
              include: { lines: true },
            })
          : null;
      if (templateId && !template)
        v.rule('الگوی تسعیر فعال همین دفتر لازم است.');
      if (template) {
        this.version(template.version, p.templateVersion);
        if (template.lines.length)
          v.rule(
            'اجرای الگوی تسعیر دارای ردیف انتخابی یا درصدی هنوز پشتیبانی نمی‌شود.',
          );
      }
      const selections = v.object(p.rates),
        gainId = template?.gainAccountId ?? v.uuid(p.gainAccountId)!,
        lossId = template?.lossAccountId ?? v.uuid(p.lossAccountId)!;
      const changes: Record<string, unknown>[] = [],
        rows: Record<string, unknown>[] = [];
      for (const position of basis.rows) {
        const rateId = v.uuid(selections[position.currency])!,
          rate = await tx.accountingFxSnapshot.findFirst({
            where: {
              id: rateId,
              bookId,
              currency: position.currency,
              status: 'APPROVED',
            },
          });
        if (!rate || rate.validFrom > new Date() || rate.validTo < new Date())
          v.rule('نرخ مصوب معتبر برای تمام ارزها لازم است.');
        const value = DecimalValue.parse(position.quantity)
          .multiply(DecimalValue.parse(rate.rate.toString()))
          .round(
            book.baseCurrency === 'IRR' ? 0 : 2,
            book.baseCurrency === 'IRR' ? 'HALF_UP' : 'HALF_EVEN',
          );
        const delta = value.subtract(DecimalValue.parse(position.base));
        changes.push({
          ...position,
          rate: rate.rate.toString(),
          newValue: value.toString(),
          difference: delta.toString(),
        });
        if (delta.isZero) continue;
        const amount = delta.isNegative
          ? DecimalValue.zero().subtract(delta).toString()
          : delta.toString();
        rows.push({
          accountId: position.accountId,
          detail4Id: position.detail4Id,
          detail5Id: position.detail5Id,
          detail6Id: position.detail6Id,
          debit: delta.isNegative ? '0' : amount,
          credit: delta.isNegative ? amount : '0',
          fxSnapshotId: rate.id,
          attributes: { valuationCurrency: position.currency },
        });
        rows.push({
          accountId: delta.isNegative ? lossId : gainId,
          debit: delta.isNegative ? amount : '0',
          credit: delta.isNegative ? '0' : amount,
        });
      }
      if (action === 'revaluation-preview')
        return { rows: changes, basisChecksum: basis.checksum };
      if (!rows.length) v.rule('اختلاف تسعیر وجود ندارد.');
      if (p.basisChecksum !== basis.checksum)
        v.rule('مانده‌ها پس از پیش‌نمایش تغییر کرده‌اند؛ دوباره کنترل کنید.');
      const selectionHash = createHash('sha256')
        .update(JSON.stringify(canonical({ selections, gainId, lossId })))
        .digest('hex');
      const sourceKey = `REVALUE:${periodId}:${asOf}:${basis.checksum}:${selectionHash}`;
      const existing = await tx.accountingJournal.findUnique({
        where: { bookId_sourceKey: { bookId, sourceKey } },
        include: journalInclude,
      });
      if (existing) return existing;
      const pending = await tx.accountingJournal.count({
        where: {
          bookId,
          sourceKey: { startsWith: `REVALUE:${periodId}:${asOf}:` },
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
        },
      });
      if (pending) v.rule('سند تسعیر قبلی این تاریخ هنوز نهایی نشده است.');
      const result = (await this.execute(
        tx,
        book,
        'journal-save',
        {
          periodId,
          typeId: template?.voucherTypeId ?? p.typeId,
          documentDate: asOf,
          description: v.text(p.reason, 2000),
          lines: rows,
        },
        undefined,
        actor,
        true,
        stateEvents,
      )) as { id: string };
      return tx.accountingJournal.update({
        where: { id: result.id },
        data: {
          sourceKey,
          attributes: {
            operation: 'REVALUATION',
            asOf,
            periodId,
            basisChecksum: basis.checksum,
            ...(template
              ? {
                  templateId: template.id,
                  templateVersion: String(template.version),
                  voucherTypeId: template.voucherTypeId ?? '',
                  gainAccountId: template.gainAccountId ?? '',
                  lossAccountId: template.lossAccountId ?? '',
                }
              : {}),
          },
        },
        include: journalInclude,
      });
    }
    if (action === 'create-batch') {
      const mappingId = v.uuid(p.mappingId)!,
        mapping = await tx.accountingConfiguration.findFirst({
          where: {
            id: mappingId,
            bookId,
            kind: 'account-mappings',
            active: true,
          },
        });
      if (!mapping) v.rule('نگاشت معتبر لازم است.');
      this.version(mapping.version, p.mappingVersion);
      const attrs = v.attributes(mapping.attributes),
        mappingRows = JSON.parse(String(attrs.rows)) as {
          accountId: string;
          targetCode: string;
        }[],
        map = new Map(mappingRows.map((r) => [r.accountId, r.targetCode]));
      const periodId = v.uuid(p.periodId)!,
        period = await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId },
        });
      if (!period) v.rule('دوره معتبر لازم است.');
      const journals = await tx.accountingJournal.findMany({
        where: { bookId, periodId, status: 'POSTED' },
        include: journalInclude,
        orderBy: { id: 'asc' },
        take: 501,
      });
      if (!journals.length || journals.length > 500)
        v.rule('بین ۱ و ۵۰۰ سند قطعی لازم است؛ دوره را محدود کنید.');
      if (
        journals.some((j) =>
          j.lines.some((l) => !l.accountId || !map.has(l.accountId)),
        )
      )
        v.rule('نگاشت تمام حساب‌های اسناد قطعی لازم است.');
      const payload = {
        version: 1,
        bookId,
        branchId: book.branchId,
        periodId,
        baseCurrency: book.baseCurrency,
        mapping: {
          id: mapping.id,
          version: mapping.version,
          effectiveFrom: attrs.effectiveFrom,
        },
        journals: journals.map((j) => ({
          id: j.id,
          number: j.number,
          date: j.documentDate,
          description: j.description,
          sourceKey: j.sourceKey,
          reversalOfId: j.reversalOfId,
          lines: j.lines.map((l) => ({
            accountCode: map.get(l.accountId!),
            detail4Id: l.detail4Id,
            detail5Id: l.detail5Id,
            detail6Id: l.detail6Id,
            debit: l.debit.toString(),
            credit: l.credit.toString(),
            currency: l.currency,
            foreignAmount: l.foreignAmount?.toString() ?? null,
            fxSnapshotId: l.fxSnapshotId,
            rate: l.rate?.toString() ?? null,
          })),
        })),
      };
      const payloadJson = JSON.stringify(payload);
      if (payloadJson.length > 1000000)
        v.rule('حجم بسته بیش از یک مگابایت است.');
      const checksum = createHash('sha256').update(payloadJson).digest('hex'),
        existing = await tx.accountingConfiguration.findFirst({
          where: {
            bookId,
            kind: 'posting-batches',
            attributes: { path: ['checksum'], equals: checksum },
          },
        });
      if (existing) return existing;
      return tx.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'posting-batches',
          code: randomUUID(),
          title: `بسته دوره ${period.startDate}`,
          attributes: {
            checksum,
            payloadJson,
            state: 'VALIDATED',
            mappingId,
            mappingVersion: String(mapping.version),
            periodId,
          },
          active: true,
        },
      });
    }
    if (action === 'export-batch') {
      const id = v.uuid(p.id)!,
        batch = await tx.accountingConfiguration.findFirst({
          where: { id, bookId, kind: 'posting-batches' },
        });
      if (!batch) throw new NotFoundException();
      this.version(batch.version, expected);
      const attrs = batch.attributes as Record<string, string>,
        payloadJson = String(attrs.payloadJson),
        checksum = createHash('sha256').update(payloadJson).digest('hex');
      if (checksum !== attrs.checksum)
        v.rule('یکپارچگی بسته انتقال تأیید نشد.');
      await tx.accountingConfiguration.update({
        where: { id },
        data: {
          attributes: { ...attrs, state: 'EXPORTED' },
          version: { increment: 1 },
        },
      });
      return {
        filename: `accounting-${batch.code}.json`,
        content: JSON.stringify(
          { checksum, payload: JSON.parse(payloadJson) },
          null,
          2,
        ),
      };
    }
    if (action === 'number-journal-preview')
      return numberJournalPreview(tx, bookId, p);
    if (action === 'number-drafts') {
      const periodId = v.uuid(p.periodId)!;
      if (
        !(await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId, status: 'OPEN' },
        }))
      )
        v.rule('شماره‌گذاری فقط در دوره باز مجاز است.');
      const start = Number(p.startingNumber);
      if (!Number.isSafeInteger(start) || start < 1 || start > 2000000000)
        v.invalid('شماره شروع معتبر نیست.');
      const journals = await tx.accountingJournal.findMany({
        where: {
          bookId,
          periodId,
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
        },
        orderBy: [{ documentDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: 501,
      });
      if (journals.length > 500) v.rule('در هر اجرا حداکثر ۵۰۰ سند مجاز است.');
      journals.sort(compareDocumentOrder);
      const ids = journals.map((j) => j.id);
      if (
        await tx.accountingJournal.count({
          where: {
            bookId,
            id: { notIn: ids },
            number: { gte: start, lt: start + journals.length },
          },
        })
      )
        v.rule('شماره‌های انتخاب‌شده قبلاً استفاده شده‌اند.');
      await tx.accountingJournal.updateMany({
        where: { id: { in: ids } },
        data: { number: null },
      });
      for (const [i, j] of journals.entries())
        await tx.accountingJournal.update({
          where: { id: j.id },
          data: { number: start + i, version: { increment: 1 } },
        });
      await tx.accountingBook.update({
        where: { id: bookId },
        data: {
          nextNumber: Math.max(book.nextNumber, start + journals.length),
        },
      });
      return {
        rows: journals.map((j, i) => ({
          id: j.id,
          oldNumber: j.number,
          newNumber: start + i,
        })),
      };
    }
    if (action === 'allocation-preview' || action === 'allocation-run') {
      const templateId = v.uuid(p.templateId)!,
        template = await tx.accountingConfiguration.findFirst({
          where: {
            id: templateId,
            bookId,
            kind: 'allocation-templates',
            active: true,
          },
        });
      if (!template) v.rule('الگوی تخصیص معتبر نیست.');
      this.version(template.version, p.templateVersion);
      const attrs = v.attributes(template.attributes),
        sourceAccountId = v.uuid(attrs.sourceAccountId)!,
        targets = allocationTargets(attrs.targets);
      const amount = v.decimal(p.amount)!;
      if (amount === '0') v.rule('مبلغ مثبت لازم است.');
      if (
        DecimalValue.parse(amount)
          .round(book.baseCurrency === 'IRR' ? 0 : 2, 'HALF_EVEN')
          .compare(DecimalValue.parse(amount)) !== 0
      )
        v.rule('مبلغ تخصیص با دقت ارز پایه سازگار نیست.');
      const targetRows = allocateAmount(
        amount,
        targets,
        book.baseCurrency,
      ).filter((r) => r.amount !== '0');
      const lines = [
        { accountId: sourceAccountId, debit: '0', credit: amount },
        ...targetRows.map((r) => ({
          accountId: r.accountId,
          debit: r.amount,
          credit: '0',
        })),
      ];
      if (action === 'allocation-preview')
        return { templateId, templateVersion: template.version, lines };
      const basis = v.text(p.basisReference, 100, true),
        sourceKey = `ALLOC:${templateId}:${template.version}:${basis}`;
      const existing = await tx.accountingJournal.findUnique({
        where: { bookId_sourceKey: { bookId, sourceKey } },
        include: journalInclude,
      });
      if (existing) return existing;
      const result = (await this.execute(
        tx,
        book,
        'journal-save',
        {
          periodId: p.periodId,
          typeId: p.typeId,
          documentDate: p.documentDate,
          description: template.title,
          lines,
        },
        undefined,
        actor,
        true,
        stateEvents,
      )) as { id: string };
      return tx.accountingJournal.update({
        where: { id: result.id },
        data: {
          sourceKey,
          attributes: {
            templateId,
            templateVersion: String(template.version),
            basisReference: basis,
          },
        },
        include: journalInclude,
      });
    }
    if (action === 'financial-rule-disable') {
      const rule = await tx.accountingConfiguration.findFirst({
        where: { id: v.uuid(p.id)!, bookId, kind: FINANCIAL_RULE_KIND },
      });
      if (!rule) throw new NotFoundException();
      this.version(rule.version, expected);
      return tx.accountingConfiguration.update({
        where: { id: rule.id },
        data: { active: false, version: { increment: 1 } },
      });
    }
    if (
      action === 'financial-rule-save' ||
      action === 'financial-event-journal'
    ) {
      const eventId = v.uuid(p.eventId)!;
      await tx.$queryRaw`SELECT id FROM finance_accounting_events WHERE id=${eventId}::uuid FOR UPDATE`;
      const event = await tx.financeAccountingEvent.findFirst({
        where: { id: eventId, branchId: book.branchId },
      });
      if (!event) v.rule('رویداد مالی در این شعبه پیدا نشد.');
      await validateSalesContractAccountingSource(tx, event);
      if (isReceiptAllocation(event.kind)) {
        if (action === 'financial-rule-save')
          v.rule('حساب تخصیص از سند دریافت اصلی حمل می‌شود و قاعده جدا ندارد.');
        return this.receiptAllocationJournal(
          tx,
          book,
          event,
          p,
          expected,
          actor,
          stateEvents,
        );
      }

      let mapping = p;
      if (p.ruleId) {
        const rule = await tx.accountingConfiguration.findFirst({
          where: {
            id: v.uuid(p.ruleId)!,
            bookId,
            kind: FINANCIAL_RULE_KIND,
            active: true,
          },
        });
        if (!rule || !ruleMatches(rule.attributes, event))
          v.rule('قاعده فعال و منطبق با رویداد پیدا نشد.');
        mapping = v.attributes(rule.attributes);
      }
      const rates =
        event.currency === book.baseCurrency
          ? []
          : await tx.accountingFxSnapshot.findMany({
              where: {
                bookId,
                ...(p.fxSnapshotId ? { id: v.uuid(p.fxSnapshotId)! } : {}),
                currency: event.currency,
                status: 'APPROVED',
                validFrom: { lte: event.occurredAt },
                validTo: { gte: event.occurredAt },
              },
            });
      if (event.currency !== book.baseCurrency && rates.length !== 1)
        v.rule(
          'برای زمان رویداد ارزی باید دقیقاً یک نرخ مستقل مصوب وجود داشته باشد.',
        );
      const fx = rates[0];
      const lines = financialEventLines(
        event,
        mapping,
        fx
          ? { id: fx.id, rate: fx.rate, baseCurrency: book.baseCurrency }
          : undefined,
      );
      await validateSalesContractAccounts(
        tx,
        event,
        bookId,
        lines[0]!.accountId,
        lines[1]!.accountId,
      );
      if (lines[0]!.accountId === lines[1]!.accountId)
        v.rule('حساب بدهکار و بستانکار باید متفاوت باشند.');
      if (action === 'financial-rule-save') {
        this.require(actor, 'finance.journal.create');
        const typeId = v.uuid(p.typeId)!;
        if (
          !(await tx.accountingConfiguration.findFirst({
            where: { id: typeId, bookId, kind: 'voucher-types', active: true },
          }))
        )
          v.rule('نوع سند فعال انتخاب کنید.');
        for (const line of lines) {
          const account = await tx.accountingAccount.findFirst({
            where: {
              id: line.accountId,
              bookId,
              active: true,
              level: 'SUBSIDIARY',
            },
          });
          if (!account) v.rule('حساب معین فعال همین دفتر انتخاب کنید.');
          const attrs = v.attributes(account.attributes);
          if (event.currency !== book.baseCurrency && !attrs.multiCurrency)
            v.rule('برای رویداد ارزی حساب با ویژگی ارزی انتخاب کنید.');
          for (const level of [4, 5, 6] as const) {
            const id = line[`detail${level}Id`];
            if (attrs[`detail${level}Required`] && !id)
              v.rule('تفصیلی الزامی قاعده باید انتخاب شود.');
            if (id) await validateSetupDetail(tx, bookId, account, id, level);
          }
        }
        // Rules are versioned records; replacing a match retires the old version.
        const old = await tx.accountingConfiguration.findMany({
          where: { bookId, kind: FINANCIAL_RULE_KIND, active: true },
        });
        for (const rule of old) {
          const a = v.attributes(rule.attributes);
          if (
            a.kind === event.kind &&
            a.currency === event.currency &&
            a.partyId === (event.partyId ?? '') &&
            a.settlementAccountId === (event.settlementAccountId ?? '')
          )
            await tx.accountingConfiguration.update({
              where: { id: rule.id },
              data: { active: false, version: { increment: 1 } },
            });
        }
        const attributes: Record<string, string> = {
          kind: event.kind,
          currency: event.currency,
          partyId: event.partyId ?? '',
          settlementAccountId: event.settlementAccountId ?? '',
          typeId,
          creatorId: actor.userId,
          effectiveFrom: new Date().toISOString(),
        };
        for (const side of ['debit', 'credit'])
          for (const field of [
            'AccountId',
            'Detail4Id',
            'Detail5Id',
            'Detail6Id',
          ])
            attributes[side + field] = String(mapping[side + field] ?? '');
        return tx.accountingConfiguration.create({
          data: {
            bookId,
            kind: FINANCIAL_RULE_KIND,
            code: randomUUID(),
            title: v.text(p.title, 160) || 'قاعده ثبت رویداد مالی',
            attributes,
          },
        });
      }
      if (event.journalId) {
        const linked = await tx.accountingJournal.findUniqueOrThrow({
          where: { id: event.journalId },
          include: journalInclude,
        });
        if (linked.bookId !== bookId)
          v.rule('رویداد قبلاً در دفتر دیگری سند دارد.');
        if (p.rebuild !== true) return linked;
        this.version(linked.version, expected);
        if (linked.status !== 'DRAFT')
          v.rule('فقط پیش‌نویس نهایی‌نشده از مبدأ بازسازی می‌شود.');
      }
      const previous = await tx.accountingJournal.findMany({
        where: {
          sourceKey: event.sourceKey,
          book: { branchId: book.branchId },
        },
        include: journalInclude,
      });
      if (previous.length > 1 || (previous[0] && previous[0].bookId !== bookId))
        v.rule(
          'برای این رویداد سند قبلی در دفتر دیگری وجود دارد؛ تطبیق لازم است.',
        );
      let journal = previous[0];
      if (!journal || p.rebuild === true) {
        if (journal && journal.status !== 'DRAFT')
          v.rule('سند تأییدشده یا نهایی از مبدأ بازنویسی نمی‌شود.');
        if (journal) this.version(journal.version, expected);
        const sourceDate = financialDate(event.occurredAt);
        const documentDate =
          v.date(p.documentDate, true) ?? journal?.documentDate ?? sourceDate;
        const oldReason =
          journal?.documentDate === documentDate
            ? String(v.attributes(journal.attributes).latePostingReason ?? '')
            : '';
        const latePostingReason =
          documentDate === sourceDate
            ? ''
            : v.text(p.latePostingReason, 500) || oldReason;
        if (
          (event.kind === 'CUSTOMER_RECEIPT' ||
            event.kind.endsWith('_PAYMENT')) &&
          documentDate < sourceDate
        )
          v.rule('ثبت دریافت و پرداخت پیش از تاریخ واقعی وجه مجاز نیست.');
        if (documentDate !== sourceDate && latePostingReason.length < 10)
          v.rule(
            'برای ثبت در تاریخی متفاوت از عملیات، علت حداقل ده‌حرفی ثبت کنید؛ تأیید مستقل سند لازم است.',
          );
        const periods = await tx.accountingPeriod.findMany({
          where: {
            bookId,
            status: 'OPEN',
            startDate: { lte: documentDate },
            endDate: { gte: documentDate },
            ...(p.periodId ? { id: v.uuid(p.periodId)! } : {}),
          },
        });
        if (periods.length !== 1)
          v.rule('برای تاریخ ثبت حسابداری باید دقیقاً یک دوره باز انتخاب شود.');
        const created = (await this.execute(
          tx,
          book,
          'journal-save',
          {
            ...(journal ? { id: journal.id } : {}),
            periodId: periods[0]!.id,
            typeId: mapping.typeId,
            documentDate,
            description:
              journal?.description ??
              accountingFinancialEventLabels[event.kind] ??
              'عملیات مالی',
            reference:
              journal?.reference ??
              (event.kind === SALES_CONTRACT_EVENT
                ? event.trackingNumber
                : event.reference),
            sourceKey: event.sourceKey,
            attributes: {
              ...resetApprovalAttributes(journal?.attributes ?? {}),
              financialEventId: event.id,
              sourceOccurredAt: event.occurredAt.toISOString(),
              latePostingReason,
              source: event.source,
              recordId: event.recordId,
              sourceRequestId: event.requestId,
              sourceAmount: event.amount.toString(),
              sourceCurrency: event.currency,
              ruleId: String(p.ruleId ?? ''),
            },
            lines,
          },
          journal?.version,
          actor,
          true,
          stateEvents,
          Boolean(journal && p.rebuild === true),
        )) as { id: string };
        journal = await tx.accountingJournal.findUniqueOrThrow({
          where: { id: created.id },
          include: journalInclude,
        });
        await this.validatePosting(tx, book, journal);
      }
      await tx.financeAccountingEvent.update({
        where: { id: event.id },
        data: {
          journalId: journal.id,
          lastError: null,
          attemptedAt: new Date(),
        },
      });
      return journal;
    }
    if (action === 'source-journal') {
      if (!this.finance) v.rule('منبع عمومی مالی در دسترس نیست.');
      const source = v.text(p.source, 20, true),
        recordId = v.uuid(p.recordId)!;
      if (
        !['SALES', 'TICKET', 'RESERVATIONS', 'INVOICE', 'OPERATIONAL'].includes(
          source,
        )
      )
        v.invalid('منبع مالی معتبر نیست.');
      const captured = await tx.financeAccountingEvent.findFirst({
        where: { sourceKey: `${source}:${recordId}`, branchId: book.branchId },
      });
      if (captured)
        return this.execute(
          tx,
          book,
          'financial-event-journal',
          { ...p, eventId: captured.id },
          undefined,
          actor,
          true,
          stateEvents,
        );
      const history = await this.finance.history(
        { source: source as 'SALES', recordId },
        { ...actor, branchIds: [book.branchId] },
      );
      const item = history.items.find(
        (i) => i.id === recordId && i.source === source,
      );
      if (!item) v.rule('عملیات قطعی مالی در این شعبه پیدا نشد.');
      const sourceKey = `${source}:${recordId}`;
      const existing = await tx.accountingJournal.findUnique({
        where: { bookId_sourceKey: { bookId, sourceKey } },
        include: journalInclude,
      });
      if (existing) return existing;
      if (item.currencyCode !== book.baseCurrency)
        v.rule('منبع ارزی به نگاشت نرخ مصوب نیاز دارد.');
      const amount = item.amount;
      const result = (await this.execute(
        tx,
        book,
        'journal-save',
        {
          periodId: p.periodId,
          typeId: p.typeId,
          documentDate: p.documentDate,
          description: `${item.title} · ${item.reference ?? ''}`,
          reference: item.reference,
          lines: [
            { accountId: p.debitAccountId, debit: amount, credit: '0' },
            { accountId: p.creditAccountId, debit: '0', credit: amount },
          ],
        },
        undefined,
        actor,
        true,
        stateEvents,
      )) as { id: string };
      return tx.accountingJournal.update({
        where: { id: result.id },
        data: {
          sourceKey,
          attributes: {
            source,
            recordId,
            sourceRequestId: item.requestId,
            sourceAmount: item.amount,
            sourceCurrency: item.currencyCode,
          },
        },
        include: journalInclude,
      });
    }
    if (action === 'save-fx') {
      const currency = v.text(p.currency, 3, true),
        rate = v.decimal(p.rate)!;
      if (
        !/^[A-Z]{3}$/.test(currency) ||
        currency === book.baseCurrency ||
        rate === '0'
      )
        v.invalid('ارز و نرخ مثبت معتبر انتخاب کنید.');
      const validFrom = v.text(p.validFrom, 30, true),
        validTo = v.text(p.validTo, 30, true);
      if (
        !/^\d{4}-\d{2}-\d{2}T/.test(validFrom) ||
        !validFrom.endsWith('Z') ||
        !validTo.endsWith('Z') ||
        !Number.isFinite(Date.parse(validFrom)) ||
        !Number.isFinite(Date.parse(validTo)) ||
        validFrom >= validTo
      )
        v.invalid('بازه اعتبار نرخ باید زمان UTC معتبر باشد.');
      return tx.accountingFxSnapshot.create({
        data: {
          bookId,
          currency,
          rate,
          source: v.text(p.source, 160, true),
          validFrom: new Date(validFrom),
          validTo: new Date(validTo),
          makerId: actor.userId,
        },
      });
    }
    if (action === 'approve-fx') {
      const id = v.uuid(p.id)!;
      const rate = await tx.accountingFxSnapshot.findFirst({
        where: { id, bookId },
      });
      if (!rate) throw new NotFoundException();
      this.version(rate.version, expected);
      if (rate.status !== 'DRAFT' || rate.makerId === actor.userId)
        v.rule('نرخ باید با تأیید مستقل قطعی شود.');
      return tx.accountingFxSnapshot.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approverId: actor.userId,
          version: { increment: 1 },
        },
      });
    }
    if (action === 'save-book') {
      this.version(book.version, expected);
      return tx.accountingBook.update({
        where: { id: bookId },
        data: {
          title: v.text(p.title, 160, true),
          ...(p.code !== undefined ? { code: v.text(p.code, 20, true) } : {}),
          ...(p.titleEn !== undefined
            ? { titleEn: v.text(p.titleEn, 160) || null }
            : {}),
          ...(p.description !== undefined
            ? { description: v.text(p.description, 2000) || null }
            : {}),
          ...(p.notes !== undefined
            ? { notes: v.text(p.notes, 2000) || null }
            : {}),
          active: p.active === true,
          allowsPosting: p.allowsPosting === true,
          isMain: p.isMain === true,
          version: { increment: 1 },
        },
      });
    }
    if (action === 'save-configuration') {
      const kind = v.text(p.kind, 40, true);
      if (!kinds.includes(kind)) v.invalid('نوع اطلاعات پایه معتبر نیست.');
      const id = v.uuid(p.id, true) ?? randomUUID(),
        existing = await tx.accountingConfiguration.findFirst({
          where: { id, bookId },
        });
      if (existing) {
        this.version(existing.version, expected);
        if (existing.kind !== kind) v.invalid('نوع رکورد قابل تغییر نیست.');
      }
      const attributes = v.attributes(p.attributes);
      if (kind === 'detail-types' && attributes.notes !== undefined)
        attributes.notes = JSON.stringify(
          setupNotes(
            attributes.notes,
            existing ? v.attributes(existing.attributes).notes : undefined,
            actorName,
          ),
        );
      if (kind === 'approval-policies') {
        if (
          attributes.currency !== book.baseCurrency ||
          attributes.permission !== 'finance.journal.approve'
        )
          v.rule('ارز و مجوز قاعده تأیید معتبر نیست.');
        const min = v.decimal(attributes.minAmount)!;
        const max = v.decimal(attributes.maxAmount, true);
        if (max && DecimalValue.parse(max).compare(DecimalValue.parse(min)) < 0)
          v.rule('حد بالای تأیید باید بزرگ‌تر از حد پایین باشد.');
      }

      if (kind === 'fiscal-years' && Object.keys(attributes).length)
        v.invalid('بازه سال مالی فقط در تخصیص سال به دفتر ثبت می‌شود.');
      if (kind === 'detail-types') {
        if (
          existing &&
          v.attributes(existing.attributes).isSystem === true &&
          (p.title !== existing.title ||
            (v.text(p.titleEn, 160) || null) !== existing.titleEn ||
            (v.text(p.description, 2000) || null) !== existing.description ||
            attributes.isSystem !== true)
        )
          v.rule('عنوان و مشخصات پایه نوع تفصیلی سیستم قابل تغییر نیست.');
        const length = Number(attributes.classificationNumberLength);
        if (!Number.isInteger(length) || length < 0 || length > 20)
          v.invalid('طول شماره طبقه‌بندی باید بین صفر و ۲۰ باشد.');
        const parentTypeId = v.uuid(attributes.parentTypeId, true);
        if (attributes.enforceParent === true && !parentTypeId)
          v.rule('نوع تفصیلی پدر لازم است.');
        let cursor = parentTypeId;
        const seen = new Set([id]);
        while (cursor) {
          if (seen.has(cursor) || seen.size > 20)
            v.rule('رابطه نوع تفصیلی چرخه یا عمق بیش از حد دارد.');
          seen.add(cursor);
          const parent = await tx.accountingConfiguration.findFirst({
            where: { id: cursor, bookId, kind: 'detail-types', active: true },
          });
          if (!parent) v.rule('نوع تفصیلی پدر معتبر نیست.');
          cursor = v.uuid(v.attributes(parent.attributes).parentTypeId, true);
        }
        if (
          existing &&
          (await tx.accountingDetail.count({ where: { typeId: id } })) &&
          JSON.stringify(canonical(without(attributes, ['notes']))) !==
            JSON.stringify(
              canonical(without(v.attributes(existing.attributes), ['notes'])),
            )
        )
          v.rule('قواعد نوع تفصیلی استفاده‌شده قابل تغییر نیست.');
      }
      if (kind === 'tax-settings') {
        v.text(attributes.sellerProfileRef, 160, true);
        v.text(attributes.connectorRef, 160, true);
        v.text(attributes.schemaVersion, 80, true);
        if (
          !['SANDBOX', 'PRODUCTION'].includes(String(attributes.environment)) ||
          p.active !== false
        )
          v.rule('درخواست اتصال مالیاتی تا اعتبارسنجی غیرفعال می‌ماند.');
      }
      if (kind === 'tax-invoices' || kind === 'tax-returns')
        v.rule(
          'قرارداد معتبر مقصد برای تولید صورتحساب یا گزارش مالیاتی لازم است.',
        );
      if (kind === 'account-mappings') {
        v.date(attributes.effectiveFrom);
        v.text(attributes.reason, 2000);
        let raw: unknown;
        try {
          raw = JSON.parse(String(attributes.rows));
        } catch {
          v.invalid('ردیف‌های نگاشت معتبر نیست.');
        }
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500)
          v.invalid('ردیف‌های نگاشت لازم‌اند.');
        const ids = raw.map((row) => {
          const r = v.object(row);
          v.text(r.targetCode, 40, true);
          return v.uuid(r.accountId)!;
        });
        if (
          new Set(ids).size !== ids.length ||
          (await tx.accountingAccount.count({
            where: { id: { in: ids }, bookId, level: 'SUBSIDIARY' },
          })) !== ids.length
        )
          v.rule('حساب‌های نگاشت معتبر و غیرتکراری انتخاب کنید.');
        if (existing)
          v.rule('نگاشت منتشرشده با نسخه جدید و کد جدید ثبت می‌شود.');
      }
      if (kind === 'allocation-templates') {
        const sourceAccountId = v.uuid(attributes.sourceAccountId)!,
          targets = allocationTargets(attributes.targets);
        const ids = [sourceAccountId, ...targets.map((t) => t.accountId)];
        if (
          new Set(ids).size !== ids.length ||
          (await tx.accountingAccount.count({
            where: {
              id: { in: ids },
              bookId,
              active: true,
              level: 'SUBSIDIARY',
            },
          })) !== ids.length
        )
          v.rule('حساب‌های مبدأ و مقصد فعال، معین و متفاوت لازم‌اند.');
      }

      // Tax credentials/acknowledgements are never persisted through a generic form.
      if (
        kind.startsWith('tax-') &&
        Object.keys(attributes).some((k) =>
          /secret|password|token|key|ack|status/i.test(k),
        )
      )
        v.invalid('اطلاعات محرمانه و پاسخ سامانه در این فرم ثبت نمی‌شود.');
      const data = {
        bookId,
        kind,
        code:
          v.text(p.code, 40) ||
          existing?.code ||
          `${kind === 'fiscal-years' ? 'FY' : kind === 'voucher-types' ? 'VT' : kind === 'detail-types' ? 'DT' : 'CFG'}-${id.slice(0, 8).toUpperCase()}`,
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
        description: v.text(p.description, 2000) || null,
        attributes: json(attributes),
        active: p.active !== false,
      };
      return existing
        ? tx.accountingConfiguration.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.accountingConfiguration.create({ data: { id, ...data } });
    }
    if (action === 'save-period') {
      const id = v.uuid(p.id, true) ?? randomUUID(),
        fiscalYearId = v.uuid(p.fiscalYearId)!;
      const year = await tx.accountingConfiguration.findFirst({
        where: { id: fiscalYearId, bookId, kind: 'fiscal-years', active: true },
      });
      if (!year) v.rule('دوره مالی معتبر انتخاب کنید.');
      const startDate = v.date(p.startDate)!,
        endDate = v.date(p.endDate)!;
      if (startDate > endDate) v.rule('تاریخ پایان باید بعد از شروع باشد.');
      const existing = await tx.accountingPeriod.findFirst({
        where: { id, bookId },
      });
      if (existing) {
        this.version(existing.version, expected);
        if (
          existing.status !== 'OPEN' ||
          (await tx.accountingJournal.count({ where: { periodId: id } }))
        )
          v.rule('دوره استفاده‌شده قابل تغییر نیست.');
      }
      if (
        await tx.accountingPeriod.count({
          where: { bookId, fiscalYearId, id: { not: id } },
        })
      )
        v.rule('این سال مالی قبلاً به دفتر تخصیص یافته است.');
      if (
        await tx.accountingPeriod.count({
          where: {
            bookId,
            id: { not: id },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        })
      )
        v.rule('بازه دوره با دوره دیگری هم‌پوشانی دارد.');
      const data = { bookId, fiscalYearId, startDate, endDate };
      return existing
        ? tx.accountingPeriod.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.accountingPeriod.create({ data: { id, ...data } });
    }
    if (action === 'save-account') {
      const id = v.uuid(p.id, true) ?? randomUUID(),
        parentId = v.uuid(p.parentId, true),
        code = v.text(p.code, 20, true),
        level = v.text(p.level, 16, true),
        nature = v.text(p.nature, 8, true);
      if (
        !/^\d{1,20}$/.test(code) ||
        !['GROUP', 'GENERAL', 'SUBSIDIARY'].includes(level) ||
        !['DEBIT', 'CREDIT', 'ANY'].includes(nature)
      )
        v.invalid('کد، سطح یا ماهیت حساب معتبر نیست.');
      const parent = parentId
        ? await tx.accountingAccount.findFirst({
            where: { id: parentId, bookId, active: true },
          })
        : null;
      if (
        level === 'GROUP'
          ? parentId !== null
          : !parent ||
            parent.level !== (level === 'GENERAL' ? 'GROUP' : 'GENERAL') ||
            !code.startsWith(parent.code)
      )
        v.rule('والد و پیشوند کد با سطح حساب سازگار نیست.');
      const existing = await tx.accountingAccount.findFirst({
        where: { id, bookId },
      });
      if (existing) {
        this.version(existing.version, expected);
        if (
          (await tx.accountingJournalLine.count({
            where: { accountId: id },
          })) &&
          (code !== existing.code ||
            level !== existing.level ||
            parentId !== existing.parentId ||
            nature !== existing.nature ||
            (p.permanent !== false) !== existing.permanent ||
            JSON.stringify(
              canonical(accountRules(p.attributes, p.permanent !== false)),
            ) !==
              JSON.stringify(
                canonical(
                  accountRules(existing.attributes, existing.permanent),
                ),
              ))
        )
          v.rule('حساب استفاده‌شده قابل تغییر نیست.');
        if (
          (await tx.accountingAccount.count({ where: { parentId: id } })) &&
          (code !== existing.code ||
            level !== existing.level ||
            parentId !== existing.parentId)
        )
          v.rule('ساختار حساب دارای فرزند قابل تغییر نیست.');
      }
      const accountAttrs = v.attributes(p.attributes);
      validateAccountForm(accountAttrs, p.permanent !== false);
      if (
        accountAttrs.counterpartId &&
        !(await tx.accountingAccount.findFirst({
          where: {
            id: v.uuid(accountAttrs.counterpartId)!,
            bookId,
            active: true,
            level: 'SUBSIDIARY',
          },
        }))
      )
        v.rule('حساب طرف مقابل معتبر نیست.');
      for (const n of [4, 5, 6]) {
        const ids = accountAttrs[`detail${n}TypeIds`];
        if (
          Array.isArray(ids) &&
          ids.length &&
          (await tx.accountingConfiguration.count({
            where: {
              id: { in: [...new Set(ids)] },
              bookId,
              kind: 'detail-types',
              active: true,
            },
          })) !== new Set(ids).size
        )
          v.rule('نوع تفصیلی مجاز حساب معتبر نیست.');
      }
      if (
        accountAttrs.revaluable === true &&
        accountAttrs.multiCurrency !== true
      )
        v.rule('تسعیرپذیری فقط برای حساب ارزی مجاز است.');
      if (
        accountAttrs.natureControl &&
        !['NONE', 'WARN', 'BLOCK'].includes(String(accountAttrs.natureControl))
      )
        v.invalid('کنترل ماهیت معتبر نیست.');
      for (const n of [4, 5, 6])
        if (
          accountAttrs[`detail${n}TypeId`] &&
          !(await tx.accountingConfiguration.findFirst({
            where: {
              id: v.uuid(accountAttrs[`detail${n}TypeId`])!,
              bookId,
              kind: 'detail-types',
              active: true,
            },
          }))
        )
          v.rule('نوع تفصیلی مجاز حساب معتبر نیست.');
      const data = {
        bookId,
        parentId,
        code,
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
        level,
        nature,
        permanent: p.permanent !== false,
        active: p.active !== false,
        attributes: json({
          ...v.attributes(p.attributes),
          description: v.text(p.description, 2000),
        }),
      };
      return existing
        ? tx.accountingAccount.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.accountingAccount.create({ data: { id, ...data } });
    }
    if (action === 'save-detail') {
      const id = v.uuid(p.id, true) ?? randomUUID(),
        typeId = v.uuid(p.typeId)!,
        parentId = v.uuid(p.parentId, true);
      const detailType = await tx.accountingConfiguration.findFirst({
        where: { id: typeId, bookId, kind: 'detail-types', active: true },
      });
      if (!detailType) v.rule('نوع تفصیلی معتبر انتخاب کنید.');
      const typeAttrs = v.attributes(detailType.attributes),
        detailAttrs = v.attributes(p.attributes);
      const classification = v.text(detailAttrs.classificationNumber, 20);
      if (
        classification &&
        (!/^\d+$/.test(classification) ||
          classification.length !==
            Number(typeAttrs.classificationNumberLength))
      )
        v.rule('شماره طبقه‌بندی با طول تعیین‌شده سازگار نیست.');
      if (typeAttrs.enforceParent === true && !parentId)
        v.rule('تفصیلی پدر لازم است.');
      if (
        parentId &&
        typeAttrs.parentTypeId &&
        !(await tx.accountingDetail.findFirst({
          where: {
            id: parentId,
            bookId,
            typeId: String(typeAttrs.parentTypeId),
            active: true,
          },
        }))
      )
        v.rule('نوع تفصیلی پدر سازگار نیست.');
      if (
        parentId &&
        (parentId === id ||
          !(await tx.accountingDetail.findFirst({
            where: { id: parentId, bookId, active: true },
          })))
      )
        v.rule('والد تفصیلی معتبر نیست.');
      let cursor = parentId;
      const seen = new Set([id]);
      while (cursor) {
        if (seen.has(cursor) || seen.size > 20)
          v.rule('رابطه تفصیلی چرخه یا عمق بیش از حد دارد.');
        seen.add(cursor);
        cursor =
          (
            await tx.accountingDetail.findFirst({
              where: { id: cursor, bookId },
            })
          )?.parentId ?? null;
      }
      const existing = await tx.accountingDetail.findFirst({
        where: { id, bookId },
      });
      if (existing) {
        this.version(existing.version, expected);
        if (
          (await tx.accountingJournalLine.count({
            where: {
              OR: [{ detail4Id: id }, { detail5Id: id }, { detail6Id: id }],
            },
          })) &&
          (typeId !== existing.typeId ||
            parentId !== existing.parentId ||
            v.text(p.code, 20) !== existing.code ||
            v.text(p.currency, 3) !== (existing.currency ?? '') ||
            String(detailAttrs.classificationNumber ?? '') !==
              String(
                v.attributes(existing.attributes).classificationNumber ?? '',
              ))
        )
          v.rule('تفصیلی استفاده‌شده قابل تغییر نیست.');
      }
      if (detailAttrs.notes !== undefined)
        detailAttrs.notes = JSON.stringify(
          setupNotes(
            detailAttrs.notes,
            existing ? v.attributes(existing.attributes).notes : undefined,
            actorName,
          ),
        );
      let detailCode = v.text(p.code, 20);
      if (!detailCode) {
        const first = v.text(typeAttrs.defaultFirstCode, 20, true);
        if (!/^\d+$/.test(first)) v.rule('اولین کد پیش‌فرض عددی لازم است.');
        let candidate = BigInt(first);
        let attempts = 0;
        do {
          detailCode = candidate.toString().padStart(first.length, '0');
          candidate++;
          attempts++;
          if (detailCode.length > 20 || attempts > 10000)
            v.rule('بازه کد پیش‌فرض تکمیل شده است.');
        } while (
          await tx.accountingDetail.findUnique({
            where: { bookId_code: { bookId, code: detailCode } },
          })
        );
      }
      if (!/^\d{1,20}$/.test(detailCode))
        v.invalid('کد تفصیلی باید عددی باشد.');
      const currency = v.text(p.currency, 3) || null;
      if (currency && !/^[A-Z]{3}$/.test(currency))
        v.invalid('کد ارز معتبر نیست.');
      const data = {
        bookId,
        typeId,
        parentId,
        code: detailCode,
        title: v.text(p.title, 160, true),
        currency,
        attributes: json({
          ...detailAttrs,
          titleEn: v.text(p.titleEn, 160),
          description: v.text(p.description, 2000),
        }),
        active: p.active !== false,
      };
      return existing
        ? tx.accountingDetail.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.accountingDetail.create({ data: { id, ...data } });
    }
    if (action === 'save-account-group' || action === 'save-detail-group') {
      const accountGroup = action === 'save-account-group';
      const id = v.uuid(p.id, true) ?? randomUUID();
      const rawMembers = p.memberIds;
      if (!Array.isArray(rawMembers) || rawMembers.length > 500)
        v.invalid('فهرست اعضای گروه معتبر نیست.');
      const memberIds = rawMembers.map((member) =>
        v.uuid(member)!.toLowerCase(),
      );
      if (new Set(memberIds).size !== memberIds.length)
        v.invalid('عضو تکراری در گروه مجاز نیست.');
      const existing = accountGroup
        ? await tx.accountingAccountGroup.findFirst({ where: { id, bookId } })
        : await tx.accountingDetailGroup.findFirst({ where: { id, bookId } });
      if (existing) this.version(existing.version, expected);
      const referenceCount = accountGroup
        ? await tx.accountingAccount.count({
            where: { bookId, id: { in: memberIds } },
          })
        : await tx.accountingDetail.count({
            where: { bookId, id: { in: memberIds } },
          });
      if (referenceCount !== memberIds.length)
        v.rule('همه اعضای گروه باید متعلق به همین دفتر باشند.');
      const common = {
        notes: json(
          p.notes === undefined
            ? (existing?.notes ?? [])
            : setupNotes(p.notes, existing?.notes, actorName),
        ),
        bookId,
        code: v.text(p.code, 40, true),
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
        description: v.text(p.description, 2000) || null,
        active: p.active !== false,
      };
      if (accountGroup) {
        const detailAllocations =
          p.detailAllocations === undefined
            ? (
                await tx.accountingAccountGroupDetail.findMany({
                  where: { groupId: id },
                })
              ).filter((row) => memberIds.includes(row.accountId))
            : await validateGroupDetailAllocations(
                tx,
                bookId,
                p.detailAllocations,
                memberIds,
              );
        const saveAllocations = async () => {
          await tx.accountingAccountGroupDetail.deleteMany({
            where: { groupId: id },
          });
          if (detailAllocations.length)
            await tx.accountingAccountGroupDetail.createMany({
              data: detailAllocations.map(
                ({ bookId, accountId, detailId }) => ({
                  bookId,
                  accountId,
                  detailId,
                  groupId: id,
                }),
              ),
            });
        };
        if (existing) {
          await tx.accountingAccountGroupMember.deleteMany({
            where: { groupId: id },
          });
          await tx.accountingAccountGroup.update({
            where: { id },
            data: {
              ...common,
              version: { increment: 1 },
            },
          });
          if (memberIds.length)
            await tx.accountingAccountGroupMember.createMany({
              data: memberIds.map((accountId) => ({
                bookId,
                groupId: id,
                accountId,
              })),
            });
          await saveAllocations();
          return tx.accountingAccountGroup.findUniqueOrThrow({
            where: { id },
            include: {
              members: { orderBy: { accountId: 'asc' } },
              detailAllocations: true,
            },
          });
        }
        await tx.accountingAccountGroup.create({ data: { id, ...common } });
        if (memberIds.length)
          await tx.accountingAccountGroupMember.createMany({
            data: memberIds.map((accountId) => ({
              bookId,
              groupId: id,
              accountId,
            })),
          });
        await saveAllocations();
        return tx.accountingAccountGroup.findUniqueOrThrow({
          where: { id },
          include: {
            members: { orderBy: { accountId: 'asc' } },
            detailAllocations: true,
          },
        });
      }
      if (existing) {
        await tx.accountingDetailGroupMember.deleteMany({
          where: { groupId: id },
        });
        await tx.accountingDetailGroup.update({
          where: { id },
          data: {
            ...common,
            version: { increment: 1 },
          },
        });
        if (memberIds.length)
          await tx.accountingDetailGroupMember.createMany({
            data: memberIds.map((detailId) => ({
              bookId,
              groupId: id,
              detailId,
            })),
          });
        return tx.accountingDetailGroup.findUniqueOrThrow({
          where: { id },
          include: { members: { orderBy: { detailId: 'asc' } } },
        });
      }
      await tx.accountingDetailGroup.create({ data: { id, ...common } });
      if (memberIds.length)
        await tx.accountingDetailGroupMember.createMany({
          data: memberIds.map((detailId) => ({
            bookId,
            groupId: id,
            detailId,
          })),
        });
      return tx.accountingDetailGroup.findUniqueOrThrow({
        where: { id },
        include: { members: { orderBy: { detailId: 'asc' } } },
      });
    }
    if (action === 'save-template') {
      const id = v.uuid(p.id, true) ?? randomUUID();
      const existing = await tx.accountingTemplate.findFirst({
        where: { id, bookId },
        include: { lines: true },
      });
      if (existing) this.version(existing.version, expected);
      const kind = v.text(p.kind, 16, true);
      const sourceForm = p.sourceForm === 'rahkaran-documents-v1';
      if (sourceForm && kind === 'CLOSING') v.invalid('فرم الگو معتبر نیست.');
      if (
        existing &&
        sourceForm !==
          (v.attributes(existing.attributes).sourceForm ===
            'rahkaran-documents-v1')
      )
        v.rule('فرم این الگو با قالب ذخیره‌شده یکسان نیست.');
      if (!['AUTOMATIC', 'REVALUATION', 'CLOSING'].includes(kind))
        v.invalid('نوع الگوی حسابداری معتبر نیست.');
      if (existing && existing.kind !== kind)
        v.rule('نوع الگوی ثبت‌شده قابل تغییر نیست.');
      const voucherTypeId = v.uuid(p.voucherTypeId, true);
      if (
        voucherTypeId &&
        !(await tx.accountingConfiguration.findFirst({
          where: {
            id: voucherTypeId,
            bookId,
            kind: 'voucher-types',
            active: true,
          },
        }))
      )
        v.rule('نوع سند فعال همین دفتر لازم است.');
      const gainAccountId = v.uuid(p.gainAccountId, true);
      const lossAccountId = v.uuid(p.lossAccountId, true);
      const retainedAccountId = v.uuid(p.retainedAccountId, true);
      if (
        sourceForm &&
        (voucherTypeId || gainAccountId || lossAccountId || retainedAccountId)
      )
        v.invalid('فرم مرجع این فیلدها را ندارد.');
      const accountIds = [
        gainAccountId,
        lossAccountId,
        retainedAccountId,
      ].filter((value): value is string => Boolean(value));
      if (
        accountIds.length &&
        (await tx.accountingAccount.count({
          where: { bookId, id: { in: accountIds }, active: true },
        })) !== new Set(accountIds).size
      )
        v.rule('حساب‌های الگو باید فعال و متعلق به همین دفتر باشند.');
      if (
        (kind === 'REVALUATION' &&
          !sourceForm &&
          (!voucherTypeId ||
            !gainAccountId ||
            !lossAccountId ||
            retainedAccountId)) ||
        (kind === 'CLOSING' &&
          (!voucherTypeId ||
            !retainedAccountId ||
            gainAccountId ||
            lossAccountId)) ||
        (kind === 'AUTOMATIC' &&
          (gainAccountId || lossAccountId || retainedAccountId))
      )
        v.rule('حساب‌ها و نوع سند با نوع الگو سازگار نیستند.');
      if (!Array.isArray(p.lines) || p.lines.length > 500)
        v.invalid('ردیف‌های الگو معتبر نیستند.');
      const lines = [] as {
        bookId: string;
        position: number;
        accountId: string;
        detail4Id: string | null;
        detail5Id: string | null;
        detail6Id: string | null;
        side: string;
        percentage: string;
        include: boolean;
        role: string | null;
      }[];
      const templateAccountAttributes = new Map<string, AccountingAttributes>();
      for (const [position, raw] of p.lines.entries()) {
        const line = v.object(raw),
          accountId = v.uuid(line.accountId)!,
          detail4Id = v.uuid(line.detail4Id, true),
          detail5Id = v.uuid(line.detail5Id, true),
          detail6Id = v.uuid(line.detail6Id, true),
          role = sourceForm ? v.text(line.role, 8, true) : null,
          side = sourceForm ? 'DEBIT' : v.text(line.side, 8, true),
          percentage =
            sourceForm && role !== 'TARGET'
              ? '100'
              : v.decimalAtScale(line.percentage, 8);
        if (!['DEBIT', 'CREDIT'].includes(side))
          v.invalid('ماهیت ردیف الگو معتبر نیست.');
        if (
          sourceForm &&
          !(
            kind === 'AUTOMATIC' ? ['SOURCE', 'TARGET'] : ['OFFSET', 'BASIS']
          ).includes(role!)
        )
          v.invalid('نقش ردیف الگو معتبر نیست.');
        if (
          DecimalValue.parse(percentage).isZero ||
          DecimalValue.parse(percentage).compare(DecimalValue.parse('100')) > 0
        )
          v.invalid('درصد ردیف الگو باید بیشتر از صفر و حداکثر صد باشد.');
        const templateAccount = await tx.accountingAccount.findFirst({
          where: {
            id: accountId,
            bookId,
            active: true,
            ...(sourceForm ? { level: 'SUBSIDIARY' } : {}),
          },
        });
        if (!templateAccount) v.rule('حساب ردیف الگو معتبر نیست.');
        templateAccountAttributes.set(
          accountId,
          v.attributes(templateAccount.attributes),
        );
        const detailIds = [detail4Id, detail5Id, detail6Id].filter(
          (value): value is string => Boolean(value),
        );
        if (
          detailIds.length &&
          (await tx.accountingDetail.count({
            where: { bookId, id: { in: detailIds }, active: true },
          })) !== new Set(detailIds).size
        )
          v.rule('تفصیلی ردیف الگو معتبر نیست.');
        if (sourceForm) {
          const attrs = v.attributes(templateAccount.attributes);
          for (const [level, detailId] of [
            [4, detail4Id],
            [5, detail5Id],
            [6, detail6Id],
          ] as const) {
            if (!detailId) continue;
            const allowed = Array.isArray(attrs[`detail${level}TypeIds`])
              ? (attrs[`detail${level}TypeIds`] as string[])
              : [String(attrs[`detail${level}TypeId`] ?? '')].filter(Boolean);
            if (
              !(await tx.accountingDetail.findFirst({
                where: {
                  id: detailId,
                  bookId,
                  active: true,
                  typeId: { in: allowed },
                },
              }))
            )
              v.rule('نوع تفصیلی با سطح حساب ردیف الگو سازگار نیست.');
          }
        }
        lines.push({
          bookId,
          position,
          accountId,
          detail4Id,
          detail5Id,
          detail6Id,
          side,
          percentage,
          include: line.include !== false,
          role,
        });
      }
      const sourceAssignments = sourceForm
        ? validateTemplateAssignments(p.lines, kind)
        : {};
      if (sourceForm) {
        for (const [childPosition, rootPosition] of Object.entries(
          sourceAssignments,
        )) {
          const child = lines[Number(childPosition)]!;
          const root = lines[rootPosition]!;
          const rootAttrs = templateAccountAttributes.get(root.accountId)!;
          const childAttrs = templateAccountAttributes.get(child.accountId)!;
          if (
            kind === 'AUTOMATIC' &&
            rootAttrs.multiCurrency === true &&
            childAttrs.multiCurrency !== true
          )
            v.rule('مبدا مقصد ارزی باید حساب معین ارزی باشد.');
          if (kind === 'REVALUATION') {
            const hasLevel = (attrs: AccountingAttributes, level: number) =>
              Boolean(attrs[`detail${level}TypeId`]) ||
              (Array.isArray(attrs[`detail${level}TypeIds`]) &&
                (attrs[`detail${level}TypeIds`] as string[]).length > 0);
            for (const level of [4, 5, 6] as const) {
              if (
                hasLevel(rootAttrs, level) &&
                !root[`detail${level}Id`] &&
                !hasLevel(childAttrs, level)
              )
                v.rule(
                  'سطح تفصیلی خالی حساب تسعیر باید در حساب تسعیرپذیر وجود داشته باشد.',
                );
            }
          }
        }
      }
      const data = {
        bookId,
        kind,
        code: v.text(p.code, 40, true),
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
        description: v.text(p.description, 2000) || null,
        descriptionEn: v.text(p.descriptionEn, 2000) || null,
        active: p.active !== false,
        voucherTypeId,
        gainAccountId,
        lossAccountId,
        retainedAccountId,
        ...(sourceForm
          ? {
              attributes: json({
                ...v.attributes(existing?.attributes ?? {}),
                sourceForm: 'rahkaran-documents-v1',
                sourceAssignments: JSON.stringify(sourceAssignments),
                ...(p.notes !== undefined
                  ? {
                      notes: JSON.stringify(
                        setupNotes(
                          p.notes,
                          v.attributes(existing?.attributes ?? {}).notes,
                          (
                            await this.identity.displayNames(
                              [actor.userId],
                              actor.branchIds,
                            )
                          )[0]?.displayName ?? actor.userId,
                        ),
                      ),
                    }
                  : {}),
              }),
            }
          : {}),
      };
      if (existing) {
        await tx.accountingTemplateLine.deleteMany({
          where: { templateId: id },
        });
        await tx.accountingTemplate.update({
          where: { id },
          data: {
            ...data,
            version: { increment: 1 },
          },
        });
        if (lines.length)
          await tx.accountingTemplateLine.createMany({
            data: lines.map((line) => ({ ...line, templateId: id })),
          });
        return templateDto(
          await tx.accountingTemplate.findUniqueOrThrow({
            where: { id },
            include: { lines: { orderBy: { position: 'asc' } } },
          }),
        );
      }
      await tx.accountingTemplate.create({ data: { id, ...data } });
      if (lines.length)
        await tx.accountingTemplateLine.createMany({
          data: lines.map((line) => ({ ...line, templateId: id })),
        });
      return templateDto(
        await tx.accountingTemplate.findUniqueOrThrow({
          where: { id },
          include: { lines: { orderBy: { position: 'asc' } } },
        }),
      );
    }
    if (
      action === 'document-revaluation-preview' ||
      action === 'document-revaluation-run'
    ) {
      const preview = await sourceRevaluationPreview(
        tx,
        book,
        p,
        await accountingCurrencies(this.master),
      );
      if (action === 'document-revaluation-preview') return preview;
      if (p.checksum !== preview.checksum)
        throw new ConflictException(
          'مانده، الگو یا نرخ تغییر کرده است؛ دوباره پیش‌نمایش بگیرید.',
        );
      if (!preview.lines.length)
        v.rule('اختلافی برای صدور سند تسعیر وجود ندارد.');
      const sourceKey = `REVALUE:${preview.periodId}:${preview.asOf}:SOURCE:${preview.checksum}`;
      if (
        await tx.accountingJournal.findFirst({
          where: {
            bookId,
            periodId: preview.periodId,
            sourceKey: {
              startsWith: `REVALUE:${preview.periodId}:${preview.asOf}:`,
            },
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
          },
        })
      )
        v.rule('سند تسعیر تعیین‌تکلیف‌نشده در این تاریخ وجود دارد.');
      return this.execute(
        tx,
        book,
        'journal-document-save',
        {
          periodId: preview.periodId,
          typeId: preview.typeId,
          documentDate: preview.asOf,
          description: preview.description,
          sourceKey,
          lines: preview.lines,
          ...(p.notes !== undefined ? { notes: p.notes } : {}),
          attributes: {
            ...preview.attributes,
            revaluationAsOf: preview.asOf,
            revaluationSourceChecksum: preview.checksum,
          },
        },
        undefined,
        actor,
        true,
        stateEvents,
      );
    }
    if (action === 'add-line-default-description') {
      const account = await tx.accountingAccount.findFirst({
        where: {
          id: v.uuid(p.accountId)!,
          bookId,
          active: true,
          level: 'SUBSIDIARY',
        },
      });
      if (!account) throw new NotFoundException();
      this.version(account.version, expected);
      const text = v.text(p.description, 2000, true),
        textEn = v.text(p.descriptionEn, 2000);
      const attrs = v.attributes(account.attributes);
      let rows: { text: string; textEn: string }[] = [];
      try {
        rows = JSON.parse(String(attrs.defaultDescriptions ?? '[]'));
      } catch {
        v.rule('شرح‌های پیش‌فرض معین معتبر نیستند.');
      }
      if (!Array.isArray(rows) || rows.length >= 100)
        v.rule('ظرفیت شرح‌های پیش‌فرض کافی نیست.');
      if (rows.some((row) => row.text === text && row.textEn === textEn))
        v.rule('این شرح پیش‌فرض قبلاً ثبت شده است.');
      const attributes = {
        ...attrs,
        defaultDescriptions: JSON.stringify([...rows, { text, textEn }]),
      };
      validateAccountForm(attributes, account.permanent);
      return tx.accountingAccount.update({
        where: { id: account.id },
        data: { attributes: json(attributes), version: { increment: 1 } },
      });
    }
    if (action === 'automatic-preview' || action === 'automatic-run') {
      if (!actor.permissions.includes('finance.journal.create'))
        throw new ForbiddenException();
      const preview = await automaticDocumentPreview(
        tx,
        book,
        p,
        await accountingCurrencies(this.master),
      );
      if (action === 'automatic-preview') return preview;
      if (p.checksum !== preview.checksum)
        throw new ConflictException(
          'مانده یا الگو از زمان پیش‌نمایش تغییر کرده است؛ دوباره پیش‌نمایش بگیرید.',
        );
      const created = await this.execute(
        tx,
        book,
        'journal-document-save',
        {
          periodId: preview.periodId,
          typeId: preview.typeId,
          documentDate: preview.documentDate,
          description: preview.description,
          lines: preview.lines,
          attributes: {
            ...preview.attributes,
            automaticTemplateId: preview.templateId,
            automaticTemplateVersion: String(preview.templateVersion),
            automaticAsOf: preview.asOf,
            automaticBasisChecksum: preview.checksum,
          },
        },
        undefined,
        actor,
        true,
        stateEvents,
      );
      return created;
    }
    if (action === 'journal-notes-save') {
      const id = v.uuid(p.id)!;
      const journal = await tx.accountingJournal.findFirst({
        where: { id, bookId },
      });
      if (!journal) throw new NotFoundException();
      this.version(journal.version, expected);
      const actorName =
        (await this.identity.displayNames([actor.userId], actor.branchIds))[0]
          ?.displayName ?? actor.userId;
      const attributes = v.attributes(journal.attributes);
      attributes.lastModifierId = actor.userId;
      attributes.notes = JSON.stringify(
        setupNotes(p.notes, attributes.notes, actorName),
      );
      v.attributes(attributes);
      return tx.accountingJournal.update({
        where: { id },
        data: { attributes: json(attributes), version: { increment: 1 } },
        include: journalInclude,
      });
    }
    if (action === 'journal-delete-documents') {
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 500)
        v.invalid('بین ۱ تا ۵۰۰ سند انتخاب کنید.');
      const ids = new Set<string>();
      const deleted = [];
      for (const raw of p.items) {
        const item = v.object(raw),
          id = v.uuid(item.id)!;
        if (
          ids.has(id) ||
          !Number.isSafeInteger(item.expectedVersion) ||
          Number(item.expectedVersion) < 1
        )
          v.invalid('انتخاب سند یا نسخه معتبر نیست.');
        ids.add(id);
        deleted.push(
          await this.execute(
            tx,
            book,
            'cancel',
            { id },
            Number(item.expectedVersion),
            actor,
            false,
            stateEvents,
          ),
        );
      }
      return { items: deleted, total: deleted.length };
    }
    if (
      [
        'journal-save',
        'journal-document-save',
        'journal-memorandum-save',
      ].includes(action)
    ) {
      const documentSave = action !== 'journal-save';
      const memorandum = action === 'journal-memorandum-save';
      const id = v.uuid(p.id, true) ?? randomUUID();
      const existing = await tx.accountingJournal.findFirst({
        where: { id, bookId },
        include: journalInclude,
      });
      if (existing) {
        this.version(existing.version, expected);
        if (!['DRAFT', 'MEMORANDUM'].includes(existing.status))
          v.rule('فقط پیش‌نویس قابل ویرایش است.');
        if (
          !internal &&
          v.attributes(existing.attributes).revaluationSourceChecksum
        )
          v.rule('سند تسعیر ارز قابل ویرایش نیست.');
        if (existing.status === 'MEMORANDUM' && !documentSave)
          v.rule('سند یادداشت باید از فرم صدور سند ثبت موقت یا یادداشت شود.');
      }
      const rows = v.lines(p.lines, internal);
      if (existing) {
        for (const [i, row] of rows.entries()) {
          const old = existing.lines[i];
          if (!old) continue;
          if (!internal)
            row.attributes = {
              ...without(v.attributes(old.attributes), lineWritableAttributes),
              ...row.attributes,
            };
          if (
            existing.sourceKey &&
            /^(REVALUE|OPEN|CLOSE|FINAL|NATURE|REVERSE):/.test(
              existing.sourceKey,
            ) &&
            [4, 5, 6].some(
              (n) =>
                row[`detail${n}Id` as 'detail4Id'] !==
                old[`detail${n}Id` as 'detail4Id'],
            )
          )
            v.rule('تفصیلی‌های سند محاسباتی باید با مبنا یکسان بمانند.');
        }
      }

      if (existing?.sourceKey && !financialSourceRebuild) {
        const unchanged =
          rows.length === existing.lines.length &&
          rows.every((row, i) => {
            const old = existing.lines[i];
            return (
              old &&
              row.accountId === old.accountId &&
              row.debit === old.debit.toString() &&
              row.credit === old.credit.toString() &&
              row.currency === old.currency &&
              row.rate === (old.rate?.toString() ?? null) &&
              row.foreignAmount === (old.foreignAmount?.toString() ?? null) &&
              (row.fxSnapshotId ?? null) === old.fxSnapshotId &&
              row.detail4Id === old.detail4Id &&
              row.detail5Id === old.detail5Id &&
              row.detail6Id === old.detail6Id &&
              v.attributes(row.attributes).trackingNumber ===
                v.attributes(old.attributes).trackingNumber &&
              v.attributes(row.attributes).trackingDate ===
                v.attributes(old.attributes).trackingDate
            );
          });
        if (!unchanged)
          v.rule('مبالغ و حساب‌های سند مبدأ فقط از جریان اصلی اصلاح می‌شوند.');
      }

      const periodId = v.uuid(p.periodId, true),
        typeId = v.uuid(p.typeId, true),
        documentDate = v.date(p.documentDate, true);
      if (
        existing?.sourceKey &&
        !internal &&
        (/^(OPEN|CLOSE|FINAL|NATURE):/.test(existing.sourceKey) ||
          !!v.attributes(existing.attributes).financialEventId ||
          !!v.attributes(existing.attributes).financialWorkflowId) &&
        (periodId !== existing.periodId ||
          typeId !== existing.typeId ||
          documentDate !== existing.documentDate)
      )
        v.rule(
          'دوره، نوع و تاریخ سند پایان سال فقط از جریان سازنده قابل تغییر است.',
        );
      const setupOpening =
        p.sourcePage === 'setup-opening' ||
        (existing &&
          v.attributes(existing.attributes).sourcePage === 'setup-opening');
      if (p.sourcePage !== undefined && p.sourcePage !== 'setup-opening')
        v.invalid('صفحه صدور سند معتبر نیست.');
      if (setupOpening) {
        const setupTypes = await tx.accountingConfiguration.findMany({
          where: {
            bookId,
            kind: 'voucher-types',
            active: true,
            title: 'افتتاحیه استقرار',
          },
          select: { id: true },
        });
        if (setupTypes.length !== 1 || typeId !== setupTypes[0]?.id)
          v.rule(
            'نوع سند افتتاحیه استقرار باید از نوع فعال همین دفتر باشد و قابل تغییر نیست.',
          );
        if (existing && existing.typeId !== typeId)
          v.rule('نوع سند موجود در فرم افتتاحیه استقرار قابل تبدیل نیست.');
      }
      const period = periodId
        ? await tx.accountingPeriod.findFirst({
            where: { id: periodId, bookId, status: 'OPEN' },
          })
        : null;
      if (periodId && !period) v.rule('دوره باز معتبر انتخاب کنید.');
      if (
        period &&
        documentDate &&
        (documentDate < period.startDate || documentDate > period.endDate)
      )
        v.rule('تاریخ سند باید داخل دوره انتخاب‌شده باشد.');
      if (
        typeId &&
        !(await tx.accountingConfiguration.findFirst({
          where: { id: typeId, bookId, kind: 'voucher-types', active: true },
        }))
      )
        v.rule('نوع سند معتبر انتخاب کنید.');
      if (periodId && documentDate) {
        const lastGeneral = await tx.accountingGeneralDocument.findFirst({
          where: { bookId, periodId },
          orderBy: { documentDate: 'desc' },
          select: { documentDate: true },
        });
        if (lastGeneral && documentDate <= lastGeneral.documentDate)
          v.rule('ثبت سند تا تاریخ آخرین سند کل مجاز نیست.');
      }
      if (documentSave) {
        if (!period || !documentDate || !typeId)
          v.rule('تاریخ داخل دوره باز و نوع سند فعال لازم است.');
        const lastPosted = await tx.accountingJournal.findFirst({
          where: { bookId, periodId, status: 'POSTED' },
          orderBy: { documentDate: 'desc' },
          select: { documentDate: true },
        });
        if (
          lastPosted?.documentDate &&
          (documentDate < lastPosted.documentDate ||
            (!existing && documentDate === lastPosted.documentDate))
        )
          v.rule('تاریخ سند نمی‌تواند قبل از آخرین سند قطعی دوره باشد.');
        if (
          await tx.accountingJournal.findFirst({
            where: {
              bookId,
              periodId,
              status: { not: 'CANCELLED' },
              OR: [
                { sourceKey: { startsWith: 'CLOSE:' } },
                {
                  attributes: {
                    path: ['operation'],
                    equals: 'year-end-closing',
                  },
                },
              ],
            },
            select: { id: true },
          })
        )
          v.rule('پس از صدور سند پایان دوره امکان ثبت سند وجود ندارد.');
        if (!memorandum) {
          if (rows.length < 2 || !v.totals(rows).balanced)
            v.rule(
              'ثبت موقت به اقلام بدهکار و بستانکار کامل و تراز نیاز دارد.',
            );
          for (const row of rows) {
            if (
              !row.accountId ||
              !row.description.trim() ||
              (row.debit === '0') === (row.credit === '0')
            )
              v.rule('هر قلم به حساب معین، شرح و یک سمت مبلغ مثبت نیاز دارد.');
          }
        }
      }
      await this.references(tx, bookId, rows);
      if (documentSave && !memorandum) {
        const currencyAccounts = new Set(
          (
            await tx.accountingAccount.findMany({
              where: {
                bookId,
                id: {
                  in: rows
                    .map((row) => row.accountId)
                    .filter((id): id is string => !!id),
                },
              },
              select: { id: true, attributes: true },
            })
          )
            .filter(
              (account) =>
                v.attributes(account.attributes).multiCurrency === true,
            )
            .map((account) => account.id),
        );
        for (const row of rows) {
          if (
            row.accountId &&
            currencyAccounts.has(row.accountId) &&
            !row.currency &&
            !(
              internal &&
              String(p.sourceKey).startsWith('REVALUE:') &&
              row.attributes.valuationCurrency
            )
          ) {
            row.currency = book.baseCurrency;
            row.rate = '1';
            row.foreignAmount = row.debit !== '0' ? row.debit : row.credit;
          }
          if (
            row.currency === book.baseCurrency &&
            (row.rate !== '1' ||
              row.foreignAmount !==
                (row.debit !== '0' ? row.debit : row.credit))
          )
            v.rule(
              'قلم با ارز عملیاتی باید نرخ یک و مبلغ ارز برابر مبلغ قلم داشته باشد.',
            );
        }
      }
      const moved = Boolean(
        existing &&
        (existing.periodId !== periodId ||
          existing.documentDate !== documentDate),
      );
      if (moved && existing) {
        if (!period || !documentDate)
          v.rule('جابه‌جایی سند به دوره باز و تاریخ داخل همان دوره نیاز دارد.');
        const existingAttributes = v.attributes(existing.attributes);
        if (
          (existing.number !== null &&
            !(
              documentSave &&
              existing.periodId === periodId &&
              v.attributes(existing.attributes).sourceForm ===
                'rahkaran-documents-v1'
            )) ||
          (existing.sourceKey && !financialSourceRebuild) ||
          existing.reversalOfId ||
          existingAttributes.operation !== undefined ||
          existingAttributes.templateId !== undefined ||
          (existingAttributes.sourceRequestId !== undefined &&
            !financialSourceRebuild)
        )
          v.rule('سند شماره‌دار، مبدأدار یا برگشتی قابل جابه‌جایی نیست.');
        if (
          existing.makerId !== actor.userId &&
          !actor.permissions.includes('finance.journal.approve')
        )
          throw new ForbiddenException();
      }
      const submittedInput = { ...v.attributes(p.attributes) };
      if (existing && !internal) {
        const storedAttributes = v.attributes(existing.attributes);
        for (const key of Object.keys(submittedInput)) {
          if (journalWritableAttributes.includes(key)) continue;
          if (
            storedAttributes[key] === undefined ||
            JSON.stringify(storedAttributes[key]) !==
              JSON.stringify(submittedInput[key])
          )
            v.invalid('ویژگی سیستمی سند حسابداری قابل تغییر نیست.');
          delete submittedInput[key];
        }
      }
      const submittedAttributes = v.journalAttributes(submittedInput, internal);
      if (documentSave)
        submittedAttributes.sourceForm = 'rahkaran-documents-v1';
      if (setupOpening) submittedAttributes.sourcePage = 'setup-opening';
      submittedAttributes.lastModifierId = actor.userId;
      if (p.notes !== undefined) {
        const actorName =
          (await this.identity.displayNames([actor.userId], actor.branchIds))[0]
            ?.displayName ?? actor.userId;
        submittedAttributes.notes = JSON.stringify(
          setupNotes(
            p.notes,
            existing ? v.attributes(existing.attributes).notes : undefined,
            actorName,
          ),
        );
      }
      if (!existing || (moved && documentSave)) {
        const sameDay = await tx.accountingJournal.findMany({
          where: { bookId, documentDate },
          select: { attributes: true },
        });
        const highestDailyNumber = sameDay.reduce((highest, row) => {
          const value = Number(v.attributes(row.attributes).dailyNumber);
          return Number.isSafeInteger(value) && value > highest
            ? value
            : highest;
        }, sameDay.length);
        submittedAttributes.dailyNumber = String(highestDailyNumber + 1);
      }
      let documentNumber = existing?.number ?? null;
      if (documentSave && documentNumber === null) {
        const serial = await tx.accountingJournal.aggregate({
          where: { bookId, periodId },
          _max: { number: true },
        });
        documentNumber = (serial._max.number ?? 0) + 1;
        if (documentNumber >= 2000000000) v.rule('ظرفیت شماره سند کافی نیست.');
        if (book.nextNumber <= documentNumber)
          await tx.accountingBook.update({
            where: { id: bookId },
            data: { nextNumber: documentNumber + 1 },
          });
      }
      const generatedReference =
        !existing && (!internal || documentSave) && !p.reference
          ? String(
              (await tx.accountingJournal.count({ where: { bookId } })) + 1,
            )
          : null;
      const data = {
        ...(internal && !existing && p.sourceKey
          ? { sourceKey: v.text(p.sourceKey, 200, true) }
          : {}),
        ...(documentSave
          ? {
              status: memorandum ? 'MEMORANDUM' : 'DRAFT',
              number: documentNumber,
            }
          : {}),
        periodId,
        typeId,
        documentDate,
        description: v.text(p.description, 2000),
        reference: v.text(p.reference, 160) || generatedReference,
        attributes: json(
          existing && !internal
            ? {
                ...without(
                  resetApprovalAttributes(existing.attributes),
                  journalWritableAttributes,
                ),
                ...submittedAttributes,
              }
            : submittedAttributes,
        ),
      };
      if (existing) {
        await tx.accountingJournalLine.deleteMany({ where: { journalId: id } });
        const updated = await tx.accountingJournal.update({
          where: { id },
          data: {
            ...data,
            makerId: actor.userId,
            approverId: null,
            version: { increment: 1 },
            lines: {
              create: rows.map((row, position) => ({
                ...row,
                position,
                attributes: json(row.attributes),
              })),
            },
          },
          include: journalInclude,
        });
        if (documentSave && !memorandum)
          await this.validatePosting(tx, book, updated);
        if (documentSave && existing.status !== updated.status)
          stateEvents.push({
            journalId: id,
            eventType: 'STATUS',
            fromStatus: existing.status,
            toStatus: updated.status,
            journalVersion: updated.version,
            oldPeriodId: existing.periodId,
            newPeriodId: updated.periodId,
            oldDocumentDate: existing.documentDate,
            newDocumentDate: updated.documentDate,
          });
        if (moved)
          stateEvents.push({
            journalId: id,
            eventType: 'MOVE',
            fromStatus: existing.status,
            toStatus: updated.status,
            journalVersion: updated.version,
            oldPeriodId: existing.periodId,
            newPeriodId: updated.periodId,
            oldDocumentDate: existing.documentDate,
            newDocumentDate: updated.documentDate,
            reason: v.text(p.moveReason, 2000) || null,
          });
        return updated;
      }
      const created = await tx.accountingJournal.create({
        data: {
          id,
          bookId,
          makerId: actor.userId,
          ...data,
          lines: {
            create: rows.map((row, position) => ({
              ...row,
              position,
              attributes: json(row.attributes),
            })),
          },
        },
        include: journalInclude,
      });
      if (documentSave && !memorandum)
        await this.validatePosting(tx, book, created);
      stateEvents.push({
        journalId: created.id,
        eventType: 'CREATE',
        fromStatus: null,
        toStatus: created.status,
        journalVersion: created.version,
        newPeriodId: created.periodId,
        newDocumentDate: created.documentDate,
      });
      return created;
    }
    if (action === 'reorder-journals') {
      return reorderJournals(tx, bookId, p);
    }
    if (action === 'move-drafts') {
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 100)
        v.invalid('بین یک تا صد سند برای جابه‌جایی انتخاب کنید.');
      const items = p.items.map((raw) => {
        const item = v.object(raw),
          expectedVersion = Number(item.expectedVersion);
        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
          v.invalid('نسخه مورد انتظار همه اسناد لازم است.');
        return { id: v.uuid(item.id)!, expectedVersion };
      });
      if (new Set(items.map((item) => item.id)).size !== items.length)
        v.invalid('شناسه تکراری سند مجاز نیست.');
      const periodId = v.uuid(p.periodId)!,
        documentDate = v.date(p.documentDate)!,
        reason = v.text(p.reason, 2000),
        period = await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId, status: 'OPEN' },
        });
      if (
        !period ||
        documentDate < period.startDate ||
        documentDate > period.endDate
      )
        v.rule('تاریخ مقصد باید داخل دوره باز انتخاب‌شده باشد.');
      const journals = await tx.accountingJournal.findMany({
        where: { bookId, id: { in: items.map((item) => item.id) } },
        orderBy: { id: 'asc' },
      });
      if (journals.length !== items.length) throw new NotFoundException();
      const versions = new Map(
        items.map((item) => [item.id, item.expectedVersion]),
      );
      for (const journal of journals) {
        this.version(journal.version, versions.get(journal.id));
        const journalAttributes = v.attributes(journal.attributes);
        if (
          journal.status !== 'DRAFT' ||
          journal.number !== null ||
          journal.sourceKey ||
          journal.reversalOfId ||
          journalAttributes.operation !== undefined ||
          journalAttributes.templateId !== undefined ||
          journalAttributes.sourceRequestId !== undefined
        )
          v.rule('فقط پیش‌نویس عادی و بدون شماره قابل جابه‌جایی است.');
        if (
          journal.makerId !== actor.userId &&
          !actor.permissions.includes('finance.journal.approve')
        )
          throw new ForbiddenException();
      }
      const results = [];
      for (const journal of journals) {
        const updated = await tx.accountingJournal.update({
          where: { id: journal.id },
          data: {
            periodId,
            documentDate,
            makerId: actor.userId,
            approverId: null,
            attributes: json(resetApprovalAttributes(journal.attributes)),
            version: { increment: 1 },
          },
          include: journalInclude,
        });
        stateEvents.push({
          journalId: journal.id,
          eventType: 'MOVE',
          fromStatus: journal.status,
          toStatus: updated.status,
          journalVersion: updated.version,
          oldPeriodId: journal.periodId,
          newPeriodId: updated.periodId,
          oldDocumentDate: journal.documentDate,
          newDocumentDate: updated.documentDate,
          reason,
        });
        results.push(updated);
      }
      return { items: results };
    }
    if (
      [
        'submit',
        'approve',
        'post',
        'return',
        'cancel',
        'restore',
        'reverse',
      ].includes(action)
    ) {
      const id = v.uuid(p.id)!;
      const journal = await tx.accountingJournal.findFirst({
        where: { id, bookId },
        include: journalInclude,
      });
      if (!journal) throw new NotFoundException();
      this.version(journal.version, expected);
      if (action === 'restore') {
        if (journal.status !== 'CANCELLED')
          v.rule('فقط سند لغوشده قابل بازیابی است.');
        if (v.attributes(journal.attributes).supersededSourceKey)
          v.rule('سند پایان سال جایگزین‌شده قابل بازیابی نیست.');
        if (
          journal.makerId !== actor.userId &&
          !actor.permissions.includes('finance.journal.approve')
        )
          throw new ForbiddenException();
        if (
          journal.periodId &&
          !(await tx.accountingPeriod.findFirst({
            where: { id: journal.periodId, bookId, status: 'OPEN' },
          }))
        )
          v.rule('دوره سند برای بازیابی باید باز باشد.');
        const deletion = await tx.accountingJournalStateEvent.findFirst({
          where: { journalId: id, bookId, toStatus: 'CANCELLED' },
          orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        });
        const restored = await tx.accountingJournal.update({
          where: { id },
          data: {
            status:
              deletion?.fromStatus === 'MEMORANDUM' ? 'MEMORANDUM' : 'DRAFT',
            approverId: null,
            attributes: json(resetApprovalAttributes(journal.attributes)),
            version: { increment: 1 },
          },
          include: journalInclude,
        });
        stateEvents.push({
          journalId: id,
          eventType: 'STATUS',
          fromStatus: journal.status,
          toStatus: restored.status,
          journalVersion: restored.version,
          oldPeriodId: journal.periodId,
          newPeriodId: restored.periodId,
          oldDocumentDate: journal.documentDate,
          newDocumentDate: restored.documentDate,
          reason: v.text(p.reason, 2000) || null,
        });
        return restored;
      }
      if (action === 'return' || action === 'cancel') {
        if (action === 'return' && journal.status === 'MEMORANDUM')
          v.rule('سند یادداشت باید ابتدا ثبت موقت شود.');
        if (journal.status === 'POSTED' || journal.status === 'CANCELLED')
          v.rule('سند قطعی یا لغوشده قابل تغییر نیست.');
        if (
          journal.makerId !== actor.userId &&
          !actor.permissions.includes('finance.journal.approve')
        )
          throw new ForbiddenException();
        const returned = await tx.accountingJournal.update({
          where: { id },
          data: {
            status: action === 'return' ? 'DRAFT' : 'CANCELLED',
            approverId: null,
            attributes: json(resetApprovalAttributes(journal.attributes)),
            version: { increment: 1 },
          },
          include: journalInclude,
        });
        stateEvents.push({
          journalId: id,
          eventType: 'STATUS',
          fromStatus: journal.status,
          toStatus: returned.status,
          journalVersion: returned.version,
          oldPeriodId: journal.periodId,
          newPeriodId: returned.periodId,
          oldDocumentDate: journal.documentDate,
          newDocumentDate: returned.documentDate,
          reason: v.text(p.reason, 2000) || null,
        });
        return returned;
      }
      if (action === 'reverse') {
        const sourceEvent = journal.sourceKey?.startsWith('SALES:')
          ? await tx.financeAccountingEvent.findFirst({
              where: { journalId: journal.id },
            })
          : null;
        if (sourceEvent && isReceiptAllocation(sourceEvent.kind))
          v.rule('برگشت سند تخصیص باید از عملیات برگشت تخصیص انجام شود.');
        if (sourceEvent?.kind === 'CUSTOMER_RECEIPT') {
          const transfers = await tx.financeAccountingEvent.findMany({
            where: { basisEventId: sourceEvent.id },
            include: { journal: { select: { status: true } } },
          });
          const net = transfers.reduce(
            (sum, item) =>
              sum.add(
                item.amount.mul(item.kind === 'RECEIPT_ALLOCATION' ? 1 : -1),
              ),
            new Prisma.Decimal(0),
          );
          if (
            !net.isZero() ||
            transfers.some((item) => item.journal?.status !== 'POSTED')
          )
            v.rule(
              'ابتدا همه تخصیص‌های دریافت را برگشت دهید و اسناد تخصیص و برگشت را ثبت نهایی کنید.',
            );
        }
        await assertSalesContractJournalReversible(tx, journal.id);
        if (journal.status !== 'POSTED')
          v.rule('فقط سند قطعی برگشت داده می‌شود.');
        if (
          await tx.accountingJournal.findUnique({ where: { reversalOfId: id } })
        )
          v.rule('سند برگشتی قبلاً ایجاد شده است.');
        const periodId = v.uuid(p.periodId)!,
          documentDate = v.date(p.documentDate)!;
        const period = await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId, status: 'OPEN' },
        });
        if (
          !period ||
          documentDate < period.startDate ||
          documentDate > period.endDate
        )
          v.rule('تاریخ برگشت باید در دوره باز باشد.');
        const reversal = await tx.accountingJournal.create({
          data: {
            bookId,
            periodId,
            documentDate,
            typeId: journal.typeId,
            makerId: actor.userId,
            description: v.text(p.reason, 2000),
            reversalOfId: id,
            sourceKey: `REVERSE:${id}`,
            attributes: { reversalSourceKey: journal.sourceKey ?? '' },
            lines: {
              create: journal.lines.map((row) => ({
                position: row.position,
                accountId: row.accountId,
                detail4Id: row.detail4Id,
                detail5Id: row.detail5Id,
                detail6Id: row.detail6Id,
                description: row.description,
                debit: row.credit,
                credit: row.debit,
                currency: row.currency,
                foreignAmount: row.foreignAmount,
                rate: row.rate,
                fxSnapshotId: row.fxSnapshotId,
                attributes: json(row.attributes),
              })),
            },
          },
          include: journalInclude,
        });
        stateEvents.push({
          journalId: reversal.id,
          eventType: 'CREATE',
          fromStatus: null,
          toStatus: reversal.status,
          journalVersion: reversal.version,
          newPeriodId: reversal.periodId,
          newDocumentDate: reversal.documentDate,
          reason: v.text(p.reason, 2000),
        });
        return reversal;
      }
      if (
        journal.status !==
        (action === 'submit'
          ? 'DRAFT'
          : action === 'approve'
            ? 'PENDING_APPROVAL'
            : 'APPROVED')
      )
        v.rule('وضعیت سند برای این عملیات معتبر نیست.');
      const warnings = await this.validatePosting(tx, book, journal);
      const policy = await this.approvalPolicy(tx, book, journal);
      if (
        action === 'approve' &&
        !actor.permissions.includes('finance.journal.approve')
      )
        throw new ForbiddenException();
      if (
        action === 'post' &&
        (v.attributes(journal.attributes).approvalPolicyId !== policy.id ||
          v.attributes(journal.attributes).approvalPolicyVersion !==
            String(policy.version))
      )
        v.rule('قاعده تأیید سند تغییر کرده است؛ سند دوباره تأیید شود.');

      if (action === 'approve' && journal.makerId === actor.userId)
        v.rule('ایجادکننده نمی‌تواند سند خودش را تأیید کند.');
      if (
        action === 'post' &&
        (!journal.approverId || journal.approverId === journal.makerId)
      )
        v.rule('تأیید مستقل سند لازم است.');
      let number: number | null = journal.number;
      if (action === 'post' && number === null) {
        const current = await tx.accountingBook.update({
          where: { id: bookId },
          data: { nextNumber: { increment: 1 } },
        });
        number = current.nextNumber - 1;
      }
      const transitioned = await tx.accountingJournal.update({
        where: { id },
        data: {
          status:
            action === 'submit'
              ? 'PENDING_APPROVAL'
              : action === 'approve'
                ? 'APPROVED'
                : 'POSTED',
          ...(action === 'approve'
            ? {
                approverId: actor.userId,
                attributes: {
                  ...v.attributes(journal.attributes),
                  approvalPolicyId: policy.id,
                  approvalPolicyVersion: String(policy.version),
                },
              }
            : {}),
          ...(action === 'post' ? { number, postedAt: new Date() } : {}),
          attributes: {
            ...v.attributes(journal.attributes),
            ...(action === 'approve'
              ? {
                  approvalPolicyId: policy.id,
                  approvalPolicyVersion: String(policy.version),
                }
              : {}),
            warnings,
          },
          version: { increment: 1 },
        },
        include: journalInclude,
      });
      stateEvents.push({
        journalId: id,
        eventType: 'STATUS',
        fromStatus: journal.status,
        toStatus: transitioned.status,
        journalVersion: transitioned.version,
        oldPeriodId: journal.periodId,
        newPeriodId: transitioned.periodId,
        oldDocumentDate: journal.documentDate,
        newDocumentDate: transitioned.documentDate,
        reason: v.text(p.reason, 2000) || null,
      });
      return transitioned;
    }
    if (action === 'close-period') {
      const id = v.uuid(p.id)!;
      const period = await tx.accountingPeriod.findFirst({
        where: { id, bookId },
      });
      if (!period) throw new NotFoundException();
      this.version(period.version, expected);
      if (period.status !== 'OPEN') v.rule('دوره قبلاً بسته شده است.');
      if (
        await tx.accountingJournal.count({
          where: {
            periodId: id,
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
          },
        })
      )
        v.rule('اسناد نهایی‌نشده دوره را تعیین تکلیف کنید.');
      const balances = await tx.accountingJournalLine.groupBy({
        by: ['accountId'],
        where: { journal: { bookId, periodId: id, status: 'POSTED' } },
        _sum: { debit: true, credit: true },
      });
      for (const row of balances) {
        const account = row.accountId
          ? await tx.accountingAccount.findUnique({
              where: { id: row.accountId },
            })
          : null;
        if (
          account &&
          (!account.permanent ||
            v.attributes(account.attributes).zeroBalanceAtClose === true) &&
          DecimalValue.parse(row._sum.debit?.toString() ?? '0').compare(
            DecimalValue.parse(row._sum.credit?.toString() ?? '0'),
          ) !== 0
        )
          v.rule('حساب موقت یا حساب کنترل‌شده مانده غیرصفر دارد.');
      }
      if (
        !(await tx.accountingJournal.findFirst({
          where: {
            bookId,
            periodId: id,
            status: 'POSTED',
            sourceKey: `FINAL:${id}`,
          },
        }))
      ) {
        const outstanding = await tx.$queryRaw<{ present: number }[]>`
          SELECT 1 AS present FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
          WHERE j."bookId"=${bookId}::uuid AND j."periodId"=${id}::uuid AND j.status='POSTED'
          GROUP BY l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",l.currency,l."fxSnapshotId",l.rate,l.attributes->>'valuationCurrency',l.attributes->>'trackingNumber',l.attributes->>'trackingDate'
          HAVING SUM(l.debit-l.credit)<>0 OR COALESCE(SUM(CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE -l."foreignAmount" END),0)<>0 LIMIT 1`;
        if (outstanding.length)
          v.rule('اختتامیه قطعی برای بستن دوره دارای مانده لازم است.');
      }
      return tx.accountingPeriod.update({
        where: { id },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });
    }
    v.invalid('عملیات حسابداری ناشناخته است.');
  }
  private async references(
    tx: Tx,
    bookId: string,
    rows: ReturnType<typeof v.lines>,
  ) {
    const fxIds = [
      ...new Set(rows.flatMap((r) => (r.fxSnapshotId ? [r.fxSnapshotId] : []))),
    ];
    if (
      (await tx.accountingFxSnapshot.count({
        where: { id: { in: fxIds }, bookId },
      })) !== fxIds.length
    )
      v.rule('نرخ ارز متعلق به این دفتر نیست.');
    const accounts = [
        ...new Set(rows.flatMap((r) => (r.accountId ? [r.accountId] : []))),
      ],
      details = [
        ...new Set(
          rows.flatMap((r) =>
            [r.detail4Id, r.detail5Id, r.detail6Id].filter(
              (id): id is string => !!id,
            ),
          ),
        ),
      ];
    if (
      (await tx.accountingAccount.count({
        where: { id: { in: accounts }, bookId },
      })) !== accounts.length ||
      (await tx.accountingDetail.count({
        where: { id: { in: details }, bookId },
      })) !== details.length
    )
      v.rule('حساب یا تفصیلی متعلق به این دفتر نیست.');
  }
  private async validatePosting(
    tx: Tx,
    book: Prisma.AccountingBookGetPayload<object>,
    journal: Prisma.AccountingJournalGetPayload<{
      include: typeof journalInclude;
    }>,
  ) {
    const endAttributes = v.attributes(journal.attributes);
    const workflowContext = await workflowPostingContext(tx, book, journal);
    let financialValuationAt: Date | null = workflowContext.at;
    let allocationCarry = false;
    if (endAttributes.financialEventId) {
      const event = await tx.financeAccountingEvent.findFirst({
        where: {
          id: String(endAttributes.financialEventId),
          branchId: book.branchId,
          sourceKey: journal.sourceKey ?? '',
        },
      });
      if (!event) v.rule('مبنای رویداد مالی سند پیدا نشد.');
      await validateSalesContractAccountingSource(tx, event);
      await validateSalesContractAccounts(
        tx,
        event,
        book.id,
        journal.lines.find((l) => l.debit.gt(0))?.accountId ?? '',
        journal.lines.find((l) => l.credit.gt(0))?.accountId ?? '',
      );
      if (event.kind === SALES_CONTRACT_EVENT) {
        const debit = journal.lines.find((l) => l.debit.gt(0));
        const credit = journal.lines.find((l) => l.credit.gt(0));
        if (
          journal.lines.length !== 2 ||
          !debit ||
          !credit ||
          !debit.credit.isZero() ||
          !credit.debit.isZero() ||
          (event.currency === book.baseCurrency
            ? !debit.debit.eq(event.amount) || !credit.credit.eq(event.amount)
            : !debit.foreignAmount?.eq(event.amount) ||
              !credit.foreignAmount?.eq(event.amount) ||
              debit.currency !== event.currency ||
              credit.currency !== event.currency)
        )
          v.rule(
            'اقلام تعهد قرارداد باید دقیقاً با مبلغ و ارز مبدأ منطبق باشند.',
          );
      }
      financialValuationAt = event.occurredAt;
      if (isReceiptAllocation(event.kind)) {
        if (!event.basisEventId) v.rule('مبنای تخصیص سند یافت نشد.');
        const original = await tx.financeAccountingEvent.findFirst({
          where: { id: event.basisEventId, branchId: book.branchId },
        });
        if (!original) v.rule('دریافت اصلی سند یافت نشد.');
        const basis = await postedReceiptBasis(
          tx,
          original.recordId,
          book.branchId,
          false,
        );
        if (basis.journal.bookId !== book.id)
          v.rule('دفتر تخصیص با سند دریافت یکسان نیست.');
        const expectedLines = receiptAllocationLines(event, basis);
        if (
          journal.lines.length !== expectedLines.length ||
          expectedLines.some((line, index) => {
            const actual = journal.lines[index]!;
            return (
              actual.accountId !== line.accountId ||
              actual.detail4Id !== line.detail4Id ||
              actual.detail5Id !== line.detail5Id ||
              actual.detail6Id !== line.detail6Id ||
              actual.debit.toString() !== line.debit ||
              actual.credit.toString() !== line.credit ||
              actual.currency !== (line.currency ?? null) ||
              actual.foreignAmount?.toString() !== line.foreignAmount ||
              actual.rate?.toString() !== line.rate ||
              actual.fxSnapshotId !== (line.fxSnapshotId ?? null) ||
              v.attributes(actual.attributes).trackingNumber !==
                line.attributes.trackingNumber ||
              v.attributes(actual.attributes).trackingDate !==
                line.attributes.trackingDate
            );
          })
        )
          v.rule(
            'اقلام تخصیص باید دقیقاً با مبنای دریافت و مبلغ دفتری ثبت‌شده منطبق باشند.',
          );
        allocationCarry = true;
        financialValuationAt = basis.event.occurredAt;
      }
    }
    const historicalHeader =
      allocationCarry ||
      (!!journal.sourceKey &&
        /^(OPEN|CLOSE|FINAL|NATURE|REVERSE):/.test(journal.sourceKey) &&
        (endAttributes.fxCarryPolicy === 'HISTORICAL_LOTS' ||
          !!journal.reversalOfId));
    if (endAttributes.sourceJournalChecksum && endAttributes.sourcePeriodId) {
      const basis = await tx.accountingJournal.findMany({
        where: {
          bookId: book.id,
          periodId: String(endAttributes.sourcePeriodId),
          id: { not: journal.id },
          status: { not: 'CANCELLED' },
        },
        select: { id: true, version: true, status: true },
        orderBy: { id: 'asc' },
      });
      const accounts = await tx.accountingAccount.findMany({
        where: { bookId: book.id },
        orderBy: { id: 'asc' },
      });
      if (
        createHash('sha256').update(JSON.stringify(basis)).digest('hex') !==
          endAttributes.sourceJournalChecksum ||
        createHash('sha256')
          .update(JSON.stringify(canonical(accounts)))
          .digest('hex') !== endAttributes.sourceAccountChecksum
      )
        v.rule(
          'مبنای سند پایان سال تغییر کرده است؛ سند را لغو و دوباره محاسبه کنید.',
        );
      if (endAttributes.templateId) {
        const template = await tx.accountingTemplate.findFirst({
          where: {
            id: String(endAttributes.templateId),
            bookId: book.id,
            active: true,
          },
        });
        if (
          !template ||
          String(template.version) !== endAttributes.templateVersion
        )
          v.rule('الگوی مبنای سند پایان سال تغییر کرده است.');
      }
    }
    if (journal.sourceKey?.startsWith('REVALUE:')) {
      const attrs = v.attributes(journal.attributes);
      if (attrs.revaluationSourceChecksum) {
        const preview = await sourceRevaluationPreview(
          tx,
          book,
          {
            templateId: attrs.revaluationTemplateId,
            asOf: attrs.revaluationAsOf,
            currency: attrs.revaluationCurrency,
            rateId: attrs.revaluationRateId,
            description: journal.description,
            descriptionEn: attrs.descriptionEn,
            auxiliaryNumber: attrs.auxiliaryNumber,
          },
          await accountingCurrencies(this.master),
          journal.id,
        );
        if (preview.checksum !== attrs.revaluationSourceChecksum)
          v.rule(
            'مانده، الگو یا نرخ مبنای تسعیر تغییر کرده است؛ سند را لغو و دوباره محاسبه کنید.',
          );
      } else {
        const basis = await this.revaluationBasis(
          tx,
          book,
          journal.periodId!,
          String(attrs.asOf),
        );
        if (basis.checksum !== attrs.basisChecksum)
          v.rule(
            'مانده‌های مبنای تسعیر تغییر کرده‌اند؛ سند را لغو و پیش‌نمایش جدید تهیه کنید.',
          );
      }
    }
    if (!book.active || !book.allowsPosting)
      v.rule('دفتر اجازه ثبت سند ندارد.');
    const period = journal.periodId
      ? await tx.accountingPeriod.findFirst({
          where: { id: journal.periodId, bookId: book.id, status: 'OPEN' },
        })
      : null;
    if (
      !period ||
      !journal.documentDate ||
      journal.documentDate < period.startDate ||
      journal.documentDate > period.endDate
    )
      v.rule('تاریخ سند باید داخل دوره باز باشد.');
    if (
      !journal.sourceKey?.startsWith('FINAL:') &&
      (await tx.accountingJournal.findFirst({
        where: {
          bookId: book.id,
          periodId: period.id,
          status: 'POSTED',
          sourceKey: `FINAL:${period.id}`,
        },
      }))
    )
      v.rule('پس از اختتامیه قطعی، ثبت سند در دوره مبدأ مجاز نیست.');
    if (
      !journal.typeId ||
      !(await tx.accountingConfiguration.findFirst({
        where: {
          id: journal.typeId,
          bookId: book.id,
          kind: 'voucher-types',
          active: true,
        },
      }))
    )
      v.rule('نوع سند فعال انتخاب کنید.');
    const sourceDocument =
      v.attributes(journal.attributes).sourceForm === 'rahkaran-documents-v1';
    if (
      (!sourceDocument && journal.description.trim().length < 3) ||
      journal.lines.length < 2
    )
      v.rule('شرح و حداقل دو ردیف کامل لازم است.');
    const rows = journal.lines.map((row) => ({
      ...row,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
    }));
    if (!v.totals(rows).balanced)
      v.rule('جمع بدهکار و بستانکار باید برابر و غیرصفر باشد.');
    const warnings: string[] = [];
    const checkedNature = new Set<string>();
    for (const row of rows) {
      if (sourceDocument && !row.description.trim())
        v.rule('شرح همه اقلام سند برای ثبت موقت لازم است.');
      const account = row.accountId
        ? await tx.accountingAccount.findFirst({
            where: {
              id: row.accountId,
              bookId: book.id,
              active: true,
              level: 'SUBSIDIARY',
            },
          })
        : null;
      if (!account || (row.debit === '0') === (row.credit === '0'))
        v.rule('هر ردیف یک حساب معین فعال و فقط یک سمت مبلغ مثبت لازم دارد.');
      const accountAttrs = v.attributes(account.attributes);
      if (accountAttrs.traceable === true) {
        v.text(v.attributes(row.attributes).trackingNumber, 160, true);
        v.date(v.attributes(row.attributes).trackingDate);
      }
      if (
        account.nature !== 'ANY' &&
        ['WARN', 'BLOCK'].includes(String(accountAttrs.natureControl))
      ) {
        const detailTypes: Record<string, string> = {};
        if (accountAttrs.natureControlScope === 'SELECTED_DETAIL') {
          const ids = [row.detail4Id, row.detail5Id, row.detail6Id].filter(
            (id): id is string => !!id,
          );
          for (const detail of await tx.accountingDetail.findMany({
            where: { bookId: book.id, id: { in: ids } },
            select: { id: true, typeId: true },
          }))
            detailTypes[detail.id] = detail.typeId;
        }
        for (const dimensions of accountControlFilters(
          accountAttrs,
          row,
          detailTypes,
        )) {
          const checkKey = `${account.id}:${JSON.stringify(dimensions)}`;
          if (checkedNature.has(checkKey)) continue;
          checkedNature.add(checkKey);
          const sums = await tx.accountingJournalLine.aggregate({
            where: {
              accountId: account.id,
              ...dimensions,
              journal: {
                bookId: book.id,
                periodId: journal.periodId,
                status: 'POSTED',
                documentDate: { lte: journal.documentDate },
              },
            },
            _sum: { debit: true, credit: true },
          });
          const projected = rows
            .filter(
              (r) =>
                r.accountId === account.id &&
                Object.entries(dimensions).every(
                  ([key, value]) =>
                    r[key as 'detail4Id' | 'detail5Id' | 'detail6Id'] === value,
                ),
            )
            .reduce(
              (a, r) =>
                a
                  .add(DecimalValue.parse(r.debit))
                  .subtract(DecimalValue.parse(r.credit)),
              DecimalValue.parse(sums._sum.debit?.toString() ?? '0').subtract(
                DecimalValue.parse(sums._sum.credit?.toString() ?? '0'),
              ),
            );
          if (
            !projected.isZero &&
            (account.nature === 'DEBIT'
              ? projected.isNegative
              : !projected.isNegative)
          ) {
            const message = `مانده حساب ${account.code} خلاف ماهیت تعیین‌شده است.`;
            if (accountAttrs.natureControl === 'BLOCK') v.rule(message);
            warnings.push(message);
          }
        }
      }
      for (const n of [4, 5, 6] as const) {
        const id = row[`detail${n}Id`];
        const attrs = v.attributes(account.attributes);
        if (attrs[`detail${n}Required`] === true && !id)
          v.rule(`تفصیلی سطح ${n} لازم است.`);
        if (id) {
          const detail = await tx.accountingDetail.findFirst({
            where: { id, bookId: book.id, active: true },
          });
          if (
            !detail ||
            (attrs[`detail${n}TypeId`] &&
              detail.typeId !== attrs[`detail${n}TypeId`]) ||
            (Array.isArray(attrs[`detail${n}TypeIds`]) &&
              (attrs[`detail${n}TypeIds`] as string[]).length > 0 &&
              !(attrs[`detail${n}TypeIds`] as string[]).includes(detail.typeId))
          )
            v.rule('تفصیلی با قواعد حساب سازگار نیست.');
        }
      }
      if (
        row.fxSnapshotId &&
        (!row.currency || row.currency === book.baseCurrency)
      ) {
        if (
          !historicalHeader &&
          !journal.sourceKey?.startsWith('REVALUE:') &&
          !(
            journal.reversalOfId &&
            String(
              v.attributes(journal.attributes).reversalSourceKey,
            ).startsWith('REVALUE:')
          )
        )
          v.rule('نرخ ارز باید به ردیف ارزی مربوط باشد.');
        const fx = await tx.accountingFxSnapshot.findFirst({
          where: {
            id: row.fxSnapshotId,
            bookId: book.id,
            status: 'APPROVED',
            currency: String(v.attributes(row.attributes).valuationCurrency),
          },
        });
        if (
          !fx ||
          (!historicalHeader &&
            !journal.reversalOfId &&
            (fx.validFrom > new Date() || fx.validTo < new Date()))
        )
          v.rule('نرخ تسعیر دیگر معتبر نیست.');
      }
      if (row.currency && row.currency !== book.baseCurrency) {
        const historicalCarry =
          workflowContext.carryAccounts.includes(row.accountId!) ||
          allocationCarry ||
          (!!journal.sourceKey &&
            /^(OPEN|CLOSE|FINAL|NATURE|REVERSE):/.test(journal.sourceKey) &&
            (v.attributes(journal.attributes).fxCarryPolicy ===
              'HISTORICAL_LOTS' ||
              !!journal.reversalOfId));
        if (!v.attributes(account.attributes).multiCurrency)
          v.rule('حساب ویژگی ارزی ندارد.');
        const fx = row.fxSnapshotId
          ? await tx.accountingFxSnapshot.findFirst({
              where: {
                id: row.fxSnapshotId,
                bookId: book.id,
                currency: row.currency,
                status: 'APPROVED',
              },
            })
          : null;
        if (
          !fx ||
          !fx.approverId ||
          fx.makerId === fx.approverId ||
          (!historicalCarry &&
            (fx.validFrom > (financialValuationAt ?? new Date()) ||
              fx.validTo < (financialValuationAt ?? new Date()))) ||
          !row.foreignAmount ||
          !row.rate ||
          fx.rate.toString() !== row.rate.toString()
        )
          v.rule('نرخ مصوب معتبر و مبلغ ارزی لازم است.');
        const expectedAmount = DecimalValue.parse(row.foreignAmount.toString())
          .multiply(DecimalValue.parse(fx.rate.toString()))
          .round(
            book.baseCurrency === 'IRR' ? 0 : 2,
            book.baseCurrency === 'IRR' ? 'HALF_UP' : 'HALF_EVEN',
          );
        if (
          !historicalCarry &&
          expectedAmount.compare(
            DecimalValue.parse(row.debit === '0' ? row.credit : row.debit),
          ) !== 0
        )
          v.rule('مبلغ پایه با مبلغ ارزی و نرخ مصوب مطابقت ندارد.');
      }
      const amount = DecimalValue.parse(
        row.debit === '0' ? row.credit : row.debit,
      );
      if (
        book.baseCurrency === 'IRR' &&
        amount.round(0, 'HALF_UP').compare(amount) !== 0
      )
        v.rule('مبلغ ریالی باید عدد صحیح باشد.');
    }
    return warnings;
  }
  private async receiptAllocationJournal(
    tx: Tx,
    book: Prisma.AccountingBookGetPayload<object>,
    event: Prisma.FinanceAccountingEventGetPayload<object>,
    p: Record<string, unknown>,
    expected: number | undefined,
    actor: AuthenticatedActor,
    stateEvents: BufferedStateEvent[],
  ) {
    this.require(actor, 'finance.receipt.approve');
    if (!event.basisEventId) v.rule('مبنای تخصیص یافت نشد.');
    const original = await tx.financeAccountingEvent.findFirst({
      where: { id: event.basisEventId, branchId: book.branchId },
    });
    if (!original) v.rule('دریافت اصلی تخصیص یافت نشد.');
    const basis = await postedReceiptBasis(
      tx,
      original.recordId,
      book.branchId,
      false,
    );
    if (basis.journal.bookId !== book.id)
      v.rule('تخصیص باید در دفتر سند دریافت اصلی ثبت شود.');
    const previous = event.journalId
      ? await tx.accountingJournal.findUniqueOrThrow({
          where: { id: event.journalId },
          include: journalInclude,
        })
      : null;
    if (previous && p.rebuild !== true) return previous;
    if (previous) {
      this.version(previous.version, expected);
      if (previous.status !== 'DRAFT')
        v.rule('فقط پیش‌نویس تخصیص قابل بازسازی است.');
    }
    const operationDate = financialDate(event.occurredAt),
      documentDate =
        v.date(p.documentDate, true) ?? previous?.documentDate ?? operationDate;
    const reason =
      documentDate === operationDate
        ? ''
        : v.text(p.latePostingReason, 500) ||
          String(
            v.attributes(previous?.attributes ?? {}).latePostingReason ?? '',
          );
    if (
      documentDate < operationDate ||
      (documentDate !== operationDate && reason.length < 10)
    )
      v.rule(
        'تاریخ تخصیص نباید پیش از عملیات باشد و ثبت دیرهنگام به علت نیاز دارد.',
      );
    const periods = await tx.accountingPeriod.findMany({
      where: {
        bookId: book.id,
        status: 'OPEN',
        startDate: { lte: documentDate },
        endDate: { gte: documentDate },
        ...(p.periodId ? { id: v.uuid(p.periodId)! } : {}),
      },
    });
    if (periods.length !== 1)
      v.rule('برای تاریخ تخصیص باید دقیقاً یک دوره باز انتخاب شود.');
    const lines = receiptAllocationLines(event, basis);
    const created = (await this.execute(
      tx,
      book,
      'journal-save',
      {
        ...(previous ? { id: previous.id } : {}),
        periodId: periods[0]!.id,
        typeId: basis.journal.typeId,
        documentDate,
        sourceKey: event.sourceKey,
        description: accountingFinancialEventLabels[event.kind],
        reference: event.reference,
        attributes: {
          ...resetApprovalAttributes(previous?.attributes ?? {}),
          financialEventId: event.id,
          receiptBasisEventId: basis.event.id,
          fxCarryPolicy: 'RECEIPT_ALLOCATION_CARRY',
          sourceOccurredAt: event.occurredAt.toISOString(),
          latePostingReason: reason,
          source: event.source,
          recordId: event.recordId,
          sourceRequestId: event.requestId,
          sourceAmount: event.amount.toString(),
          sourceCurrency: event.currency,
        },
        lines,
      },
      previous?.version,
      actor,
      true,
      stateEvents,
      !!previous,
    )) as { id: string };
    const journal = await tx.accountingJournal.findUniqueOrThrow({
      where: { id: created.id },
      include: journalInclude,
    });
    await this.validatePosting(tx, book, journal);
    await tx.financeAccountingEvent.update({
      where: { id: event.id },
      data: { journalId: journal.id, lastError: null, attemptedAt: new Date() },
    });
    return journal;
  }

  private async approvalPolicy(
    tx: Tx,
    book: Prisma.AccountingBookGetPayload<object>,
    journal: Prisma.AccountingJournalGetPayload<{
      include: typeof journalInclude;
    }>,
  ) {
    const amount = DecimalValue.parse(
      v.totals(
        journal.lines.map((l) => ({
          debit: l.debit.toString(),
          credit: l.credit.toString(),
        })),
      ).debit,
    );
    const policies = await tx.accountingConfiguration.findMany({
      where: { bookId: book.id, kind: 'approval-policies', active: true },
    });
    const matching = policies.filter((policy) => {
      const a = v.attributes(policy.attributes);
      return (
        a.currency === book.baseCurrency &&
        a.permission === 'finance.journal.approve' &&
        amount.compare(DecimalValue.parse(String(a.minAmount))) >= 0 &&
        (!a.maxAmount ||
          amount.compare(DecimalValue.parse(String(a.maxAmount))) <= 0)
      );
    });
    if (matching.length !== 1)
      v.rule('دقیقاً یک قاعده فعال تأیید باید مبلغ و ارز این سند را پوشش دهد.');
    return matching[0]!;
  }
  private async revaluationBasis(
    tx: Tx,
    book: Prisma.AccountingBookGetPayload<object>,
    periodId: string,
    asOf: string,
  ) {
    const period = await tx.accountingPeriod.findFirst({
      where: { id: periodId, bookId: book.id, status: 'OPEN' },
    });
    if (!period || asOf < period.startDate || asOf > period.endDate)
      v.rule('تاریخ تسعیر باید در دوره باز باشد.');
    const accounts = await tx.accountingAccount.findMany({
        where: { bookId: book.id, active: true, level: 'SUBSIDIARY' },
      }),
      eligible = new Set(
        accounts
          .filter((a) => v.attributes(a.attributes).revaluable === true)
          .map((a) => a.id),
      );
    const values = await tx.$queryRaw<
      {
        accountId: string;
        detail4Id: string | null;
        detail5Id: string | null;
        detail6Id: string | null;
        currency: string | null;
        quantity: Prisma.Decimal | null;
        base: Prisma.Decimal;
      }[]
    >`
      SELECT l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",
        CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'FINAL:%' OR j."sourceKey" LIKE 'NATURE:%' OR j."sourceKey" LIKE 'REVERSE:%' OR j."sourceKey" LIKE 'WORKFLOW:%' THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END AS currency,
        SUM(CASE WHEN l.currency<>${book.baseCurrency} THEN CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE -l."foreignAmount" END ELSE 0 END) AS quantity,
        SUM(l.debit-l.credit) AS base
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE j."bookId"=${book.id}::uuid AND j."periodId"=${periodId}::uuid AND j.status='POSTED' AND j."documentDate"<=${asOf}
      GROUP BY l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'FINAL:%' OR j."sourceKey" LIKE 'NATURE:%' OR j."sourceKey" LIKE 'REVERSE:%' OR j."sourceKey" LIKE 'WORKFLOW:%' THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END`;
    const rows = values
      .filter(
        (r) =>
          eligible.has(r.accountId) &&
          r.currency &&
          r.currency !== book.baseCurrency,
      )
      .map((r) => ({
        ...r,
        currency: r.currency!,
        quantity: r.quantity?.toString() ?? '0',
        base: r.base.toString(),
      }))
      .sort((a, b) =>
        JSON.stringify([
          a.accountId,
          a.detail4Id,
          a.detail5Id,
          a.detail6Id,
          a.currency,
        ]).localeCompare(
          JSON.stringify([
            b.accountId,
            b.detail4Id,
            b.detail5Id,
            b.detail6Id,
            b.currency,
          ]),
        ),
      );
    if (rows.length > 200)
      v.rule('تسعیر هر اجرا حداکثر ۲۰۰ مانده تفصیلی را پشتیبانی می‌کند.');
    return {
      rows,
      checksum: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    };
  }
  async sourceHistory(
    bookId: string,
    query: Record<string, string>,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    const book = await this.book(this.database.client, bookId, actor);
    if (!this.finance) v.rule('منبع مالی در دسترس نیست.');
    const result = await this.finance.history(query, {
      ...actor,
      branchIds: [book.branchId],
    });
    const journals = await this.database.client.accountingJournal.findMany({
      where: {
        bookId,
        sourceKey: { in: result.items.map((i) => `${i.source}:${i.id}`) },
      },
      select: { id: true, sourceKey: true, status: true, number: true },
    });
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        accounting:
          journals.find((j) => j.sourceKey === `${item.source}:${item.id}`) ??
          null,
      })),
    };
  }
  async journalEvents(
    bookId: string,
    journalId: string,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    await this.book(this.database.client, bookId, actor);
    const journal = await this.database.client.accountingJournal.findFirst({
      where: { id: v.uuid(journalId)!, bookId },
      select: { id: true, status: true },
    });
    if (!journal) throw new NotFoundException();
    const events =
      await this.database.client.accountingJournalStateEvent.findMany({
        where: { bookId, journalId },
        orderBy: [
          { occurredAt: 'asc' },
          { commandId: 'asc' },
          { sequence: 'asc' },
        ],
      });
    const names = new Map(
      (
        await this.identity.displayNames(
          events.map((event) => event.actorId),
          actor.branchIds,
        )
      ).map((user) => [user.id, user.displayName]),
    );
    return {
      events: events.map((event) => ({
        ...event,
        actorName: names.get(event.actorId) ?? null,
      })),
      historicalGap:
        journal.status === 'CANCELLED' &&
        !events.some((event) => event.toStatus === 'CANCELLED'),
    };
  }
  private async reportPeriod(
    tx: Tx,
    bookId: string,
    query: Record<string, string>,
  ) {
    const reference = query.to
      ? v.date(query.to)!
      : query.from
        ? v.date(query.from)!
        : new Date().toISOString().slice(0, 10);
    const period = query.periodId
      ? await tx.accountingPeriod.findFirst({
          where: { id: v.uuid(query.periodId)!, bookId },
        })
      : await tx.accountingPeriod.findFirst({
          where: {
            bookId,
            startDate: { lte: reference },
            endDate: { gte: reference },
          },
        });
    const selected =
      period ??
      (!query.periodId
        ? await tx.accountingPeriod.findFirst({
            where: { bookId },
            orderBy: { startDate: 'desc' },
          })
        : null);
    if (!selected) v.rule('دوره مالی گزارش را انتخاب کنید.');
    const from = query.from ? v.date(query.from)! : selected.startDate,
      to = query.to ? v.date(query.to)! : selected.endDate;
    if (from > to || from < selected.startDate || to > selected.endDate)
      v.rule('بازه گزارش باید داخل یک دوره مالی باشد.');
    return { period: selected, from, to };
  }
  async turnover(
    bookId: string,
    query: Record<string, string>,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    return this.database.client.$transaction(
      async (tx) => {
        await this.book(tx, bookId, actor);
        const accountId = v.uuid(query.accountId)!;
        if (
          !(await tx.accountingAccount.findFirst({
            where: { id: accountId, bookId },
          }))
        )
          throw new NotFoundException();
        const { period, from, to } = await this.reportPeriod(tx, bookId, query);
        const page = Number(query.page ?? 1);
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
          v.invalid('صفحه معتبر نیست.');
        const detailFilter: Prisma.AccountingJournalLineWhereInput = {};
        for (const n of [4, 5, 6] as const)
          if (query[`detail${n}Id`])
            detailFilter[`detail${n}Id`] = v.uuid(query[`detail${n}Id`])!;
        const base = {
          accountId,
          ...detailFilter,
          journal: { bookId, periodId: period.id, status: 'POSTED' },
        };
        const where = {
          ...base,
          journal: {
            ...base.journal,
            documentDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          },
        };
        const aggregate = async (
          filter: Prisma.AccountingJournalLineWhereInput,
        ) => {
          const sum = await tx.accountingJournalLine.aggregate({
            where: filter,
            _sum: { debit: true, credit: true },
          });
          return DecimalValue.parse(sum._sum.debit?.toString() ?? '0').subtract(
            DecimalValue.parse(sum._sum.credit?.toString() ?? '0'),
          );
        };
        const opening = from
          ? await aggregate({
              ...base,
              journal: { ...base.journal, documentDate: { lt: from } },
            })
          : DecimalValue.zero();
        // Prefix aggregation maintains exact running balances across pages without loading all rows.
        const rows = await tx.accountingJournalLine.findMany({
          where,
          include: { journal: true },
          orderBy: [
            { journal: { documentDate: 'asc' } },
            { journalId: 'asc' },
            { position: 'asc' },
          ],
          skip: (page - 1) * 30,
          take: 30,
        });
        let balance = opening;
        if (rows[0] && page > 1) {
          const first = rows[0];
          balance = opening.add(
            await aggregate({
              ...where,
              OR: [
                {
                  journal: {
                    ...where.journal,
                    documentDate: {
                      ...(from ? { gte: from } : {}),
                      lt: first.journal.documentDate!,
                    },
                  },
                },
                {
                  journal: {
                    ...where.journal,
                    documentDate: first.journal.documentDate!,
                  },
                  journalId: { lt: first.journalId },
                },
                {
                  journalId: first.journalId,
                  position: { lt: first.position },
                },
              ],
            }),
          );
        }
        const mapped = rows.map((row) => {
          balance = balance
            .add(DecimalValue.parse(row.debit.toString()))
            .subtract(DecimalValue.parse(row.credit.toString()));
          return {
            journalId: row.journalId,
            number: row.journal.number!,
            date: row.journal.documentDate!,
            description: row.description || row.journal.description,
            debit: row.debit.toString(),
            credit: row.credit.toString(),
            balance: balance.toString(),
          };
        });
        return {
          opening: opening.toString(),
          closing: opening.add(await aggregate(where)).toString(),
          page,
          total: await tx.accountingJournalLine.count({ where }),
          rows: mapped,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  private async reportData(
    tx: Tx,
    bookId: string,
    query: Record<string, string>,
  ) {
    const { period, from, to } = await this.reportPeriod(tx, bookId, query);
    const groupId = v.uuid(query.groupId, true),
      group = groupId
        ? await tx.accountingAccountGroup.findFirst({
            where: { id: groupId, bookId },
            include: { members: true },
          })
        : null;
    if (groupId && !group) throw new NotFoundException();
    const groupMembers = group
      ? new Set(group.members.map((member) => member.accountId))
      : null;
    const accounts = await tx.accountingAccount.findMany({
      where: {
        bookId,
        ...(query.activeOnly === 'true' ? { active: true } : {}),
      },
      orderBy: { code: 'asc' },
    });
    const journal = {
      bookId,
      status: 'POSTED',
      periodId: period.id,
      ...(query.typeId ? { typeId: v.uuid(query.typeId)! } : {}),
    };
    const detailFilter: Prisma.AccountingJournalLineWhereInput = {};
    for (const n of [4, 5, 6] as const)
      if (query[`detail${n}Id`])
        detailFilter[`detail${n}Id`] = v.uuid(query[`detail${n}Id`])!;
    const aggregate = async (dateFilter: Prisma.StringNullableFilter) =>
      tx.accountingJournalLine.groupBy({
        by: ['accountId'],
        where: {
          ...detailFilter,
          journal: { ...journal, documentDate: dateFilter },
        },
        _sum: { debit: true, credit: true },
      });
    const [openingRows, currentRows] = await Promise.all([
      from ? aggregate({ lt: from }) : Promise.resolve([]),
      aggregate({
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      }),
    ]);
    const map = new Map(
      accounts.map((a) => [
        a.id,
        {
          accountId: a.id,
          code: a.code,
          title: a.title,
          level: a.level,
          opening: DecimalValue.zero(),
          debit: DecimalValue.zero(),
          credit: DecimalValue.zero(),
        },
      ]),
    );
    for (const row of openingRows) {
      const a = row.accountId ? map.get(row.accountId) : null;
      if (a)
        a.opening = DecimalValue.parse(
          row._sum.debit?.toString() ?? '0',
        ).subtract(DecimalValue.parse(row._sum.credit?.toString() ?? '0'));
    }
    let debit = DecimalValue.zero(),
      credit = DecimalValue.zero();
    for (const row of currentRows) {
      const a = row.accountId ? map.get(row.accountId) : null;
      if (a) {
        a.debit = DecimalValue.parse(row._sum.debit?.toString() ?? '0');
        a.credit = DecimalValue.parse(row._sum.credit?.toString() ?? '0');
        debit = debit.add(a.debit);
        credit = credit.add(a.credit);
      }
    }
    // Aggregate each adjacent chart level exactly once; totals count only posting leaves.
    for (const level of ['SUBSIDIARY', 'GENERAL'])
      for (const account of accounts.filter((a) => a.level === level)) {
        const own = map.get(account.id),
          parent = account.parentId ? map.get(account.parentId) : null;
        if (own && parent) {
          parent.opening = parent.opening.add(own.opening);
          parent.debit = parent.debit.add(own.debit);
          parent.credit = parent.credit.add(own.credit);
        }
      }
    const rows = [...map.values()]
      .filter((a) =>
        query.level ? a.level === query.level : a.level === 'SUBSIDIARY',
      )
      .filter((account) => !groupMembers || groupMembers.has(account.accountId))
      .map((a) => ({
        accountId: a.accountId,
        code: a.code,
        title: a.title,
        opening: a.opening.toString(),
        debit: a.debit.toString(),
        credit: a.credit.toString(),
        balance: a.opening.add(a.debit).subtract(a.credit).toString(),
      }));
    const selectedDebit = rows.reduce(
        (sum, row) => sum.add(DecimalValue.parse(row.debit)),
        DecimalValue.zero(),
      ),
      selectedCredit = rows.reduce(
        (sum, row) => sum.add(DecimalValue.parse(row.credit)),
        DecimalValue.zero(),
      );
    return {
      generatedAt: new Date().toISOString(),
      rows,
      debit: (groupMembers ? selectedDebit : debit).toString(),
      credit: (groupMembers ? selectedCredit : credit).toString(),
    };
  }
  async analyticalReport(
    bookId: string,
    kind: string,
    query: Record<string, string>,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    if (kind === 'document-statements') {
      await this.book(this.database.client, bookId, actor);
      const journalId = v.uuid(query.journalId, true);
      const page = Number(query.page ?? '1');
      if (!Number.isSafeInteger(page) || page < 1 || page > 200000)
        v.invalid('صفحه معتبر نیست.');
      const where: Prisma.AccountingStatementWhereInput = {
        bookId,
        ...(journalId ? { journalId } : {}),
        ...(query.id ? { id: v.uuid(query.id)! } : {}),
        ...(query.periodId ? { periodId: v.uuid(query.periodId)! } : {}),
      };
      if (query.status) {
        if (!['CREATED', 'SENT', 'CANCELLED'].includes(query.status))
          v.invalid('وضعیت اعلامیه معتبر نیست.');
        where.status = query.status;
      }
      if (query.search) {
        const search = v.text(query.search, 160, true);
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { snapshot: { path: ['recipientTitle'], string_contains: search } },
          ...(/^[1-9]\d{0,8}$/.test(search)
            ? [{ number: Number(search) }, { recipientNumber: Number(search) }]
            : []),
        ];
      }
      const rows = await this.database.client.accountingStatement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: journalId ? 101 : 50,
        skip: journalId ? 0 : (page - 1) * 50,
      });
      if (rows.length > 100)
        v.rule(
          'بیش از صد اعلامیه برای این سند موجود است؛ شناسه اعلامیه را مشخص کنید.',
        );
      const names = await this.identity.displayNames(
        rows.flatMap((row) => [
          row.makerId,
          ...(row.lastModifierId ? [row.lastModifierId] : []),
        ]),
        actor.branchIds,
      );
      return {
        page,
        pageSize: journalId ? 100 : 50,
        total: await this.database.client.accountingStatement.count({ where }),
        items: rows.map((row) => ({
          ...row,
          makerName:
            names.find((user) => user.id === row.makerId)?.displayName ?? null,
          lastModifierName:
            names.find((user) => user.id === row.lastModifierId)?.displayName ??
            null,
        })),
      };
    }
    if (kind === 'general-document-list') {
      const exporting = query.export === 'true';
      if (exporting) this.require(actor, 'finance.export');
      return this.database.client.$transaction(
        async (tx) => {
          await this.book(tx, bookId, actor);
          const page = exporting ? 1 : Number(query.page ?? 1),
            pageSize = exporting ? 10000 : Number(query.pageSize ?? 50);
          if (
            !Number.isSafeInteger(page) ||
            page < 1 ||
            page > 200000 ||
            !Number.isSafeInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > (exporting ? 10000 : 100)
          )
            v.invalid('صفحه فهرست معتبر نیست.');
          let filter: unknown = { type: 'group', mode: 'all', children: [] };
          if (query.filter) {
            if (query.filter.length > 20000)
              v.invalid('فیلتر بیش از حد بزرگ است.');
            try {
              filter = JSON.parse(query.filter);
            } catch {
              v.invalid('فیلتر معتبر نیست.');
            }
          }
          const predicates = [
            Prisma.sql`j."bookId"=${bookId}::uuid`,
            documentSqlFilter(filter, 'general'),
          ];
          if (query.periodId)
            predicates.push(
              Prisma.sql`j."periodId"=${v.uuid(query.periodId)}::uuid`,
            );
          const where = Prisma.join(
            predicates.map((part) => Prisma.sql`(${part})`),
            ' AND ',
          );
          const orders: Record<string, string> = {
            number: 'j.number',
            documentDate: 'j."documentDate"',
            amount: 'amount',
            makerId: 'j."makerId"',
          };
          const order = orders[query.sort ?? 'number'];
          if (!Object.hasOwn(orders, query.sort ?? 'number') || !order)
            v.invalid('ستون مرتب‌سازی معتبر نیست.');
          const groupBy = query.groupBy || null;
          if (groupBy && !Object.hasOwn(orders, groupBy))
            v.invalid('ستون گروه‌بندی معتبر نیست.');
          const groupingOrder = groupBy
            ? Prisma.sql`${Prisma.raw(orders[groupBy]!)} ASC,`
            : Prisma.empty;
          const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
          const [count, rows] = await Promise.all([
            tx.$queryRaw<{ total: bigint }[]>(
              Prisma.sql`SELECT COUNT(*) AS total FROM accounting_general_documents j WHERE ${where}`,
            ),
            tx.$queryRaw<
              {
                id: string;
                number: number;
                documentDate: string;
                makerId: string;
                version: number;
                amount: Prisma.Decimal;
              }[]
            >(
              Prisma.sql`SELECT j.id,j.number,j."documentDate",j."makerId",j.version,(SELECT COALESCE(SUM(a.debit),0) FROM accounting_general_document_lines a WHERE a."documentId"=j.id) AS amount FROM accounting_general_documents j WHERE ${where} ORDER BY ${groupingOrder} ${Prisma.raw(order)} ${Prisma.raw(direction)},j.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            ),
          ]);
          if (exporting && Number(count[0]?.total ?? 0) > 10000)
            v.rule('برای خروجی، فیلتر را به حداکثر ۱۰۰۰۰ سند کل محدود کنید.');
          const names = await this.identity.displayNames(
            [...new Set(rows.map((row) => row.makerId))],
            actor.branchIds,
          );
          const groups = groupBy
            ? await tx.$queryRaw<
                { key: string; count: bigint; amount: Prisma.Decimal }[]
              >(Prisma.sql`
            WITH grouped_source AS (SELECT j.number,j."documentDate",j."makerId",
              (SELECT COALESCE(SUM(a.debit),0) FROM accounting_general_document_lines a WHERE a."documentId"=j.id) AS amount
              FROM accounting_general_documents j WHERE ${where})
            SELECT ${Prisma.raw(groupBy === 'amount' || groupBy === 'number' ? groupBy : `"${groupBy}"`)}::text AS key,COUNT(*) AS count,SUM(amount) AS amount
              FROM grouped_source GROUP BY ${Prisma.raw(groupBy === 'amount' || groupBy === 'number' ? groupBy : `"${groupBy}"`)}
              ORDER BY ${Prisma.raw(groupBy === 'amount' || groupBy === 'number' ? groupBy : `"${groupBy}"`)} LIMIT 1001`)
            : [];
          if (groups.length > 1000)
            v.rule('فیلتر گروه‌بندی را به حداکثر ۱۰۰۰ گروه محدود کنید.');
          return {
            page,
            pageSize,
            total: Number(count[0]?.total ?? 0),
            groupBy,
            groups: groups.map((group) => ({
              key:
                groupBy === 'amount'
                  ? DecimalValue.parse(group.key).toString()
                  : group.key,
              count: Number(group.count),
              amount: group.amount.toString(),
            })),
            rows: rows.map((row) => ({
              ...row,
              amount: row.amount.toString(),
              makerName:
                names.find((name) => name.id === row.makerId)?.displayName ??
                row.makerId,
            })),
          };
        },
        { isolationLevel: 'RepeatableRead' },
      );
    }
    if (kind === 'document-revaluation-currencies') {
      const book = await this.book(this.database.client, bookId, actor);
      const [currencies, values] = await Promise.all([
        accountingCurrencies(this.master),
        this.database.client.$queryRaw<{ value: string }[]>(Prisma.sql`
        SELECT DISTINCT l.currency AS value FROM accounting_journal_lines l
        JOIN accounting_journals j ON j.id=l."journalId"
        WHERE j."bookId"=${bookId}::uuid AND ${documentFigureStatuses}
          AND l.currency<>${book.baseCurrency}
        ORDER BY l.currency`),
      ]);
      const eligible = new Set(values.map((row) => row.value));
      return currencies
        .filter((currency) => eligible.has(currency.code))
        .map((currency) => ({ value: currency.code, label: currency.name }));
    }
    if (kind === 'document-filter-options') {
      const book = await this.book(this.database.client, bookId, actor);
      const [users, branches] = await Promise.all([
        this.identity.candidates(book.branchId),
        this.identity.branches([book.branchId]),
      ]);
      return {
        actors: users.map((user) => ({
          value: user.id,
          label: user.displayName,
        })),
        branches: branches.map((branch) => ({
          value: branch.id,
          label: branch.name,
          code: branch.code,
        })),
      };
    }
    if (kind === 'document-posting-context') {
      this.require(actor, 'finance.journal.post');
      return this.database.client.$transaction(
        async (tx) => {
          const book = await this.book(tx, bookId, actor);
          const interval = await documentPostingInterval(tx, book, query);
          return { fromDate: interval.fromDate, toDate: interval.toDate };
        },
        { isolationLevel: 'RepeatableRead' },
      );
    }
    if (kind === 'document-turnover' || kind === 'document-fx-balance')
      return this.database.client.$transaction(
        async (tx) => {
          const book = await this.book(tx, bookId, actor);
          return documentFigures(tx, book, kind, query);
        },
        { isolationLevel: 'RepeatableRead' },
      );
    if (
      ![
        'dormant',
        'nature-conflict-period',
        'nature-conflict-running',
        'comparative',
      ].includes(kind)
    )
      v.invalid('گزارش تحلیلی ناشناخته است.');
    return this.database.client.$transaction(
      async (tx) => {
        await this.book(tx, bookId, actor);
        const page = Number(query.page ?? 1),
          pageSize = 50;
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
          v.invalid('صفحه معتبر نیست.');
        const paged = <T>(rows: T[]) => ({
          page,
          pageSize,
          total: rows.length,
          rows: rows.slice((page - 1) * pageSize, page * pageSize),
        });
        if (kind === 'comparative') {
          const left = await this.reportData(tx, bookId, {
            periodId: query.leftPeriodId ?? '',
            from: query.leftFrom ?? '',
            to: query.leftTo ?? '',
            activeOnly: query.activeOnly ?? '',
            groupId: query.groupId ?? '',
          });
          const right = await this.reportData(tx, bookId, {
            periodId: query.rightPeriodId ?? '',
            from: query.rightFrom ?? '',
            to: query.rightTo ?? '',
            activeOnly: query.activeOnly ?? '',
            groupId: query.groupId ?? '',
          });
          const ids = new Set([
            ...left.rows.map((row) => row.accountId),
            ...right.rows.map((row) => row.accountId),
          ]);
          const rows = [...ids]
            .map((accountId) => {
              const l = left.rows.find((row) => row.accountId === accountId),
                r = right.rows.find((row) => row.accountId === accountId),
                zero = {
                  accountId,
                  code: r?.code ?? l?.code ?? '',
                  title: r?.title ?? l?.title ?? '',
                  opening: '0',
                  debit: '0',
                  credit: '0',
                  balance: '0',
                },
                lv = l ?? zero,
                rv = r ?? zero;
              return {
                accountId,
                code: lv.code || rv.code,
                title: lv.title || rv.title,
                left: lv,
                right: rv,
                difference: {
                  opening: DecimalValue.parse(rv.opening)
                    .subtract(DecimalValue.parse(lv.opening))
                    .toString(),
                  debit: DecimalValue.parse(rv.debit)
                    .subtract(DecimalValue.parse(lv.debit))
                    .toString(),
                  credit: DecimalValue.parse(rv.credit)
                    .subtract(DecimalValue.parse(lv.credit))
                    .toString(),
                  balance: DecimalValue.parse(rv.balance)
                    .subtract(DecimalValue.parse(lv.balance))
                    .toString(),
                },
              };
            })
            .sort(
              (a, b) =>
                a.code.localeCompare(b.code) ||
                a.accountId.localeCompare(b.accountId),
            );
          return { generatedAt: new Date().toISOString(), ...paged(rows) };
        }
        const { period, from, to } = await this.reportPeriod(tx, bookId, query);
        const groupId = v.uuid(query.groupId, true);
        const group = groupId
          ? await tx.accountingAccountGroup.findFirst({
              where: { id: groupId, bookId },
              include: { members: true },
            })
          : null;
        if (groupId && !group) throw new NotFoundException();
        const memberIds = group?.members.map((member) => member.accountId);
        const accounts = await tx.accountingAccount.findMany({
          where: {
            bookId,
            level: 'SUBSIDIARY',
            ...(query.activeOnly === 'true' ? { active: true } : {}),
            ...(memberIds ? { id: { in: memberIds } } : {}),
          },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
        });
        if (kind === 'dormant') {
          const activeRows = await tx.accountingJournalLine.groupBy({
            by: ['accountId'],
            where: {
              accountId: { in: accounts.map((account) => account.id) },
              journal: {
                bookId,
                periodId: period.id,
                status: 'POSTED',
                documentDate: { gte: from, lte: to },
              },
            },
            _count: true,
          });
          const activeIds = new Set(activeRows.map((row) => row.accountId));
          const all = accounts.filter((account) => !activeIds.has(account.id));
          return {
            generatedAt: new Date().toISOString(),
            definition: 'حساب معین بدون هیچ ردیف سند قطعی در بازه انتخاب‌شده',
            ...paged(all),
          };
        }
        if (kind === 'nature-conflict-period') {
          const sums = await tx.accountingJournalLine.groupBy({
            by: ['accountId'],
            where: {
              accountId: { in: accounts.map((account) => account.id) },
              journal: {
                bookId,
                periodId: period.id,
                status: 'POSTED',
                documentDate: { lte: to },
              },
            },
            _sum: { debit: true, credit: true },
          });
          const balances = new Map(
            sums.map((row) => [
              row.accountId,
              DecimalValue.parse(row._sum.debit?.toString() ?? '0').subtract(
                DecimalValue.parse(row._sum.credit?.toString() ?? '0'),
              ),
            ]),
          );
          const rows = accounts
            .filter((account) => {
              const balance = balances.get(account.id) ?? DecimalValue.zero();
              return (
                account.nature !== 'ANY' &&
                !balance.isZero &&
                (account.nature === 'DEBIT'
                  ? balance.isNegative
                  : !balance.isNegative)
              );
            })
            .map((account) => ({
              ...account,
              balance: (
                balances.get(account.id) ?? DecimalValue.zero()
              ).toString(),
            }));
          return {
            generatedAt: new Date().toISOString(),
            definition: 'مانده پایان بازه با ماهیت تعریف‌شده حساب ناسازگار است',
            ...paged(rows),
          };
        }
        const running = await tx.$queryRaw<
          {
            accountId: string;
            firstConflictDate: string;
            balance: Prisma.Decimal;
          }[]
        >`
          WITH per_journal AS (
            SELECT l."accountId", j.id AS "journalId", j."documentDate", j.number,
              SUM(l.debit-l.credit) AS movement
            FROM accounting_journal_lines l
            JOIN accounting_journals j ON j.id=l."journalId"
            WHERE j."bookId"=${bookId}::uuid AND j."periodId"=${period.id}::uuid
              AND j.status='POSTED' AND j."documentDate"<=${to}
            GROUP BY l."accountId",j.id,j."documentDate",j.number
          ), running AS (
            SELECT p.*, SUM(p.movement) OVER (
              PARTITION BY p."accountId"
              ORDER BY p."documentDate",p.number,p."journalId"
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS balance
            FROM per_journal p
          ), conflicts AS (
            SELECT r.*, ROW_NUMBER() OVER (
              PARTITION BY r."accountId" ORDER BY r."documentDate",r.number,r."journalId"
            ) AS occurrence
            FROM running r JOIN accounting_accounts a ON a.id=r."accountId"
            WHERE r."documentDate">=${from} AND r.balance<>0
              AND ((a.nature='DEBIT' AND r.balance<0) OR (a.nature='CREDIT' AND r.balance>0))
          )
          SELECT "accountId","documentDate" AS "firstConflictDate",balance
          FROM conflicts WHERE occurrence=1 ORDER BY "firstConflictDate","accountId"`;
        const byId = new Map(accounts.map((account) => [account.id, account]));
        const rows = running
          .filter((row) => byId.has(row.accountId))
          .map((row) => ({
            ...byId.get(row.accountId)!,
            firstConflictDate: row.firstConflictDate,
            balance: row.balance.toString(),
          }));
        return {
          generatedAt: new Date().toISOString(),
          definition:
            'اولین مانده جاری ناسازگار پس از هر سند قطعی با مانده ابتدای دوره',
          ...paged(rows),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async report(
    bookId: string,
    query: Record<string, string>,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    return this.database.client.$transaction(
      async (tx) => {
        await this.book(tx, bookId, actor);
        return this.reportData(tx, bookId, query);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
