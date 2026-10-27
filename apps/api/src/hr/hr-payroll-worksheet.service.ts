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
  PAYROLL_DEFAULT_RATES,
  payrollCell,
  calculatePayroll,
  type AuthenticatedActor,
  type PayrollSnapshot,
  type PayrollWorksheet,
  type PayrollWorksheetSummary,
  type PayrollRates,
} from '@nora/contracts';
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
    const row = object(value, ['id', ...PAYROLL_INPUTS]);
    const id = uuid(row.id);
    if (ids.has(id)) throw new BadRequestException('شناسه ردیف تکراری است.');
    ids.add(id);
    try {
      return {
        id,
        ...Object.fromEntries(
          PAYROLL_INPUTS.map((key) => {
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
      branchId: { in: actor.branchIds },
      deletedAt: null,
    };
  }
  private summary(row: Row): PayrollWorksheetSummary {
    const metadata = row.data as Record<string, unknown>;
    return {
      id: row.id,
      period: (row.values as string[])[0]!,
      rowCount: Number(metadata.rowCount ?? 0),
      branchId: row.branchId,
      version: row.version,
      status: row.status as 'DRAFT' | 'APPROVED',
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private snapshot(row: Row): PayrollSnapshot {
    return validatePayrollSnapshot(
      JSON.parse(revealHrValues(row.data, context(row))[0]!),
    );
  }
  private dto(row: Row): PayrollWorksheet {
    const { rowCount: _count, ...summary } = this.summary(row);
    void _count;
    return { ...summary, ...this.snapshot(row) };
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
  async list(actor: AuthenticatedActor) {
    this.guard(actor);
    const rows = await this.database.client.hrRecord.findMany({
      where: this.scope(actor),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 1001,
    });
    if (rows.length > 1000)
      throw new BadRequestException('تعداد دوره‌ها بیش از حد مجاز است.');
    return rows.map((row) => this.summary(row));
  }
  async detail(id: string, actor: AuthenticatedActor) {
    this.guard(actor);
    const row = await this.database.client.hrRecord.findFirst({
      where: { ...this.scope(actor), id: uuid(id) },
    });
    if (!row) throw new NotFoundException('حقوق پیدا نشد.');
    await this.database.client.hrAuditEvent.create({
      data: {
        branchId: row.branchId,
        recordId: row.id,
        actorId: actor.userId,
        action: 'payroll.worksheet.read',
        changes: {},
      },
    });
    return this.dto(row);
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
      if (existing) return this.dto(existing);
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
      return this.dto(row);
    });
  }
  async update(id: string, body: unknown, actor: AuthenticatedActor) {
    this.guard(actor, true);
    const input = object(body, ['version', 'snapshot']),
      expected = version(input.version),
      snapshot = validatePayrollSnapshot(input.snapshot);
    return this.database.client.$transaction(async (tx) => {
      const row = await tx.hrRecord.findFirst({
        where: { ...this.scope(actor), id: uuid(id) },
      });
      if (!row) throw new NotFoundException('حقوق پیدا نشد.');
      // A lost response may be retried with the immediately preceding version.
      // Return only an identical committed snapshot; never overwrite a newer edit.
      if (
        row.status === 'DRAFT' &&
        row.version === expected + 1 &&
        (row.data as Record<string, unknown>).lastEditedBy === actor.userId &&
        JSON.stringify(this.snapshot(row)) === JSON.stringify(snapshot)
      )
        return this.dto(row);
      if (row.version !== expected || row.status !== 'DRAFT')
        throw new ConflictException(
          'حقوق تغییر کرده یا تأیید شده است؛ دوباره بارگذاری کنید.',
        );
      const data = {
        ...protectHrValues([JSON.stringify(snapshot)], context(row)),
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
      // HR-owned aggregate projections use database Decimal; names/accounts never enter these rows.
      await tx.hrRecordAmount.deleteMany({ where: { recordId: row.id } });
      const totals = { net: 0n, deductions: 0n, advances: 0n, remaining: 0n };
      for (const r of snapshot.rows) {
        const c = calculatePayroll(r, snapshot.rates);
        totals.net += BigInt(c.net);
        totals.deductions += BigInt(c.employeeInsurance) + BigInt(c.tax);
        totals.advances += BigInt(c.advance);
        totals.remaining += BigInt(c.remaining);
      }
      await tx.hrRecordAmount.createMany({
        data: Object.entries(totals).map(([field, amount]) => ({
          recordId: row.id,
          field,
          amount: new Prisma.Decimal(amount.toString()),
          currency: 'IRR',
        })),
      });
      const saved = await tx.hrRecord.findUniqueOrThrow({
        where: { id: row.id },
      });
      await this.audit(tx, actor, saved, 'payroll.worksheet.update');
      return this.dto(saved);
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
      const row = await tx.hrRecord.findFirst({
        where: { ...this.scope(actor), id: uuid(id) },
      });
      if (!row) throw new NotFoundException('حقوق پیدا نشد.');
      if (
        row.version !== expected ||
        row.status !== (approve ? 'DRAFT' : 'APPROVED')
      )
        throw new ConflictException('وضعیت حقوق تغییر کرده است.');
      if (approve) {
        const snapshot = this.snapshot(row);
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
        if ((row.data as Record<string, unknown>).lastEditedBy === actor.userId)
          throw new ForbiddenException(
            'تأیید باید توسط کاربر دیگری انجام شود.',
          );
      }
      const changed = await tx.hrRecord.updateMany({
        where: { id: row.id, version: expected, status: row.status },
        data: {
          status: approve ? 'APPROVED' : 'DRAFT',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه حقوق تغییر کرده است.');
      const saved = await tx.hrRecord.findUniqueOrThrow({
        where: { id: row.id },
      });
      await this.audit(
        tx,
        actor,
        saved,
        approve ? 'payroll.worksheet.approve' : 'payroll.worksheet.reopen',
      );
      return this.dto(saved);
    });
  }
}
