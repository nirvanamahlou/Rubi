import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import {
  PAYROLL_INPUTS,
  EMPLOYMENT_DEFAULTS,
  EMPLOYEE_PAY_DEFAULTS,
  PAYROLL_DEFAULT_RATES,
  payrollCell,
  calculatePayroll,
  type AuthenticatedActor,
  type PayrollSnapshot,
  type PayrollWorksheet,
  type PayrollWorksheetSummary,
  type PayrollRates,
  type PayrollWorksheetStatus,
} from '@nora/contracts';
import {
  payrollWorksheetFinanceStates,
  submitPayrollWorksheet,
  assertPayrollWorksheetCanReopen,
} from '../finance/operations/payroll-worksheet.public';
import { DatabaseService } from '../database/database.service';
import { protectHrValues, revealHrValues } from './hr-private-values';
import { object, text, uuid, version } from './hr.validation';

const SECTION = 'payrollWorksheets';
type Row = Prisma.HrRecordGetPayload<null>;
const context = (row: { branchId: string; id: string }) =>
  `${row.branchId}:${row.id}:payroll-worksheet:v1`;
export function validatePayrollSnapshot(input: unknown): PayrollSnapshot {
  const data = object(input, ['rows', 'rates']);
  const rates = object(data.rates, Object.keys(PAYROLL_DEFAULT_RATES));
  for (const key of Object.keys(
    PAYROLL_DEFAULT_RATES,
  ) as (keyof PayrollRates)[]) {
    const n = rates[key];
    if (
      !Number.isInteger(n) ||
      Number(n) < (key === 'dailyMinutes' ? 1 : 0) ||
      Number(n) >
        (key === 'dailyMinutes' ? 1440 : key === 'overtime' ? 100000 : 10000)
    )
      throw new BadRequestException('ضریب حقوق معتبر نیست.');
  }
  if (!Array.isArray(data.rows) || data.rows.length > 500)
    throw new BadRequestException('حداکثر ۵۰۰ ردیف مجاز است.');
  const ids = new Set<string>();
  const rows = data.rows.map((value) => {
    const row = object(value, ['id', 'employeeId', ...PAYROLL_INPUTS]);
    const id = uuid(row.id);
    if (ids.has(id)) throw new BadRequestException('شناسه ردیف تکراری است.');
    ids.add(id);
    try {
      return {
        id,
        ...(row.employeeId ? { employeeId: uuid(row.employeeId) } : {}),
        ...Object.fromEntries(
          PAYROLL_INPUTS.map((key) => {
            if (
              row[key] === undefined &&
              [
                'children',
                'childRate',
                'overtimeHourly',
                'shortageHourly',
              ].includes(key)
            )
              return [key, key.endsWith('Hourly') ? '' : '0'];
            if (typeof row[key] !== 'string') throw new Error();
            return [key, payrollCell(key, row[key])];
          }),
        ),
      } as PayrollSnapshot['rows'][number];
    } catch {
      throw new BadRequestException('اطلاعات ردیف حقوق معتبر نیست.');
    }
  });
  return { rows, rates: rates as unknown as PayrollRates };
}

@Injectable()
export class HrPayrollWorksheetService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  private guard(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('hr.sensitive') ||
      !(write
        ? actor.permissions.includes('hr.manage')
        : actor.permissions.some((p) => ['hr.read', 'hr.manage'].includes(p)))
    )
      throw new ForbiddenException('دسترسی اطلاعات حقوق وجود ندارد.');
  }
  private scope(actor: AuthenticatedActor) {
    return {
      section: SECTION,
      tab: 'sheet',
      branchId: { in: actor.branchIds },
      deletedAt: null,
    };
  }
  private summary(
    row: Row,
    finance?: { status: PayrollWorksheetStatus; financeRequestId: string },
  ): PayrollWorksheetSummary {
    const metadata = row.data as Record<string, unknown>;
    return {
      id: row.id,
      period: (row.values as string[])[0]!,
      rowCount: Number(metadata.rowCount ?? 0),
      branchId: row.branchId,
      version: row.version,
      status:
        row.status === 'DRAFT'
          ? 'DRAFT'
          : (finance?.status ??
            (row.status === 'APPROVED'
              ? 'HR_APPROVED'
              : (row.status as PayrollWorksheetStatus))),
      ...(finance ? { financeRequestId: finance.financeRequestId } : {}),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private async snapshot(
    row: Row,
    tx: Prisma.TransactionClient,
  ): Promise<PayrollSnapshot> {
    const header = validatePayrollSnapshot(
      JSON.parse(revealHrValues(row.data, context(row))[0]!),
    );
    // Earlier compact snapshots remain readable; new writes use bounded encrypted rows.
    if (header.rows.length) return header;
    const children = await tx.hrRecord.findMany({
      where: {
        section: SECTION,
        tab: 'row',
        parentId: row.id,
        branchId: row.branchId,
        deletedAt: null,
      },
      orderBy: { code: 'asc' },
      take: 501,
    });
    if (
      children.length !==
        Number((row.data as Record<string, unknown>).rowCount ?? 0) ||
      children.length > 500
    )
      throw new ConflictException('نسخه حقوق تغییر کرده است.');
    return validatePayrollSnapshot({
      rates: header.rates,
      rows: children.map((child) =>
        JSON.parse(
          revealHrValues(child.data, `${context(row)}:${child.id}`)[0]!,
        ),
      ),
    });
  }
  private async dto(
    row: Row,
    tx: Prisma.TransactionClient,
  ): Promise<PayrollWorksheet> {
    const states = await payrollWorksheetFinanceStates(
      tx,
      [row.id],
      [row.branchId],
    );
    const { rowCount: _count, ...summary } = this.summary(
      row,
      states.get(row.id),
    );
    void _count;
    return { ...summary, ...(await this.snapshot(row, tx)) };
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    row: Row,
    action: string,
  ) {
    await tx.hrAuditEvent.create({
      data: {
        branchId: row.branchId,
        recordId: row.id,
        actorId: actor.userId,
        action,
        version: row.version,
        changes: {
          rowCount: (row.data as Record<string, unknown>).rowCount ?? 0,
        },
      },
    });
  }
  async configuration(
    branchInput: string,
    employeeInput: string,
    actor: AuthenticatedActor,
    body?: unknown,
  ) {
    this.guard(actor, body !== undefined);
    const branchId = uuid(branchInput);
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    const employeeId =
      employeeInput === 'defaults' ? null : uuid(employeeInput);
    if (
      employeeId &&
      !(await this.database.client.hrEmployee.findFirst({
        where: { id: employeeId, branchId, deletedAt: null },
      }))
    )
      throw new NotFoundException();
    const defaults = employeeId ? EMPLOYEE_PAY_DEFAULTS : EMPLOYMENT_DEFAULTS;
    const code = `PAYCFG-${employeeId ?? branchId}`;
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${code}, 0))::text`;
      let record = await tx.hrRecord.findUnique({ where: { code } });
      if (
        record &&
        (record.branchId !== branchId ||
          record.section !== SECTION ||
          record.tab !== 'configuration' ||
          record.deletedAt)
      )
        throw new ConflictException();
      if (body !== undefined) {
        const input = object(body, ['version', 'values']);
        if (input.version !== (record?.version ?? 0))
          throw new ConflictException(
            'اطلاعات تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        const values = object(input.values, Object.keys(defaults));
        const clean = Object.fromEntries(
          Object.keys(defaults).map((key) => {
            if (typeof values[key] !== 'string')
              throw new BadRequestException();
            const value =
              key === 'days' && values[key] === ''
                ? ''
                : payrollCell(
                    key as (typeof PAYROLL_INPUTS)[number],
                    values[key],
                  );
            if (key === 'children' && Number(value) > 100)
              throw new BadRequestException();
            return [key, value];
          }),
        );
        const id = record?.id ?? randomUUID();
        const data = protectHrValues(
          [JSON.stringify(clean)],
          context({ id, branchId }),
        );
        record = record
          ? await tx.hrRecord.update({
              where: { id },
              data: { data, version: { increment: 1 } },
            })
          : await tx.hrRecord.create({
              data: {
                id,
                code,
                branchId,
                employeeId,
                section: SECTION,
                tab: 'configuration',
                values: [],
                data,
              },
            });
        await this.audit(tx, actor, record, 'payroll.configuration.update');
      }
      if (record)
        await this.audit(tx, actor, record, 'payroll.configuration.read');
      return {
        version: record?.version ?? 0,
        values: record
          ? {
              ...defaults,
              ...JSON.parse(revealHrValues(record.data, context(record))[0]!),
            }
          : defaults,
      };
    });
  }
  async list(actor: AuthenticatedActor) {
    this.guard(actor);
    const rows = await this.database.client.hrRecord.findMany({
      where: this.scope(actor),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 1001,
    });
    if (rows.length > 1000)
      throw new BadRequestException('تعداد دوره‌ها بیش از حد مجاز است.');
    const states = await payrollWorksheetFinanceStates(
      this.database.client,
      rows.map((row) => row.id),
      actor.branchIds,
    );
    return rows.map((row) => this.summary(row, states.get(row.id)));
  }
  async status(id: string, actor: AuthenticatedActor) {
    this.guard(actor);
    const row = await this.database.client.hrRecord.findFirst({
      where: { ...this.scope(actor), id: uuid(id) },
    });
    if (!row) throw new NotFoundException('حقوق پیدا نشد.');
    const states = await payrollWorksheetFinanceStates(
      this.database.client,
      [row.id],
      actor.branchIds,
    );
    return this.summary(row, states.get(row.id));
  }
  async detail(id: string, actor: AuthenticatedActor) {
    this.guard(actor);
    return this.database.client.$transaction(
      async (tx) => {
        const row = await tx.hrRecord.findFirst({
          where: { ...this.scope(actor), id: uuid(id) },
        });
        if (!row) throw new NotFoundException('حقوق پیدا نشد.');
        await this.audit(tx, actor, row, 'payroll.worksheet.read');
        return this.dto(row, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async create(body: unknown, actor: AuthenticatedActor) {
    this.guard(actor, true);
    const input = object(body, ['period', 'branchId']);
    const branchId = uuid(input.branchId),
      period = text(input.period, 'دوره', 7);
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه در محدوده دسترسی شما نیست.');
    if (!/^1[34]\d{2}-(0[1-9]|1[0-2])$/.test(period))
      throw new BadRequestException('دوره شمسی معتبر نیست.');
    const code = `PAYROLL-${branchId}-${period}`;
    const snapshot: PayrollSnapshot = {
      rows: [],
      rates: { ...PAYROLL_DEFAULT_RATES },
    };
    return this.database.client.$transaction(async (tx) => {
      // Stable business key serializes retries, including ambiguous network outcomes.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${code}, 0))::text`;
      const existing = await tx.hrRecord.findUnique({ where: { code } });
      if (existing) return this.dto(existing, tx);
      const id = randomUUID();
      const row = await tx.hrRecord.create({
        data: {
          id,
          code,
          branchId,
          section: SECTION,
          tab: 'sheet',
          values: [period],
          status: 'DRAFT',
          data: {
            ...protectHrValues(
              [JSON.stringify(snapshot)],
              context({ id, branchId }),
            ),
            rowCount: 0,
            lastEditedBy: actor.userId,
          },
        },
      });
      await this.audit(tx, actor, row, 'payroll.worksheet.create');
      return this.dto(row, tx);
    });
  }
  async update(id: string, body: unknown, actor: AuthenticatedActor) {
    this.guard(actor, true);
    const input = object(body, ['version', 'snapshot']),
      expected = version(input.version),
      snapshot = validatePayrollSnapshot(input.snapshot);
    const totals = { net: 0n, deductions: 0n, advances: 0n, remaining: 0n };
    for (const r of snapshot.rows) {
      const c = calculatePayroll(r, snapshot.rates);
      totals.net += BigInt(c.net);
      totals.deductions += BigInt(c.employeeInsurance) + BigInt(c.tax);
      totals.advances += BigInt(c.advance);
      totals.remaining += BigInt(c.remaining);
    }
    if (
      Object.values(totals).some(
        (amount) => amount <= -(10n ** 20n) || amount >= 10n ** 20n,
      )
    )
      throw new BadRequestException('عدد واردشده معتبر نیست.');
    return this.database.client.$transaction(async (tx) => {
      let row = await tx.hrRecord.findFirst({
        where: { ...this.scope(actor), id: uuid(id) },
      });
      if (!row) throw new NotFoundException('حقوق پیدا نشد.');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.code}, 0))::text`;
      row = await tx.hrRecord.findFirst({
        where: { ...this.scope(actor), id: uuid(id) },
      });
      if (!row) throw new NotFoundException('حقوق پیدا نشد.');
      for (const entry of snapshot.rows) {
        if (
          entry.employeeId &&
          !(await tx.hrEmployee.findFirst({
            where: {
              id: entry.employeeId,
              branchId: row.branchId,
              deletedAt: null,
            },
          }))
        )
          throw new BadRequestException('کارمند معتبر نیست.');
      }
      // A lost response may be retried with the immediately preceding version.
      // Return only an identical committed snapshot; never overwrite a newer edit.
      if (
        row.status === 'DRAFT' &&
        row.version === expected + 1 &&
        (row.data as Record<string, unknown>).lastEditedBy === actor.userId &&
        JSON.stringify(await this.snapshot(row, tx)) ===
          JSON.stringify(snapshot)
      )
        return this.dto(row, tx);
      if (row.version !== expected || row.status !== 'DRAFT')
        throw new ConflictException(
          'حقوق تغییر کرده یا تأیید شده است؛ دوباره بارگذاری کنید.',
        );
      const data = {
        ...protectHrValues(
          [JSON.stringify({ rows: [], rates: snapshot.rates })],
          context(row),
        ),
        rowCount: snapshot.rows.length,
        lastEditedBy: actor.userId,
      };
      const changed = await tx.hrRecord.updateMany({
        where: {
          id: row.id,
          version: expected,
          status: 'DRAFT',
          deletedAt: null,
        },
        data: { data, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه حقوق تغییر کرده است.');
      // Each encrypted row stays below the existing 8KiB HrRecord data constraint.
      // Replacing children is atomic with the parent CAS, totals and audit.
      await tx.hrRecord.deleteMany({
        where: {
          parentId: row.id,
          branchId: row.branchId,
          section: SECTION,
          tab: 'row',
        },
      });
      if (snapshot.rows.length)
        await tx.hrRecord.createMany({
          data: snapshot.rows.map((entry, index) => {
            const id = randomUUID();
            return {
              id,
              code: `PWR-${row.id}-${String(index).padStart(3, '0')}`,
              branchId: row.branchId,
              parentId: row.id,
              employeeId: entry.employeeId ?? null,
              section: SECTION,
              tab: 'row',
              values: [],
              status: 'DRAFT',
              data: protectHrValues(
                [JSON.stringify(entry)],
                `${context(row)}:${id}`,
              ),
            };
          }),
        });
      // HR-owned aggregate projections use database Decimal; names/accounts never enter these rows.
      await tx.hrRecordAmount.deleteMany({ where: { recordId: row.id } });
      await tx.hrRecordAmount.createMany({
        data: Object.entries(totals).map(([field, amount]) => ({
          recordId: row.id,
          field: amount < 0n ? `${field}Negative` : field,
          amount: new Prisma.Decimal(
            (amount < 0n ? -amount : amount).toString(),
          ),
          currency: 'IRR',
        })),
      });
      const saved = await tx.hrRecord.findUniqueOrThrow({
        where: { id: row.id },
      });
      await this.audit(tx, actor, saved, 'payroll.worksheet.update');
      return this.dto(saved, tx);
    });
  }
  async transition(
    id: string,
    body: unknown,
    actor: AuthenticatedActor,
    approve: boolean,
  ) {
    this.guard(actor, true);
    if (!actor.permissions.includes('hr.approve'))
      throw new ForbiddenException('مجوز تأیید حقوق لازم است.');
    const input = object(body, ['version']),
      expected = version(input.version);
    return this.database.client.$transaction(async (tx) => {
      let row = await tx.hrRecord.findFirst({
        where: { ...this.scope(actor), id: uuid(id) },
      });
      if (!row) throw new NotFoundException('حقوق پیدا نشد.');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.code}, 0))::text`;
      row = await tx.hrRecord.findUniqueOrThrow({ where: { id: row.id } });
      const metadata = row.data as Record<string, unknown>;
      const states = await payrollWorksheetFinanceStates(
        tx,
        [row.id],
        actor.branchIds,
      );
      const finance = states.get(row.id);
      if (
        approve &&
        row.status === 'PENDING_FINANCE' &&
        row.version === expected + 1 &&
        metadata.submittedBy === actor.userId &&
        finance
      )
        return this.dto(row, tx);
      if (row.version !== expected)
        throw new ConflictException('وضعیت حقوق تغییر کرده است.');
      let amount = 0n;
      let rowCount = 0;
      if (approve) {
        if (row.status !== 'DRAFT' && !(row.status === 'APPROVED' && !finance))
          throw new ConflictException('وضعیت حقوق تغییر کرده است.');
        const snapshot = await this.snapshot(row, tx);
        rowCount = snapshot.rows.length;
        if (
          !snapshot.rows.length ||
          snapshot.rows.some(
            (r) =>
              !r.name.trim() ||
              BigInt(calculatePayroll(r, snapshot.rates).remaining) < 0n,
          )
        )
          throw new BadRequestException(
            'نام و مانده حقوق ردیف‌ها را بررسی کنید.',
          );
        // This confirms submission, not final approval. Finance enforces a different final approver.
        amount = snapshot.rows.reduce(
          (total, r) =>
            total + BigInt(calculatePayroll(r, snapshot.rates).remaining),
          0n,
        );
        if (amount <= 0n || amount >= 10n ** 20n)
          throw new BadRequestException(
            'مبلغ قابل پرداخت حقوق باید مثبت و در محدوده مجاز باشد.',
          );
      } else {
        if (!['APPROVED', 'PENDING_FINANCE'].includes(row.status))
          throw new ConflictException('وضعیت حقوق تغییر کرده است.');
        await assertPayrollWorksheetCanReopen(tx, row.id, actor.branchIds);
      }
      const changed = await tx.hrRecord.updateMany({
        where: { id: row.id, version: expected, status: row.status },
        data: {
          status: approve ? 'PENDING_FINANCE' : 'DRAFT',
          ...(approve
            ? {
                data: {
                  ...metadata,
                  submittedBy: actor.userId,
                } as Prisma.InputJsonValue,
              }
            : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه حقوق تغییر کرده است.');
      const saved = await tx.hrRecord.findUniqueOrThrow({
        where: { id: row.id },
      });
      if (approve) {
        // Freeze the canonical payable projection with the submitted snapshot, including legacy sheets.
        await tx.hrRecordAmount.deleteMany({
          where: {
            recordId: saved.id,
            field: { in: ['remaining', 'remainingNegative'] },
          },
        });
        await tx.hrRecordAmount.createMany({
          data: [
            {
              recordId: saved.id,
              field: 'remaining',
              amount: new Prisma.Decimal(amount.toString()),
              currency: 'IRR',
            },
          ],
        });
        await submitPayrollWorksheet(
          tx,
          {
            id: saved.id,
            branchId: saved.branchId,
            period: (saved.values as string[])[0]!,
            version: saved.version,
            amount: amount.toString(),
            currencyCode: 'IRR',
            rowCount,
          },
          actor,
        );
      }
      await this.audit(
        tx,
        actor,
        saved,
        approve
          ? 'payroll.worksheet.submitFinance'
          : 'payroll.worksheet.reopen',
      );
      return this.dto(saved, tx);
    });
  }
}
