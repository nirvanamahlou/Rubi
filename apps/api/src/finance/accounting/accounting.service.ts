import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '@nora/database';
import type {
  AccountingCommandV1,
  AuthenticatedActor,
  IamPermissionCode,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';
import { allocationTargets, allocateAmount } from './accounting.allocation';
import { FinanceInboxService } from '../finance-inbox.service';

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
const accountRules = (value: unknown) => {
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
    ...Object.fromEntries(
      [4, 5, 6].map((n) => [
        `detail${n}TypeId`,
        attrs[`detail${n}TypeId`] || '',
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
          existing.baseCurrency !== baseCurrency
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
            where: { bookId: id },
            orderBy: { code: 'asc' },
          }),
          tx.accountingFxSnapshot.findMany({
            where: { bookId: id },
            orderBy: { validFrom: 'desc' },
          }),
          tx.accountingAccountGroup.findMany({
            where: { bookId: id },
            include: { members: { orderBy: { accountId: 'asc' } } },
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
          templates,
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
    const page = Math.max(1, Number(query.page) || 1),
      pageSize = 30;
    if (!Number.isSafeInteger(page) || page > 100000)
      v.invalid('شماره صفحه معتبر نیست.');
    const where: Prisma.AccountingJournalWhereInput = {
      bookId,
      ...(query.id ? { id: v.uuid(query.id)! } : {}),
      ...(query.periodId ? { periodId: v.uuid(query.periodId)! } : {}),
      ...(query.status ? { status: query.status } : {}),
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
    const pageResult = await this.database.client.$transaction(
      async (tx) => ({
        items: await tx.accountingJournal.findMany({
          where,
          include: journalInclude,
          orderBy: [
            { documentDate: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        total: await tx.accountingJournal.count({ where }),
        page,
        pageSize,
      }),
      { isolationLevel: 'RepeatableRead' },
    );
    const names = new Map(
      (
        await this.identity.displayNames(
          pageResult.items.map((item) => item.makerId),
          actor.branchIds,
        )
      ).map((user) => [user.id, user.displayName]),
    );
    return {
      ...pageResult,
      items: pageResult.items.map((item) => ({
        ...item,
        makerName: names.get(item.makerId) ?? null,
      })),
    };
  }
  async command(
    bookId: string,
    action: string,
    body: unknown,
    actor: AuthenticatedActor,
  ) {
    const permission: IamPermissionCode =
      action === 'export-batch'
        ? 'finance.export'
        : action === 'approve' || action === 'approve-fx'
          ? 'finance.journal.approve'
          : action === 'post'
            ? 'finance.journal.post'
            : action === 'reverse'
              ? 'finance.journal.reverse'
              : [
                    'close-period',
                    'year-end-closing',
                    'year-end-opening',
                    'year-end-preview',
                  ].includes(action)
                ? 'finance.period.close'
                : [
                      'source-journal',
                      'allocation-run',
                      'allocation-preview',
                      'revaluation-preview',
                      'revaluation-run',
                      'number-drafts',
                      'move-drafts',
                    ].includes(action) ||
                    action.startsWith('journal') ||
                    ['submit', 'return', 'cancel', 'restore'].includes(action)
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
  ): Promise<unknown> {
    const bookId = book.id;
    if (
      ['year-end-preview', 'year-end-closing', 'year-end-opening'].includes(
        action,
      )
    ) {
      const periodId = v.uuid(p.periodId)!,
        period = await tx.accountingPeriod.findFirst({
          where: { id: periodId, bookId },
        });
      if (!period) throw new NotFoundException();
      const closingTemplateId =
        action === 'year-end-closing' ? v.uuid(p.templateId, true) : null;
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
        if (closingTemplate.lines.length)
          v.rule(
            'اجرای الگوی بستن دارای ردیف انتخابی یا درصدی هنوز پشتیبانی نمی‌شود.',
          );
      }
      const sourceKey =
        action === 'year-end-opening'
          ? `OPEN:${periodId}`
          : `CLOSE:${periodId}`;
      const accounts = await tx.accountingAccount.findMany({
          where: { bookId },
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
          valuationCurrency: string | null;
          balance: Prisma.Decimal;
          foreignBalance: Prisma.Decimal | null;
        }[]
      >`
        SELECT l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",l.currency,l."fxSnapshotId",l.rate,CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' THEN l.attributes->>'valuationCurrency' ELSE NULL END AS "valuationCurrency",
          SUM(l.debit-l.credit) AS balance,
          SUM(CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE -l."foreignAmount" END) AS "foreignBalance"
        FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
        WHERE j."bookId"=${bookId}::uuid AND j."periodId"=${periodId}::uuid AND j.status='POSTED'
        GROUP BY l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",l.currency,l."fxSnapshotId",l.rate,CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' THEN l.attributes->>'valuationCurrency' ELSE NULL END`;
      const balances = lots
        .filter((r) => !DecimalValue.parse(r.balance.toString()).isZero)
        .map((r) => ({
          ...r,
          balance: r.balance.toString(),
          permanent: accountMap.get(r.accountId)?.permanent ?? true,
        }));
      if (
        lots.some(
          (r) =>
            r.balance.toString() === '0' &&
            r.foreignBalance &&
            !DecimalValue.parse(r.foreignBalance.toString()).isZero,
        )
      )
        v.rule(
          'مانده ارزی با ارزش پایه صفر باید قبل از انتقال تعیین تکلیف شود.',
        );
      const drafts = await tx.accountingJournal.count({
        where: {
          bookId,
          periodId,
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
        },
      });
      if (action === 'year-end-preview')
        return {
          period,
          unfinished: drafts,
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
      const existing = await tx.accountingJournal.findUnique({
        where: { bookId_sourceKey: { bookId, sourceKey } },
        include: journalInclude,
      });
      if (existing) return existing;
      if (drafts) v.rule('تمام اسناد دوره باید تعیین تکلیف شده باشند.');
      const hasFx = balances.some(
        (r) => r.currency && r.currency !== book.baseCurrency,
      );
      if (hasFx && p.fxCarryPolicy !== 'HISTORICAL_LOTS')
        v.rule(
          'برای انتقال ارزی، سیاست حفظ ارزش تاریخی و نرخ‌های سند مبدأ را انتخاب کنید.',
        );
      const targetDate = v.date(p.documentDate)!;
      let targetPeriodId = periodId,
        rows: Record<string, unknown>[] = [];
      if (action === 'year-end-closing') {
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
        const temp = balances.filter((r) => r.permanent === false);
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
            fxSnapshotId: r.currency ? r.fxSnapshotId : null,
            attributes: r.valuationCurrency
              ? { valuationCurrency: r.valuationCurrency }
              : {},
            rate: r.rate?.toString() ?? null,
            foreignAmount: r.foreignBalance
              ? DecimalValue.parse(r.foreignBalance.toString()).isNegative
                ? DecimalValue.zero()
                    .subtract(DecimalValue.parse(r.foreignBalance.toString()))
                    .toString()
                : r.foreignBalance.toString()
              : null,
            debit: value.isNegative
              ? DecimalValue.zero().subtract(value).toString()
              : '0',
            credit: value.isNegative ? '0' : value.toString(),
          };
        });
        if (!net.isZero)
          rows.push({
            accountId: retainedId,
            debit: net.isNegative ? '0' : net.toString(),
            credit: net.isNegative
              ? DecimalValue.zero().subtract(net).toString()
              : '0',
          });
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
        targetPeriodId = nextId;
        rows = balances.map((r) => {
          const value = DecimalValue.parse(r.balance);
          return {
            accountId: r.accountId,
            detail4Id: r.detail4Id,
            detail5Id: r.detail5Id,
            detail6Id: r.detail6Id,
            currency: r.currency,
            fxSnapshotId: r.currency ? r.fxSnapshotId : null,
            attributes: r.valuationCurrency
              ? { valuationCurrency: r.valuationCurrency }
              : {},
            rate: r.rate?.toString() ?? null,
            foreignAmount: r.foreignBalance
              ? DecimalValue.parse(r.foreignBalance.toString()).isNegative
                ? DecimalValue.zero()
                    .subtract(DecimalValue.parse(r.foreignBalance.toString()))
                    .toString()
                : r.foreignBalance.toString()
              : null,
            debit: value.isNegative ? '0' : value.toString(),
            credit: value.isNegative
              ? DecimalValue.zero().subtract(value).toString()
              : '0',
          };
        });
        if (!rows.length) v.rule('مانده‌ای برای انتقال وجود ندارد.');
      }
      const result = (await this.execute(
        tx,
        book,
        'journal-save',
        {
          periodId: targetPeriodId,
          typeId: closingTemplate?.voucherTypeId ?? p.typeId,
          documentDate: targetDate,
          description:
            action === 'year-end-opening'
              ? 'افتتاحیه دوره عملیاتی'
              : 'بستن حساب‌های موقت',
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
            sourcePeriodId: periodId,
            operation: action,
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
          description: v.text(p.reason, 2000, true),
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
        const length = Number(attributes.classificationNumberLength);
        if (!Number.isInteger(length) || length < 1 || length > 20)
          v.invalid('طول شماره طبقه‌بندی باید بین ۱ و ۲۰ باشد.');
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
          JSON.stringify(canonical(attributes)) !==
            JSON.stringify(canonical(existing.attributes))
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
        v.text(attributes.reason, 2000, true);
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
        !['DEBIT', 'CREDIT'].includes(nature)
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
            JSON.stringify(canonical(accountRules(p.attributes))) !==
              JSON.stringify(canonical(accountRules(existing.attributes))))
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
      const memberIds = rawMembers.map((member) => v.uuid(member)!);
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
        bookId,
        code: v.text(p.code, 40, true),
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
        description: v.text(p.description, 2000) || null,
        active: p.active !== false,
      };
      if (accountGroup) {
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
          return tx.accountingAccountGroup.findUniqueOrThrow({
            where: { id },
            include: { members: { orderBy: { accountId: 'asc' } } },
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
        return tx.accountingAccountGroup.findUniqueOrThrow({
          where: { id },
          include: { members: { orderBy: { accountId: 'asc' } } },
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
      }[];
      for (const [position, raw] of p.lines.entries()) {
        const line = v.object(raw),
          accountId = v.uuid(line.accountId)!,
          detail4Id = v.uuid(line.detail4Id, true),
          detail5Id = v.uuid(line.detail5Id, true),
          detail6Id = v.uuid(line.detail6Id, true),
          side = v.text(line.side, 8, true),
          percentage = v.decimal(line.percentage)!;
        if (!['DEBIT', 'CREDIT'].includes(side))
          v.invalid('ماهیت ردیف الگو معتبر نیست.');
        if (
          DecimalValue.parse(percentage).isZero ||
          DecimalValue.parse(percentage).compare(DecimalValue.parse('100')) > 0
        )
          v.invalid('درصد ردیف الگو باید بیشتر از صفر و حداکثر صد باشد.');
        if (
          !(await tx.accountingAccount.findFirst({
            where: { id: accountId, bookId, active: true },
          }))
        )
          v.rule('حساب ردیف الگو معتبر نیست.');
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
        });
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
        return tx.accountingTemplate.findUniqueOrThrow({
          where: { id },
          include: { lines: { orderBy: { position: 'asc' } } },
        });
      }
      await tx.accountingTemplate.create({ data: { id, ...data } });
      if (lines.length)
        await tx.accountingTemplateLine.createMany({
          data: lines.map((line) => ({ ...line, templateId: id })),
        });
      return tx.accountingTemplate.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    }
    if (action === 'automatic-run')
      v.rule(
        'اجرای الگوی سند اتوماتیک تا تعریف قرارداد محاسبه پشتیبانی نمی‌شود.',
      );
    if (action === 'journal-save') {
      const id = v.uuid(p.id, true) ?? randomUUID();
      const existing = await tx.accountingJournal.findFirst({
        where: { id, bookId },
        include: journalInclude,
      });
      if (existing) {
        this.version(existing.version, expected);
        if (existing.status !== 'DRAFT')
          v.rule('فقط پیش‌نویس قابل ویرایش است.');
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
            /^(REVALUE|OPEN|CLOSE|REVERSE):/.test(existing.sourceKey) &&
            [4, 5, 6].some(
              (n) =>
                row[`detail${n}Id` as 'detail4Id'] !==
                old[`detail${n}Id` as 'detail4Id'],
            )
          )
            v.rule('تفصیلی‌های سند محاسباتی باید با مبنا یکسان بمانند.');
        }
      }

      if (existing?.sourceKey) {
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
              (row.fxSnapshotId ?? null) === old.fxSnapshotId
            );
          });
        if (!unchanged)
          v.rule('مبالغ و حساب‌های سند مبدأ فقط از جریان اصلی اصلاح می‌شوند.');
      }

      const periodId = v.uuid(p.periodId, true),
        typeId = v.uuid(p.typeId, true),
        documentDate = v.date(p.documentDate, true);
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
      await this.references(tx, bookId, rows);
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
          existing.number !== null ||
          existing.sourceKey ||
          existing.reversalOfId ||
          existingAttributes.operation !== undefined ||
          existingAttributes.templateId !== undefined ||
          existingAttributes.sourceRequestId !== undefined
        )
          v.rule('سند شماره‌دار، مبدأدار یا برگشتی قابل جابه‌جایی نیست.');
        if (
          existing.makerId !== actor.userId &&
          !actor.permissions.includes('finance.journal.approve')
        )
          throw new ForbiddenException();
      }
      const submittedAttributes = v.journalAttributes(p.attributes, internal);
      const data = {
        periodId,
        typeId,
        documentDate,
        description: v.text(p.description, 2000),
        reference: v.text(p.reference, 160) || null,
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
        reason = v.text(p.reason, 2000, true),
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
        const restored = await tx.accountingJournal.update({
          where: { id },
          data: {
            status: 'DRAFT',
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
            description: v.text(p.reason, 2000, true),
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
          reason: v.text(p.reason, 2000, true),
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
    if (journal.sourceKey?.startsWith('REVALUE:')) {
      const attrs = v.attributes(journal.attributes),
        basis = await this.revaluationBasis(
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
    if (journal.description.trim().length < 3 || journal.lines.length < 2)
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
        !checkedNature.has(account.id) &&
        ['WARN', 'BLOCK'].includes(String(accountAttrs.natureControl))
      ) {
        checkedNature.add(account.id);
        const sums = await tx.accountingJournalLine.aggregate({
          where: {
            accountId: account.id,
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
          .filter((r) => r.accountId === account.id)
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
              detail.typeId !== attrs[`detail${n}TypeId`])
          )
            v.rule('تفصیلی با قواعد حساب سازگار نیست.');
        }
      }
      if (
        row.fxSnapshotId &&
        (!row.currency || row.currency === book.baseCurrency)
      ) {
        if (
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
          (!journal.reversalOfId &&
            (fx.validFrom > new Date() || fx.validTo < new Date()))
        )
          v.rule('نرخ تسعیر دیگر معتبر نیست.');
      }
      if (row.currency && row.currency !== book.baseCurrency) {
        const historicalCarry =
          !!journal.sourceKey &&
          /^(OPEN|CLOSE|REVERSE):/.test(journal.sourceKey) &&
          (v.attributes(journal.attributes).fxCarryPolicy ===
            'HISTORICAL_LOTS' ||
            !!journal.reversalOfId);
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
            (fx.validFrom > new Date() || fx.validTo < new Date())) ||
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
        CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END AS currency,
        SUM(CASE WHEN l.currency<>${book.baseCurrency} THEN CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE -l."foreignAmount" END ELSE 0 END) AS quantity,
        SUM(l.debit-l.credit) AS base
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE j."bookId"=${book.id}::uuid AND j."periodId"=${periodId}::uuid AND j.status='POSTED' AND j."documentDate"<=${asOf}
      GROUP BY l."accountId",l."detail4Id",l."detail5Id",l."detail6Id",CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END`;
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
