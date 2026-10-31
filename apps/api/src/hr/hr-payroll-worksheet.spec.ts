import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  PAYROLL_DEFAULT_RATES,
  EMPLOYMENT_DEFAULTS,
  payrollMonthDays,
  PAYROLL_COLUMNS,
  calculatePayroll,
  emptyPayrollRow,
  payrollCell,
  type AuthenticatedActor,
} from '@nora/contracts';
import {
  HrPayrollWorksheetService,
  validatePayrollSnapshot,
} from './hr-payroll-worksheet.service';
import { revealHrValues } from './hr-private-values';
import { Prisma } from '@nora/database';

const branchId = randomUUID(),
  otherBranch = randomUUID(),
  userId = randomUUID();
const actor = {
  userId,
  branchIds: [branchId],
  permissions: ['hr.read', 'hr.manage', 'hr.sensitive', 'hr.approve'],
} as AuthenticatedActor;
const rates = { ...PAYROLL_DEFAULT_RATES };
const sample = () => ({
  ...emptyPayrollRow(randomUUID()),
  name: 'Synthetic worker',
  daily: '4200000',
  seniority: '120000',
  days: '30',
  housing: '9000000',
  food: '22000000',
  tax: '3000000',
  agreed: '180000000',
  advance: '10000000',
  ot: '2:30',
  short: '0:15',
  account: 'SYNTHETIC-ACCOUNT',
});
function fixture() {
  let stored: Record<string, unknown> | null = null;
  let children: Record<string, unknown>[] = [];
  let finance: Record<string, unknown> | null = null;
  const revisions: Record<string, unknown>[] = [];
  const financeRow = () =>
    finance ? { ...finance, revisions: revisions.slice(-1) } : null;
  const assertBounded = (data: unknown) =>
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThanOrEqual(8000);
  const matches = (where: Record<string, unknown>) =>
    stored &&
    (!where.id || where.id === stored.id) &&
    (!where.code || where.code === stored.code) &&
    (!where.version || where.version === stored.version) &&
    (!where.status || where.status === stored.status) &&
    (!where.branchId ||
      (where.branchId as { in: string[] }).in.includes(
        stored.branchId as string,
      ));
  const hrRecord = {
    findMany: vi.fn(async ({ where }) =>
      where.parentId
        ? children.filter(
            (row) =>
              row.parentId === where.parentId &&
              row.branchId === where.branchId,
          )
        : matches(where)
          ? [stored]
          : [],
    ),
    deleteMany: vi.fn(async () => {
      children = [];
    }),
    createMany: vi.fn(async ({ data }) => {
      for (const row of data) assertBounded(row.data);
      children = data;
      return { count: data.length };
    }),
    findFirst: vi.fn(async ({ where }) => (matches(where) ? stored : null)),
    findUnique: vi.fn(async ({ where }) => (matches(where) ? stored : null)),
    findUniqueOrThrow: vi.fn(async () => stored),
    create: vi.fn(async ({ data }) => {
      assertBounded(data.data);
      stored = { ...data, version: 1, deletedAt: null, updatedAt: new Date() };
      return stored;
    }),
    update: vi.fn(async ({ data }) => {
      assertBounded(data.data);
      stored = {
        ...stored,
        data: data.data,
        version: Number(stored!.version) + 1,
      };
      return stored;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      if (!matches(where)) return { count: 0 };
      if (data.data) assertBounded(data.data);
      stored = { ...stored, ...data, version: Number(stored!.version) + 1 };
      return { count: 1 };
    }),
  };
  const client = {
    hrRecord,
    $queryRaw: vi.fn(),
    hrRecordAmount: { deleteMany: vi.fn(), createMany: vi.fn() },
    hrAuditEvent: { create: vi.fn() },
    financeOperationalRequest: {
      findMany: vi.fn(async () => (finance ? [financeRow()] : [])),
      findUnique: vi.fn(async () => financeRow()),
      findUniqueOrThrow: vi.fn(async () => financeRow()),
      create: vi.fn(async ({ data }) => (finance = { ...data, version: 1 })),
      updateMany: vi.fn(async ({ data }) => {
        finance = {
          ...finance,
          ...data,
          version: Number(finance!.version) + 1,
        };
        return { count: 1 };
      }),
    },
    financeOperationalRevision: {
      create: vi.fn(async ({ data }) => {
        revisions.push({ ...data, cumulativePaid: new Prisma.Decimal(0) });
      }),
    },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (work) => work(client));
  return {
    client,
    hrRecord,
    row: () => stored!,
    children: () => children,
    finance: () => finance!,
    financeStatus: (status: string) => {
      finance = { ...finance, status };
    },
    service: new HrPayrollWorksheetService({ client } as never),
  };
}
beforeEach(() =>
  vi.stubEnv(
    'HR_PRIVATE_ENCRYPTION_KEY_BASE64',
    Buffer.alloc(32, 4).toString('base64'),
  ),
);
afterEach(() => vi.unstubAllEnvs());
describe('payroll worksheet arithmetic and validation', () => {
  it('does not describe historical HR-only approval as Finance approval', async () => {
    const f = fixture();
    const created = await f.service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    f.row().status = 'APPROVED';
    expect((await f.service.status(created.id, actor)).status).toBe(
      'HR_APPROVED',
    );
    expect(
      (await f.service.transition(created.id, { version: 1 }, actor, false))
        .status,
    ).toBe('DRAFT');
  });
  it('preserves all 28 Excel columns including sequence, and exact formulas', () => {
    expect(PAYROLL_COLUMNS).toHaveLength(32);
    const row = sample(),
      result = calculatePayroll(row, rates);
    expect(result).toMatchObject({
      monthly: '129600000',
      subject: '31000000',
      employeeInsurance: '11242000',
      unemployment: '4818000',
      employerInsurance: '32120000',
      insuranceTotal: '48180000',
      legalNet: '146358000',
      otPay: '1837500',
      shortPay: '131250',
      bonus: '25348250',
      net: '181706250',
      remaining: '171706250',
    });
    expect(result.account).toBe('SYNTHETIC-ACCOUNT');
  });
  it('applies requested IRR defaults, Persian month day counts, children and explicit hourly rates', () => {
    expect(EMPLOYMENT_DEFAULTS).toMatchObject({
      married: '5000000',
      housing: '30000000',
      food: '22000000',
      childRate: '16625550',
    });
    expect(
      Array.from({ length: 12 }, (_, i) =>
        payrollMonthDays(`1405-${String(i + 1).padStart(2, '0')}`),
      ),
    ).toEqual([
      '31',
      '31',
      '31',
      '31',
      '31',
      '31',
      '30',
      '30',
      '30',
      '30',
      '30',
      '29',
    ]);
    const row = {
      ...sample(),
      ...EMPLOYMENT_DEFAULTS,
      days: '31',
      children: '2',
      overtimeHourly: '1000000',
      shortageHourly: '600000',
      ot: '2:30',
      short: '0:15',
    };
    const result = calculatePayroll(row, rates);
    expect(result.childPay).toBe('33251100');
    expect(result.otPay).toBe('2500000');
    expect(result.shortPay).toBe('150000');
    const old = { ...sample() } as Record<string, unknown>;
    for (const key of [
      'children',
      'childRate',
      'overtimeHourly',
      'shortageHourly',
    ])
      delete old[key];
    expect(
      validatePayrollSnapshot({ rows: [old], rates }).rows[0]!.childRate,
    ).toBe('0');
  });
  it('guards configuration scope, sensitivity and write permission', async () => {
    const f = fixture();
    await expect(
      f.service.configuration(otherBranch, 'defaults', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      f.service.configuration(branchId, 'defaults', {
        ...actor,
        permissions: ['hr.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      f.service.configuration(
        branchId,
        'defaults',
        { ...actor, permissions: ['hr.read', 'hr.sensitive'] },
        { version: 0, values: EMPLOYMENT_DEFAULTS },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await f.service.configuration(branchId, 'defaults', actor)).toEqual({
      version: 0,
      values: EMPLOYMENT_DEFAULTS,
    });
    await expect(
      f.service.configuration(branchId, 'defaults', actor, {
        version: 5,
        values: EMPLOYMENT_DEFAULTS,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    const saved = await f.service.configuration(branchId, 'defaults', actor, {
      version: 0,
      values: EMPLOYMENT_DEFAULTS,
    });
    expect(saved.values.housing).toBe('30000000');
    expect(saved.values.days).toBe('');
    const edited = await f.service.configuration(branchId, 'defaults', actor, {
      version: 1,
      values: { ...EMPLOYMENT_DEFAULTS, housing: '35000000' },
    });
    expect(edited.version).toBe(2);
    expect(edited.values.housing).toBe('35000000');
    expect(JSON.stringify(f.row().data)).not.toContain('30000000');
  });
  it('retains exact integer totals beyond binary floating-point precision', () => {
    const row = {
      ...sample(),
      daily: '999999999999',
      seniority: '999999999999',
      days: '31',
      ot: '999:59',
    };
    const c = calculatePayroll(row, rates);
    expect(c.monthly).toBe('61999999999938');
    expect(BigInt(c.net)).toBe(
      BigInt(row.agreed) +
        BigInt(c.benefits) +
        BigInt(c.otPay) -
        BigInt(c.shortPay),
    );
  });
  it('accepts Persian digits, blank rows and zero values, rejects formulas and bad times', () => {
    expect(payrollCell('daily', '۱٬۲۳۴')).toBe('1234');
    expect(payrollCell('ot', '۰۱:۳۰')).toBe('01:30');
    expect(calculatePayroll(emptyPayrollRow(randomUUID()), rates).net).toBe(
      '0',
    );
    for (const [field, value] of [
      ['daily', '=1+1'],
      ['daily', '1e3'],
      ['daily', '-1'],
      ['days', '32'],
      ['ot', '1:60'],
      ['start', '1405/13/01'],
    ] as const)
      expect(() => payrollCell(field, value)).toThrow();
  });
  it('validates untrusted snapshots, row bounds and immutable calculated fields', () => {
    const valid = { rows: [sample()], rates };
    expect(validatePayrollSnapshot(valid).rows).toHaveLength(1);
    for (const input of [
      null,
      { ...valid, extra: true },
      { ...valid, rates: { ...rates, dailyMinutes: 0 } },
      { ...valid, rates: { ...rates, overtime: 100001 } },
      { ...valid, rows: [{ ...sample(), net: '1' }] },
      { ...valid, rows: [valid.rows[0], valid.rows[0]] },
      { ...valid, rows: Array.from({ length: 501 }, sample) },
    ])
      expect(() => validatePayrollSnapshot(input)).toThrow(BadRequestException);
  });
});
describe('private durable worksheet commands', () => {
  it('rejects aggregate Decimal overflow before touching saved rows', async () => {
    const { service, hrRecord } = fixture();
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    const rows = Array.from({ length: 500 }, () => ({
      ...sample(),
      daily: '999999999999',
      ot: '999:59',
    }));
    await expect(
      service.update(
        created.id,
        {
          version: 1,
          snapshot: {
            rows,
            rates: { ...rates, dailyMinutes: 1, overtime: 100000 },
          },
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(hrRecord.updateMany).not.toHaveBeenCalled();
  });
  it('persists 500 encrypted rows within existing SQL bounds and isolates child IDs', async () => {
    const { service, children, row } = fixture();
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    const rows = Array.from({ length: 500 }, () => ({
      ...sample(),
      name: 'ش'.repeat(160),
      bank: 'ب'.repeat(160),
      account: 'A'.repeat(160),
    }));
    const saved = await service.update(
      created.id,
      { version: 1, snapshot: { rows, rates } },
      actor,
    );
    expect(saved.rows).toEqual(rows);
    expect(children()).toHaveLength(500);
    expect(JSON.stringify(row())).not.toContain('A'.repeat(160));
    expect(await service.list(actor)).toHaveLength(1);
    await expect(
      service.detail(String(children()[0]!.id), actor),
    ).rejects.toThrow(NotFoundException);
  });
  it('retains negative draft balances as explicit positive-magnitude projections', async () => {
    const { service, client } = fixture();
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    const row = {
      ...sample(),
      agreed: '0',
      advance: '10000000',
      ot: '0:00',
      short: '1:00',
    };
    await service.update(
      created.id,
      { version: 1, snapshot: { rows: [row], rates } },
      actor,
    );
    const totals = client.hrRecordAmount.createMany.mock.calls[0]![0].data;
    expect(totals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'remainingNegative' }),
      ]),
    );
    expect(
      totals.every(
        (entry: { amount: { isNegative: () => boolean } }) =>
          !entry.amount.isNegative(),
      ),
    ).toBe(true);
  });
  it('starts empty, serializes create retries and keeps amounts and names out of metadata', async () => {
    const { service, client, row, children } = fixture();
    const result = await service.create({ branchId, period: '1405-07' }, actor);
    expect(result.rows).toEqual([]);
    expect(
      await service.create({ branchId, period: '1405-07' }, actor),
    ).toEqual(result);
    expect(client.hrRecord.create).toHaveBeenCalledTimes(1);
    expect(client.$queryRaw).toHaveBeenCalledTimes(2);
    const saved = await service.update(
      result.id,
      { version: 1, snapshot: { rows: [sample()], rates } },
      actor,
    );
    expect(saved.rows[0]!.account).toBe('SYNTHETIC-ACCOUNT');
    expect(JSON.stringify(row())).not.toContain('SYNTHETIC-ACCOUNT');
    expect(JSON.stringify(client.hrAuditEvent.create.mock.calls)).not.toContain(
      'SYNTHETIC-ACCOUNT',
    );
    expect(client.hrRecordAmount.createMany.mock.calls[0]![0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'net',
          currency: 'IRR',
          amount: expect.objectContaining({ toString: expect.any(Function) }),
        }),
      ]),
    );
    expect(
      revealHrValues(
        children()[0]!.data,
        `${branchId}:${result.id}:payroll-worksheet:v1:${children()[0]!.id}`,
      )[0],
    ).toContain('SYNTHETIC-ACCOUNT');
  });
  it('isolates branches and requires sensitive plus native read/manage permissions', async () => {
    const { service, client } = fixture();
    for (const permissions of [
      ['hr.manage'],
      ['hr.sensitive'],
      ['hr.self', 'hr.sensitive'],
    ])
      await expect(
        service.list({ ...actor, permissions } as AuthenticatedActor),
      ).rejects.toThrow(ForbiddenException);
    expect(client.hrRecord.findMany).not.toHaveBeenCalled();
    await expect(
      service.create({ branchId: otherBranch, period: '1405-07' }, actor),
    ).rejects.toThrow(ForbiddenException);
    const result = await service.create({ branchId, period: '1405-07' }, actor);
    await expect(
      service.detail(result.id, { ...actor, branchIds: [otherBranch] }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.update(
        result.id,
        { version: 1, snapshot: { rows: [], rates } },
        { ...actor, permissions: ['hr.read', 'hr.sensitive'] },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rejects stale edits and competing CAS without overwriting the saved sheet', async () => {
    const { service, hrRecord } = fixture();
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    const committed = { rows: [sample()], rates };
    await service.update(
      created.id,
      { version: 1, snapshot: committed },
      actor,
    );
    expect(
      (
        await service.update(
          created.id,
          { version: 1, snapshot: committed },
          actor,
        )
      ).version,
    ).toBe(2);
    await expect(
      service.update(
        created.id,
        { version: 1, snapshot: { rows: [], rates } },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    hrRecord.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.update(
        created.id,
        { version: 2, snapshot: { rows: [], rates } },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect((await service.detail(created.id, actor)).rows).toHaveLength(1);
  });
  it('submits exactly one pending request, tracks Finance approval and permits only returned drafts to reopen', async () => {
    const { service, client, finance, financeStatus } = fixture(),
      reviewer = actor;
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    await expect(
      service.transition(created.id, { version: 1 }, reviewer, true),
    ).rejects.toThrow(BadRequestException);
    const saved = await service.update(
      created.id,
      { version: 1, snapshot: { rows: [sample()], rates } },
      actor,
    );
    await expect(
      service.transition(
        saved.id,
        { version: 2 },
        {
          ...actor,
          permissions: actor.permissions.filter((p) => p !== 'hr.approve'),
        },
        true,
      ),
    ).rejects.toThrow(ForbiddenException);
    const approved = await service.transition(
      saved.id,
      { version: 2 },
      reviewer,
      true,
    );
    expect(approved.status).toBe('PENDING_FINANCE');
    expect(finance()).toMatchObject({
      kind: 'PAYROLL_WORKSHEET',
      hrRecordId: saved.id,
      sourceVersion: 3,
      currencyCode: 'IRR',
      requesterId: actor.userId,
    });
    expect(finance().amount).toBe(calculatePayroll(sample(), rates).remaining);
    expect(
      (await service.transition(saved.id, { version: 2 }, reviewer, true))
        .status,
    ).toBe('PENDING_FINANCE');
    expect(client.financeOperationalRequest.create).toHaveBeenCalledTimes(1);
    await expect(
      service.transition(saved.id, { version: 3 }, reviewer, false),
    ).rejects.toThrow(ConflictException);
    financeStatus('APPROVED');
    expect((await service.status(saved.id, actor)).status).toBe('APPROVED');
    await expect(
      service.transition(saved.id, { version: 3 }, reviewer, false),
    ).rejects.toThrow(ConflictException);
    financeStatus('CORRECTION_REQUIRED');
    expect((await service.status(saved.id, actor)).status).toBe(
      'CORRECTION_REQUIRED',
    );
    await expect(
      service.update(
        saved.id,
        { version: 3, snapshot: { rows: [], rates } },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(
      (await service.transition(saved.id, { version: 3 }, reviewer, false))
        .status,
    ).toBe('DRAFT');
  });
  it('persists row deletion and rejects malformed periods before writing', async () => {
    const { service } = fixture();
    await expect(
      service.create({ branchId, period: '1405-13' }, actor),
    ).rejects.toThrow(BadRequestException);
    const created = await service.create(
      { branchId, period: '1405-07' },
      actor,
    );
    await service.update(
      created.id,
      { version: 1, snapshot: { rows: [sample()], rates } },
      actor,
    );
    const removed = await service.update(
      created.id,
      { version: 2, snapshot: { rows: [], rates } },
      actor,
    );
    expect(removed.rows).toEqual([]);
    expect((await service.list(actor))[0]!.rowCount).toBe(0);
  });
});
