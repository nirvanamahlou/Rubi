import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FinancePayrollService } from './finance-payroll.service';
import { HrPayrollFinancePublicService } from '../../hr/hr-payroll-finance-public.service';
import { HrService } from '../../hr/hr.service';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';

const enabled = process.env.NORA_RUN_FINANCE_POSTGRES_TESTS === '1';
const databaseName = `nora_finance_test_${randomUUID().replaceAll('-', '')}`;
let created = false;
let client: DatabaseClient;
async function sql(database: string, input: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  const PgClient = createRequire(
    resolve(process.cwd(), '../../packages/database/package.json'),
  )('pg').Client as new (options: { connectionString: string }) => {
    connect(): Promise<void>;
    query(text: string): Promise<unknown>;
    end(): Promise<void>;
  };
  const connection = new PgClient({ connectionString: url.toString() });
  try {
    await connection.connect();
    await connection.query(input);
  } finally {
    await connection.end();
  }
}
describe.skipIf(!enabled)('Salary workflow isolated real PostgreSQL', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '5432' ||
      !/^nora_finance_test_[a-f0-9]{32}$/.test(databaseName)
    )
      throw new Error('Isolated local Finance test database required');
    await sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    const root = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    await sql(
      databaseName,
      readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) =>
          readFileSync(resolve(root, entry.name, 'migration.sql'), 'utf8'),
        )
        .join('\n'),
    );
    url.pathname = `/${databaseName}`;
    client = createDatabaseClient(url.toString());
  }, 120000);
  afterAll(async () => {
    await client?.$disconnect();
    if (created && /^nora_finance_test_[a-f0-9]{32}$/.test(databaseName))
      await sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 60000);
  async function fixture() {
    const suffix = randomUUID();
    const user = await client.user.create({
      data: {
        username: suffix,
        displayName: 'Synthetic finance reviewer',
        passwordHash: 'synthetic-not-a-login-hash',
      },
    });
    const branch = await client.branch.create({
      data: { code: suffix, name: 'Synthetic isolated branch' },
    });
    const employee = await client.hrEmployee.create({
      data: {
        personnelCode: suffix,
        branchId: branch.id,
        name: 'Synthetic employee',
        kind: 'کارمند',
        unit: 'Test',
        position: 'Test',
        grade: 'Test',
        startedAt: new Date('2026-01-01'),
      },
    });
    const source = await client.hrRecord.create({
      data: {
        code: suffix,
        branchId: branch.id,
        employeeId: employee.id,
        section: 'payroll',
        tab: 'paymentRequests',
        values: [employee.name, '2026-10', '100.125', '2026-10-28'],
        status: 'تأییدشده',
        data: { currency: 'IRR' },
        amounts: {
          create: { field: 'field2', amount: '100.125', currency: 'IRR' },
        },
      },
    });
    const account = await client.financeSettlementAccount.create({
      data: {
        branchId: branch.id,
        title: 'Synthetic cash',
        kind: 'CASH',
        currencyCode: 'IRR',
        createdByUserId: user.id,
      },
    });
    const method = await client.masterPaymentMethod.create({
      data: {
        code: suffix.slice(0, 32).toUpperCase(),
        name: 'Synthetic method',
        channel: 'CASH',
        direction: 'PAYMENT',
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    const actor = {
      userId: user.id,
      branchIds: [branch.id],
      permissions: [
        'finance.read',
        'finance.request.manage',
        'finance.payment.create',
      ],
    } as unknown as AuthenticatedActor;
    const hr = new HrPayrollFinancePublicService(
      {} as never,
      { client } as never,
    );
    const projection = await hr.approvedSource(source.id, actor.branchIds);
    vi.spyOn(hr, 'submit').mockResolvedValue(projection);
    const service = new FinancePayrollService(
      { client } as never,
      hr,
      undefined,
      undefined,
      new MasterProcurementDirectory({ client } as never),
    );
    const result = await service.submit({}, randomUUID(), actor);
    return { service, hr, actor, source, result, account, method, employee };
  }
  const command = (expectedVersion: number, action: string) => ({
    operationId: randomUUID(),
    expectedVersion,
    action,
  });
  it('replays submission, prevents duplicate employee-period cases, and seals approved HR input', async () => {
    const f = await fixture();
    expect(await f.service.submit({}, randomUUID(), f.actor)).toEqual(f.result);
    expect(
      await client.financeOperationalRequest.count({
        where: { hrRecordId: f.source.id },
      }),
    ).toBe(1);
    await expect(
      client.hrRecord.update({
        where: { id: f.source.id },
        data: { values: ['changed'] },
      }),
    ).rejects.toThrow();
    const duplicate = await client.hrRecord.create({
      data: {
        code: randomUUID(),
        branchId: f.source.branchId,
        employeeId: f.employee.id,
        section: 'payroll',
        tab: 'paymentRequests',
        values: [f.employee.name, '2026-10', '100.125', '2026-10-28'],
        status: 'تأییدشده',
        data: { currency: 'IRR' },
        amounts: {
          create: { field: 'field2', amount: '100.125', currency: 'IRR' },
        },
      },
    });
    vi.mocked(f.hr.submit).mockResolvedValue(
      await f.hr.approvedSource(duplicate.id, f.actor.branchIds),
    );
    await expect(f.service.submit({}, randomUUID(), f.actor)).rejects.toThrow(
      'قبلاً',
    );
  }, 60000);
  it('serializes competing payments, supports exact partial settlement and safe replay', async () => {
    const f = await fixture();
    await f.service.action(f.result.requestId, command(1, 'REVIEW'), f.actor);
    await f.service.action(f.result.requestId, command(2, 'APPROVE'), f.actor);
    const pay = {
      ...command(3, 'PAY'),
      paidAmount: '40.025',
      accountId: f.account.id,
      methodId: f.method.id,
      transferAt: '2026-10-04T10:00:00.000Z',
    };
    const otherPay = { ...pay, operationId: randomUUID() };
    const concurrent = await Promise.allSettled([
      f.service.action(f.result.requestId, pay, f.actor),
      f.service.action(f.result.requestId, otherPay, f.actor),
    ]);
    expect(
      concurrent.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const winner = concurrent[0]!.status === 'fulfilled' ? pay : otherPay;
    expect(
      await f.service.action(f.result.requestId, winner, f.actor),
    ).toMatchObject({ status: 'PAYING', remainingAmount: '60.1', version: 4 });
    await expect(
      f.service.action(
        f.result.requestId,
        {
          ...pay,
          operationId: randomUUID(),
          expectedVersion: 4,
          paidAmount: '60.1001',
        },
        f.actor,
      ),
    ).rejects.toThrow();
    expect(
      await f.service.action(
        f.result.requestId,
        {
          ...pay,
          operationId: randomUUID(),
          expectedVersion: 4,
          paidAmount: '60.1',
        },
        f.actor,
      ),
    ).toMatchObject({ status: 'PAID', remainingAmount: '0', version: 5 });
    expect(
      await client.financeOperationalRevision.count({
        where: { requestId: f.result.requestId, action: 'PAY' },
      }),
    ).toBe(2);
    await expect(
      client.financeOperationalRevision.update({
        where: { id: winner.operationId },
        data: { reason: 'rewritten' },
      }),
    ).rejects.toThrow();
  }, 60000);
  it('requires review then approval, rejects wrong branch and missing payment permission', async () => {
    const f = await fixture();
    await expect(
      f.service.action(f.result.requestId, command(1, 'APPROVE'), f.actor),
    ).rejects.toThrow();
    await expect(
      f.service.detail(f.result.requestId, { ...f.actor, branchIds: [] }),
    ).rejects.toThrow();
    await expect(
      f.service.action(f.result.requestId, command(1, 'PAY'), {
        ...f.actor,
        permissions: ['finance.read'],
      }),
    ).rejects.toThrow();
    await expect(
      f.service.action(
        f.result.requestId,
        command(1, 'CORRECTION_REQUIRED'),
        f.actor,
      ),
    ).rejects.toThrow();
  }, 60000);
  it('replaces a returned unpaid salary source with a new approved input without rewriting history', async () => {
    const f = await fixture();
    await f.service.action(
      f.result.requestId,
      { ...command(1, 'CORRECTION_REQUIRED'), reason: 'مبلغ اصلاح شود' },
      f.actor,
    );
    const revised = await client.hrRecord.create({
      data: {
        code: randomUUID(),
        branchId: f.source.branchId,
        employeeId: f.employee.id,
        section: 'payroll',
        tab: 'paymentRequests',
        values: [f.employee.name, '2026-10', '120.5', '2026-10-28'],
        status: 'تأییدشده',
        data: { currency: 'IRR' },
        amounts: {
          create: { field: 'field2', amount: '120.5', currency: 'IRR' },
        },
      },
    });
    vi.mocked(f.hr.submit).mockResolvedValue(
      await f.hr.approvedSource(revised.id, f.actor.branchIds),
    );
    expect(await f.service.submit({}, randomUUID(), f.actor)).toMatchObject({
      requestId: f.result.requestId,
      sourceId: revised.id,
      status: 'NEW',
    });
    expect(await f.service.detail(f.result.requestId, f.actor)).toMatchObject({
      amount: '120.5',
      remainingAmount: '120.5',
      version: 3,
    });
    expect(
      await client.financeOperationalRevision.count({
        where: { requestId: f.result.requestId },
      }),
    ).toBe(3);
    expect(
      (await client.hrRecord.findUniqueOrThrow({ where: { id: f.source.id } }))
        .values,
    ).toEqual(f.source.values);
  }, 60000);
  it('creates and replays a manual operational case through the currency owner', async () => {
    const f = await fixture();
    const master = new MasterProcurementDirectory({ client } as never);
    vi.spyOn(master, 'assertCurrency').mockResolvedValue(undefined);
    const service = new FinancePayrollService(
      { client } as never,
      f.hr,
      undefined,
      undefined,
      master,
    );
    const input = {
      operationId: randomUUID(),
      branchId: f.actor.branchIds[0],
      kind: 'COMMISSION',
      title: 'کمیسیون مصوب',
      party: 'همکار آزمایشی',
      amount: '10.125',
      currencyCode: 'IRR',
      dueAt: '2026-10-28',
    };
    const first = await service.createManual(input, f.actor);
    expect(await service.createManual(input, f.actor)).toEqual(first);
    expect(master.assertCurrency).toHaveBeenCalledWith('IRR');
    await expect(
      service.createManual({ ...input, amount: '11' }, f.actor),
    ).rejects.toThrow();
    expect(
      await client.financeOperationalRevision.count({
        where: { requestId: first.requestId },
      }),
    ).toBe(1);
  }, 60000);
  it('executes the real HR approval command and safely retries the same salary-table submission', async () => {
    const f = await fixture();
    const hrOwner = new HrService(
      { client } as never,
      {} as never,
      {} as never,
      {
        master: { assertCurrency: vi.fn().mockResolvedValue(undefined) },
      } as never,
    );
    const hr = new HrPayrollFinancePublicService(hrOwner, { client } as never);
    const service = new FinancePayrollService({ client } as never, hr);
    const actor = {
      ...f.actor,
      permissions: [
        ...f.actor.permissions,
        'hr.manage',
        'hr.approve',
        'hr.sensitive',
      ],
    } as AuthenticatedActor;
    const input = {
      employeeId: f.employee.id,
      period: '2026-11',
      amount: '1000.25',
      currencyCode: 'IRR',
      dueAt: '2026-11-28',
    };
    const key = randomUUID();
    const first = await service.submit(input, key, actor);
    expect(await service.submit(input, key, actor)).toEqual(first);
    expect(
      await client.hrRecordAmount.findFirst({
        where: { recordId: first.sourceId, field: 'field2' },
      }),
    ).toMatchObject({ currency: 'IRR' });
    expect(
      await client.financeOperationalRequest.findUnique({
        where: { id: first.requestId },
      }),
    ).toMatchObject({
      party: f.employee.name,
      payrollPeriod: '2026-11',
      status: 'NEW',
    });
  }, 60000);
});
