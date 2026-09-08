import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  HR_PERMISSION_CODES,
  type AuthenticatedActor,
  type HrEmployeeDto,
  type HrRecordDto,
  type IamPermissionCode,
} from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { hash } from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentsRepository } from '../documents/documents.repository';
import type { LocalDocumentStorage } from '../documents/documents.storage';
import type { DocumentsScanProcessor } from '../documents/documents.scan-processor';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

const databaseName = `rubi_hr_test_${randomUUID().replaceAll('-', '')}`;
const branchA = randomUUID(),
  branchB = randomUUID();
let client: DatabaseClient,
  app: INestApplication,
  service: HrService,
  iam: IamService,
  created = false;
let admin: AuthenticatedActor,
  self: AuthenticatedActor,
  outsider: AuthenticatedActor,
  reader: AuthenticatedActor;
let adminCookie = '',
  selfCookie = '';
let employee: HrEmployeeDto, otherEmployee: HrEmployeeDto, leave: HrRecordDto;
const key = () => randomUUID();
function sql(database: string, input: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'rubi-postgres-1',
      'psql',
      '-U',
      'rubi_local',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: 'pipe', timeout: 60000 },
  );
}
async function actor(
  username: string,
  permissions: readonly IamPermissionCode[],
  branches: string[],
) {
  const password = randomBytes(24).toString('base64');
  const user = await client.user.create({
    data: {
      username,
      displayName: `Synthetic ${username}`,
      passwordHash: await hash(password),
    },
  });
  const role = await client.role.create({
    data: { code: username, name: username },
  });
  await client.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const branchId of branches)
    await client.userBranch.create({ data: { userId: user.id, branchId } });
  for (const code of permissions) {
    const p = await client.permission.upsert({
      where: { code },
      create: { code, module: code.split('.')[0]!, name: code },
      update: {},
    });
    await client.rolePermission.create({
      data: { roleId: role.id, permissionId: p.id },
    });
  }
  const login = await iam.login(username, password, {});
  return {
    actor: await iam.authenticate(login.accessToken),
    cookie: `rubi_access=${login.accessToken}`,
  };
}
const employeeInput = (name: string, extras: Record<string, unknown> = {}) => ({
  name,
  kind: 'تمام‌وقت',
  unit: 'عملیات',
  position: 'کارشناس',
  grade: 'G4',
  startedAtValue: '2024-01-01',
  branchId: branchA,
  ...extras,
});

describe.skipIf(process.env.RUBI_RUN_HR_POSTGRES_TESTS !== '1')(
  'HR real authenticated PostgreSQL commands',
  () => {
    beforeAll(async () => {
      const env = parseEnv(
        readFileSync(
          process.env.RUBI_HR_TEST_ENV_FILE ?? resolve(process.cwd(), '.env'),
          'utf8',
        ),
      );
      const url = new URL(env.DATABASE_URL!);
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.port !== '55432' ||
        !/^rubi_hr_test_[a-f0-9]{32}$/.test(databaseName)
      )
        throw new Error(
          'Only a randomly named isolated local HR test database is permitted.',
        );
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      created = true;
      const directory = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      sql(
        databaseName,
        readdirSync(directory, { withFileTypes: true })
          .filter((item) => item.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) =>
            readFileSync(
              resolve(directory, item.name, 'migration.sql'),
              'utf8',
            ),
          )
          .join('\n'),
      );
      url.pathname = `/${databaseName}`;
      client = createDatabaseClient(url.toString());
      const database = { client } as DatabaseService;
      iam = new IamService(
        database,
        new JwtService({
          secret: randomBytes(48).toString('base64'),
          signOptions: { issuer: 'rubi-api', audience: 'rubi-web' },
          verifyOptions: { issuer: 'rubi-api', audience: 'rubi-web' },
        }),
      );
      service = new HrService(
        database,
        iam,
        new DocumentsService(
          new DocumentsRepository(database),
          {} as LocalDocumentStorage,
          { available: false } as DocumentsScanProcessor,
        ),
      );
      await client.branch.createMany({
        data: [
          { id: branchA, code: 'HR-TEST-A', name: 'Synthetic A' },
          { id: branchB, code: 'HR-TEST-B', name: 'Synthetic B' },
        ],
      });
      const adminResult = await actor(
        'hr_test_admin',
        [
          ...HR_PERMISSION_CODES,
          'documents.metadata.read',
          'documents.hr.read',
        ],
        [branchA, branchB],
      );
      admin = adminResult.actor;
      adminCookie = adminResult.cookie;
      const selfResult = await actor('hr_test_self', ['hr.self'], [branchA]);
      self = selfResult.actor;
      selfCookie = selfResult.cookie;
      outsider = (
        await actor('hr_test_outsider', ['hr.read', 'hr.manage'], [branchB])
      ).actor;
      reader = (await actor('hr_test_reader', ['hr.read'], [branchA])).actor;
      const module = await Test.createTestingModule({
        controllers: [HrController],
        providers: [
          AuthGuard,
          { provide: IamService, useValue: iam },
          { provide: HrService, useValue: service },
        ],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      await app.init();
    }, 60000);
    afterAll(async () => {
      if (app) await app.close();
      if (client) await client.$disconnect();
      if (created && /^rubi_hr_test_[a-f0-9]{32}$/.test(databaseName))
        sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
    }, 60000);
    it('rejects absent authentication through the real cookie guard', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/hr/bootstrap')
        .expect(401);
    });
    it('creates a stable employee and assignment once under concurrent idempotent requests', async () => {
      const idempotency = key(),
        input = employeeInput('Synthetic Employee', { userId: self.userId });
      const responses = await Promise.all([
        service.createEmployee(input, idempotency, admin),
        service.createEmployee(input, idempotency, admin),
      ]);
      employee = responses[0]!;
      expect(responses[1]?.id).toBe(employee.id);
      expect(employee.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(await client.hrEmployee.count()).toBe(1);
      expect(
        await client.hrRecord.count({
          where: { employeeId: employee.id, tab: 'assignment' },
        }),
      ).toBe(1);
      await expect(
        service.createEmployee(
          { ...input, name: 'Different' },
          idempotency,
          admin,
        ),
      ).rejects.toThrow('محتوای متفاوت');
      otherEmployee = await service.createEmployee(
        employeeInput('Synthetic Other'),
        key(),
        admin,
      );
    });
    it('enforces branch/self visibility in bootstrap and HTTP mutations', async () => {
      expect((await service.bootstrap(outsider)).employees).toHaveLength(0);
      expect(
        (await service.bootstrap(self)).employees.map((row) => row.id),
      ).toEqual([employee.id]);
      await request(app.getHttpServer())
        .post('/api/v1/hr/employees')
        .set('Cookie', selfCookie)
        .set('Idempotency-Key', key())
        .send(employeeInput('Denied'))
        .expect(403);
      await expect(
        service.createEmployee(employeeInput('Wrong branch'), key(), outsider),
      ).rejects.toThrow();
    });
    it('loses exactly one stale concurrent edit and forbids direct job assignment changes', async () => {
      const outcomes = await Promise.allSettled([
        service.updateEmployee(
          employee.id,
          { version: 1, name: 'Synthetic Employee Updated' },
          admin,
        ),
        service.updateEmployee(
          employee.id,
          { version: 1, name: 'Synthetic Employee Race' },
          admin,
        ),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      employee = (await service.bootstrap(admin)).employees.find(
        (row) => row.id === employee.id,
      )!;
      expect(employee.version).toBe(2);
      await expect(
        service.updateEmployee(
          employee.id,
          { version: 2, position: 'Forged promotion' },
          admin,
        ),
      ).rejects.toThrow('تاریخ اثر');
    });
    it('allows self leave requests only for the linked employee and rejects unauthorized approval', async () => {
      const body = {
        section: 'time',
        tab: 'leave',
        employeeId: employee.id,
        values: [
          employee.name,
          'استحقاقی',
          '2026-09-14',
          '2026-09-15',
          '2',
          '—',
        ],
        status: 'در انتظار تأیید',
      };
      leave = await service.createRecord(body, key(), self);
      await expect(
        service.createRecord(
          { ...body, employeeId: otherEmployee.id },
          key(),
          self,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateRecord(
          leave.id,
          { version: 1, status: 'تأییدشده' },
          self,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateRecord(
          leave.id,
          { version: 1, status: 'تأییدشده' },
          admin,
        ),
      ).rejects.toThrow('مانده');
      expect((await service.getRecord(leave.id, admin)).status).toBe(
        'در انتظار تأیید',
      );
    });
    it('grants, consumes and reverses immutable leave entries exactly once', async () => {
      const idempotency = key(),
        grant = {
          employeeId: employee.id,
          type: 'استحقاقی',
          days: '10',
          year: 2026,
          reason: 'Synthetic organization-approved allowance',
        };
      await service.grantLeave(grant, idempotency, admin);
      await service.grantLeave(grant, idempotency, admin);
      const approved = await service.updateRecord(
        leave.id,
        { version: 1, status: 'تأییدشده' },
        admin,
      );
      expect(
        (
          await service.leaveBalances(
            { employeeId: employee.id, asOf: '2026-12-31' },
            self,
          )
        ).items[0]?.balance,
      ).toBe('8.00');
      await expect(
        service.updateRecord(
          leave.id,
          { version: approved.version, status: 'تأییدشده' },
          admin,
        ),
      ).rejects.toThrow();
      const cancelled = await service.updateRecord(
        leave.id,
        {
          version: approved.version,
          status: 'لغوشده',
          data: { reason: 'Synthetic cancellation' },
        },
        self,
      );
      expect(cancelled.status).toBe('لغوشده');
      expect(
        await client.hrLeaveEntry.count({ where: { employeeId: employee.id } }),
      ).toBe(3);
      expect(
        (
          await service.leaveBalances(
            { employeeId: employee.id, asOf: '2026-12-31' },
            self,
          )
        ).items[0]?.balance,
      ).toBe('10.00');
      await expect(
        client.hrLeaveEntry.updateMany({ data: { days: '999' } }),
      ).rejects.toThrow();
      await expect(client.hrAuditEvent.deleteMany()).rejects.toThrow();
    });
    it('creates employees from onboarding once and does not apply future promotions early', async () => {
      const onboard = await service.createRecord(
        {
          section: 'lifecycle',
          tab: 'onboarding',
          values: [
            'Synthetic Onboard',
            branchA,
            'عملیات',
            'تمام‌وقت',
            'کارشناس',
            'G4',
            '—',
            '2026-09-01',
          ],
          status: 'تأییدشده',
        },
        key(),
        admin,
      );
      expect(onboard.employeeId).not.toBeNull();
      expect(onboard.appliedAt).not.toBeNull();
      const future = await service.createRecord(
        {
          section: 'lifecycle',
          tab: 'promotion',
          employeeId: employee.id,
          values: [
            employee.name,
            'fake old',
            'fake grade',
            'سرپرست',
            'G5',
            '2099-01-01',
            'fake approver',
          ],
          status: 'تأییدشده',
        },
        key(),
        admin,
      );
      expect(future.values[1]).toBe(employee.position);
      expect(future.appliedAt).toBeNull();
      expect(
        (await service.bootstrap(admin)).employees.find(
          (row) => row.id === employee.id,
        )?.position,
      ).toBe(employee.position);
      const promotion = await service.createRecord(
        {
          section: 'lifecycle',
          tab: 'promotion',
          employeeId: otherEmployee.id,
          values: [
            otherEmployee.name,
            'x',
            'x',
            'سرپرست',
            'G5',
            '2026-01-01',
            '—',
          ],
          status: 'تأییدشده',
        },
        key(),
        admin,
      );
      expect(promotion.appliedAt).not.toBeNull();
      expect(
        (await service.bootstrap(admin)).employees.find(
          (row) => row.id === otherEmployee.id,
        )?.position,
      ).toBe('سرپرست');
    });
    it('preserves contract parent IDs, decimal currency amounts and masks sensitive results', async () => {
      const contract = await service.createRecord(
        {
          section: 'contracts',
          tab: 'active',
          employeeId: employee.id,
          values: [
            employee.name,
            'TEST-CONTRACT',
            'شرکت آزمایشی',
            'تمام‌وقت',
            '2026-01-01',
            '2026-12-31',
            'کارشناس',
            '1234.125',
            'IRR',
            'تعهد آزمایشی',
            'یک سال',
            'داوری',
          ],
          status: 'پیش‌نویس',
        },
        key(),
        admin,
      );
      expect(contract.columns).toHaveLength(contract.values.length);
      expect(contract.columns).not.toContain('شناسه');
      expect(contract.columns).not.toContain('وضعیت');
      const money = await client.hrRecordAmount.findFirst({
        where: { recordId: contract.id },
      });
      expect(money?.amount.toFixed(4)).toBe('1234.1250');
      expect(money?.currency).toBe('IRR');
      const masked = await service.getRecord(contract.id, reader);
      expect(masked.values.every((value) => value === '••••')).toBe(true);
      await expect(
        service.createRecord(
          {
            section: 'contracts',
            tab: 'amendments',
            employeeId: employee.id,
            values: [employee.name, 'fake', 'تمدید', '2027-01-01', 'شرح', 'v2'],
          },
          key(),
          admin,
        ),
      ).rejects.toThrow('والد');
      const child = await service.createRecord(
        {
          section: 'contracts',
          tab: 'amendments',
          employeeId: employee.id,
          parentId: contract.id,
          values: [
            employee.name,
            contract.code,
            'تمدید',
            '2027-01-01',
            'شرح',
            'v2',
          ],
        },
        key(),
        admin,
      );
      await expect(
        service.updateRecord(
          child.id,
          { version: 1, parentId: randomUUID() },
          admin,
        ),
      ).rejects.toThrow('والد');
      await expect(service.deleteRecord(contract.id, 1, admin)).rejects.toThrow(
        'وابسته',
      );
      await expect(service.getRecord(contract.id, outsider)).rejects.toThrow(
        'محدوده',
      );
      expect(
        (
          await service.listRecords(
            { parentId: contract.id, page: '1', pageSize: '10' },
            admin,
          )
        ).items[0]?.id,
      ).toBe(child.id);
    });
    it('persists soft deletion and notification reads without leaking another branch', async () => {
      const record = await service.createRecord(
        {
          section: 'organization',
          tab: 'grades',
          values: ['Synthetic Grade', '1', '1', 'Test', '2026-09-01'],
        },
        key(),
        admin,
      );
      await service.deleteRecord(record.id, record.version, admin);
      expect(
        (await client.hrRecord.findUnique({ where: { id: record.id } }))
          ?.deletedAt,
      ).not.toBeNull();
      await expect(service.getRecord(record.id, admin)).rejects.toThrow();
      const notifications = await service.notifications(self);
      expect(notifications.length).toBeGreaterThan(0);
      await service.readNotification(notifications[0]!.id, self);
      expect((await service.notifications(self))[0]?.readAt).not.toBeNull();
      expect(await service.notifications(outsider)).toHaveLength(0);
    });
    it('rejects fake financial outcomes and unsupported storage payloads', async () => {
      await expect(
        service.createRecord(
          { section: 'finance', tab: 'payments', values: [] },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      await expect(
        service.createRecord(
          {
            section: 'time',
            tab: 'leave',
            employeeId: employee.id,
            values: [
              employee.name,
              'استحقاقی',
              '2026-09-20',
              '2026-09-21',
              '2',
              '—',
            ],
            status: 'پرداخت‌شده',
          },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      await request(app.getHttpServer())
        .post('/api/v1/hr/employees')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', key())
        .send({
          ...employeeInput('Bad'),
          photoDataUrl: 'data:image/png;base64,abc',
        })
        .expect(400);
    });
    it('processes overnight attendance in UTC and blocks closed-period clock edits', async () => {
      const night = await service.createEmployee(
        employeeInput('Synthetic Night', { branchId: branchB }),
        key(),
        admin,
      );
      await service.createRecord(
        {
          branchId: branchB,
          section: 'time',
          tab: 'shift',
          employeeId: night.id,
          values: [
            'شیفت شب',
            '22:00',
            '06:00',
            '0',
            '8',
            'آزمایشی',
            night.name,
            '2026-09-01',
            '2026-09-30',
          ],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const entry = await service.createRecord(
        {
          branchId: branchB,
          section: 'time',
          tab: 'checkins',
          employeeId: night.id,
          values: [night.name, '2026-09-01', '22:10', 'ورود', 'دستی', branchB],
          status: 'معتبر',
        },
        key(),
        admin,
      );
      await service.createRecord(
        {
          branchId: branchB,
          section: 'time',
          tab: 'checkins',
          employeeId: night.id,
          values: [night.name, '2026-09-02', '05:50', 'خروج', 'دستی', branchB],
          status: 'معتبر',
        },
        key(),
        admin,
      );
      expect(entry.data.startsAt).toBe('2026-09-01T18:40:00.000Z');
      const processed = await service.processAttendance(
        { branchId: branchB, date: '2026-09-01' },
        key(),
        admin,
      );
      expect(processed.exceptions).toBe(0);
      const record = (
        await service.listRecords(
          { branchId: branchB, section: 'time', tab: 'attendance' },
          admin,
        )
      ).items[0]!;
      expect(record.values.slice(3)).toEqual(['7:40', '10', '10']);
      expect(record.data.workedMinutes).toBe(460);
      await expect(
        service.closeAttendance(
          { branchId: branchB, from: '2026-09-01', to: '2026-09-02' },
          key(),
          admin,
        ),
      ).rejects.toThrow('تمام');
      expect(
        (
          await service.closeAttendance(
            { branchId: branchB, from: '2026-09-01', to: '2026-09-01' },
            key(),
            admin,
          )
        ).closed,
      ).toBe(true);
      await expect(
        service.deleteRecord(entry.id, entry.version, admin),
      ).rejects.toThrow('بسته');
      await expect(
        service.updateRecord(
          entry.id,
          {
            version: entry.version,
            values: [
              night.name,
              '2026-09-01',
              '22:20',
              'ورود',
              'دستی',
              branchB,
            ],
          },
          admin,
        ),
      ).rejects.toThrow('بسته');
      await expect(
        service.processAttendance(
          { branchId: branchB, date: '2026-09-01' },
          key(),
          admin,
        ),
      ).rejects.toThrow('بسته');
    });
    it('filters titles, business dates and expiry before pagination without sensitive-search leaks', async () => {
      const rows = await service.listRecords(
        {
          section: 'contracts',
          tab: 'active',
          search: 'تعهد آزمایشی',
          from: '2026-01-01',
          to: '2026-01-01',
          pageSize: '1',
        },
        admin,
      );
      expect(rows.total).toBe(1);
      expect(rows.items).toHaveLength(1);
      expect(
        (
          await service.listRecords(
            { section: 'contracts', tab: 'active', search: 'تعهد آزمایشی' },
            reader,
          )
        ).total,
      ).toBe(0);
      expect(
        (
          await service.listRecords(
            { section: 'contracts', tab: 'active', from: '2027-01-01' },
            admin,
          )
        ).total,
      ).toBe(0);
    });
    it('allows scoped organization reparenting and rejects cycles', async () => {
      const input = {
        section: 'organization',
        tab: 'units',
        values: ['واحد آزمایشی', 'واحد', branchA, '—', '—', '2026-01-01'],
      };
      const parent = await service.createRecord(input, key(), admin),
        child = await service.createRecord(
          { ...input, parentId: parent.id },
          key(),
          admin,
        );
      await expect(
        service.updateRecord(
          parent.id,
          { version: 1, parentId: child.id },
          admin,
        ),
      ).rejects.toThrow('چرخه');
      const moved = await service.updateRecord(
        child.id,
        { version: 1, parentId: null },
        admin,
      );
      expect(moved.parentId).toBeNull();
      const restored = await service.updateRecord(
        child.id,
        { version: moved.version, parentId: parent.id },
        admin,
      );
      expect(restored.parentId).toBe(parent.id);
    });
    it('links employee companies separately from IAM scope and keeps company moves effective-dated', async () => {
      const first = await service.createRecord(
        {
          section: 'organization',
          tab: 'branches',
          values: ['نیایش سیر', 'شرکت نیایش سیر', 'تهران', '—', '2026-01-01'],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const second = await service.createRecord(
        {
          section: 'organization',
          tab: 'branches',
          values: [
            'جهان باستان',
            'شرکت جهان باستان',
            'تهران',
            '—',
            '2026-01-01',
          ],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const person = await service.createEmployee(
        employeeInput('Synthetic Company Employee', {
          organizationBranchId: first.id,
        }),
        key(),
        admin,
      );
      expect(person.companyName).toBe('نیایش سیر');
      expect(person.branchId).toBe(branchA);
      const companyRecords = await service.listRecords(
        { organizationBranchId: first.id },
        admin,
      );
      expect(
        companyRecords.items.some((row) => row.employeeId === person.id),
      ).toBe(true);
      expect(companyRecords.items.some((row) => row.id === first.id)).toBe(
        true,
      );
      expect(companyRecords.items.some((row) => row.id === second.id)).toBe(
        false,
      );
      await expect(
        service.listRecords({ organizationBranchId: first.id }, outsider),
      ).rejects.toThrow();
      await expect(
        service.updateEmployee(
          person.id,
          { version: person.version, organizationBranchId: second.id },
          admin,
        ),
      ).rejects.toThrow('انتقال');
      await service.createRecord(
        {
          section: 'lifecycle',
          tab: 'transfer',
          employeeId: person.id,
          values: [
            person.name,
            branchA,
            person.unit,
            branchA,
            'عملیات دیگر',
            '2026-06-01',
          ],
          data: { targetBranchId: branchA, organizationBranchId: second.id },
          status: 'تأییدشده',
        },
        key(),
        admin,
      );
      const updated = (await service.bootstrap(admin)).employees.find(
        (row) => row.id === person.id,
      )!;
      expect(updated.companyName).toBe('جهان باستان');
      expect(updated.branchId).toBe(branchA);
      await expect(
        client.hrEmployee.update({
          where: { id: person.id },
          data: { branchId: branchB },
        }),
      ).rejects.toThrow();
    });
    it('records signed contract copies through Documents, activates in range and ends with audited reason', async () => {
      const person = await service.createEmployee(
        employeeInput('Synthetic Contract State'),
        key(),
        admin,
      );
      const body = {
        section: 'contracts',
        tab: 'active',
        employeeId: person.id,
        status: 'تأییدشده',
        values: [
          person.name,
          'TEST-SIGN',
          'Synthetic A',
          'تمام‌وقت',
          '2025-01-01',
          '2030-12-31',
          person.position,
          '1000.00',
          'IRR',
          'تعهد',
          'یک سال',
          'داوری',
        ],
      };
      const contract = await service.createRecord(body, key(), admin);
      await expect(service.createRecord(body, key(), admin)).rejects.toThrow(
        'هم‌پوشان',
      );
      const nda = await service.createRecord(
        {
          ...body,
          values: body.values.map((value, index) =>
            index === 3 ? 'محرمانگی' : value,
          ),
        },
        key(),
        admin,
      );
      expect(nda.id).not.toBe(contract.id);
      await expect(
        service.contractState(
          contract.id,
          { version: 1, state: 'ACTIVE' },
          key(),
          admin,
        ),
      ).rejects.toThrow('ترتیب');
      await expect(
        service.contractState(
          contract.id,
          { version: 1, state: 'SIGNED' },
          key(),
          admin,
        ),
      ).rejects.toThrow('مرجع');
      const type = await client.documentType.create({
        data: {
          code: 'HR_SIGNED_TEST',
          name: 'Synthetic signed copy',
          domain: 'HUMAN_RESOURCES',
          allowedMimeTypes: ['application/pdf'],
        },
      });
      const document = await client.document.create({
        data: {
          title: 'Synthetic signed contract',
          documentTypeId: type.id,
          branchId: branchA,
          ownerUserId: admin.userId,
          sourceModule: 'HUMAN_RESOURCES',
          createdByUserId: admin.userId,
          updatedByUserId: admin.userId,
        },
      });
      const documentVersion = await client.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          storageObjectKey: `test/${randomUUID()}`,
          originalFileName: 'signed.pdf',
          safeDownloadName: 'signed.pdf',
          detectedMimeType: 'application/pdf',
          extension: '.pdf',
          sizeBytes: 5,
          sha256: 'a'.repeat(64),
          scanStatus: 'CLEAN',
          versionNote: 'Synthetic fixture',
          createdByUserId: admin.userId,
        },
      });
      await client.document.update({
        where: { id: document.id },
        data: { currentVersionId: documentVersion.id, currentVersionNumber: 1 },
      });
      const signedKey = key(),
        signedInput = {
          version: 1,
          state: 'SIGNED',
          signedDocumentId: document.id,
        };
      const signed = await service.contractState(
        contract.id,
        signedInput,
        signedKey,
        admin,
      );
      expect(signed.data.contractState).toBe('SIGNED');
      expect(
        (
          await service.contractState(
            contract.id,
            signedInput,
            signedKey,
            admin,
          )
        ).version,
      ).toBe(signed.version);
      expect(
        (
          await client.hrRecord.findUniqueOrThrow({
            where: { id: contract.id },
          })
        ).documentId,
      ).toBe(document.id);
      await expect(
        service.updateRecord(
          contract.id,
          { version: signed.version, data: { contractState: 'ACTIVE' } },
          admin,
        ),
      ).rejects.toThrow();
      await request(app.getHttpServer())
        .post(`/api/v1/hr/records/${contract.id}/contract-state`)
        .set('Cookie', selfCookie)
        .set('Idempotency-Key', key())
        .send({ version: signed.version, state: 'ACTIVE' })
        .expect(403);
      const active = await service.contractState(
        contract.id,
        { version: signed.version, state: 'ACTIVE' },
        key(),
        admin,
      );
      expect(active.data.contractState).toBe('ACTIVE');
      await expect(
        service.contractState(
          contract.id,
          { version: active.version, state: 'ENDED' },
          key(),
          admin,
        ),
      ).rejects.toThrow('دلیل');
      const ended = await service.contractState(
        contract.id,
        {
          version: active.version,
          state: 'ENDED',
          reason: 'پایان توافقی آزمایشی',
        },
        key(),
        admin,
      );
      expect(ended.data.contractState).toBe('ENDED');
      expect(
        await client.hrAuditEvent.count({
          where: { recordId: contract.id, action: 'contract.state' },
        }),
      ).toBe(3);
      await expect(
        client.document.delete({ where: { id: document.id } }),
      ).rejects.toThrow();
    });
    it('keeps explicit HR companies consistent across organizational ancestry, moves and deletion', async () => {
      const company = async (name: string) =>
        service.createRecord(
          {
            section: 'organization',
            tab: 'branches',
            values: [name, name, 'Test', '—', '2026-01-01'],
            status: 'فعال',
          },
          key(),
          admin,
        );
      const first = await company('Synthetic graph company A'),
        second = await company('Synthetic graph company B');
      const unit = async (
        name: string,
        organizationBranchId?: string,
        parentId?: string,
      ) =>
        service.createRecord(
          {
            section: 'organization',
            tab: 'units',
            values: [name, 'واحد', 'Synthetic A', '—', 'Test', '2026-01-01'],
            data: organizationBranchId ? { organizationBranchId } : {},
            ...(parentId ? { parentId } : {}),
          },
          key(),
          admin,
        );
      const rootA = await unit('Root A', first.id),
        rootB = await unit('Root B', second.id);
      await expect(
        unit('Invalid cross company', second.id, rootA.id),
      ).rejects.toThrow('همان شرکت');
      const inherited = await unit('Inherited company', undefined, rootA.id);
      expect(inherited.data.organizationBranchId).toBe(first.id);
      await expect(
        service.updateRecord(
          inherited.id,
          { version: inherited.version, parentId: rootB.id },
          admin,
        ),
      ).rejects.toThrow('همان شرکت');
      await expect(
        service.updateRecord(
          rootA.id,
          { version: rootA.version, data: { organizationBranchId: second.id } },
          admin,
        ),
      ).rejects.toThrow('زیرمجموعه');
      await expect(
        service.updateRecord(
          inherited.id,
          {
            version: inherited.version,
            data: { organizationBranchId: second.id },
          },
          admin,
        ),
      ).rejects.toThrow('همان شرکت');
      await expect(
        service.deleteRecord(first.id, first.version, admin),
      ).rejects.toThrow('وابسته');
      await expect(
        service.updateRecord(
          first.id,
          { version: first.version, status: 'غیرفعال' },
          admin,
        ),
      ).rejects.toThrow('وابسته');
    });
    it('derives correction current hours from actual punches and rejects mismatched requested dates', async () => {
      const person = await service.createEmployee(
        employeeInput('Synthetic Correction'),
        key(),
        admin,
      );
      for (const [time, kind] of [
        ['08:00', 'ورود'],
        ['17:00', 'خروج'],
      ])
        await service.createRecord(
          {
            section: 'time',
            tab: 'checkins',
            employeeId: person.id,
            values: [
              person.name,
              '2026-09-10',
              time!,
              kind!,
              'Test',
              'Synthetic A',
            ],
          },
          key(),
          admin,
        );
      const body = {
        section: 'time',
        tab: 'corrections',
        employeeId: person.id,
        values: [
          person.name,
          '2026-09-10',
          'FAKE 999 hours',
          'FAKE request',
          'Synthetic correction',
          'Test',
        ],
        data: {
          startsAt: '2026-09-10T05:30:00.000Z',
          endsAt: '2026-09-10T11:30:00.000Z',
        },
        status: 'پیش‌نویس',
      };
      const correction = await service.createRecord(body, key(), admin);
      expect(correction.values[2]).toBe('9:00');
      expect(correction.values[3]).toBe('09:00 تا 15:00');
      const edit = await service.updateRecord(
        correction.id,
        { version: 1, values: body.values },
        admin,
      );
      expect(edit.values[2]).toBe('9:00');
      await expect(
        service.createRecord(
          {
            ...body,
            data: {
              ...body.data,
              startsAt: '2026-09-11T05:30:00.000Z',
              endsAt: '2026-09-11T11:30:00.000Z',
            },
          },
          key(),
          admin,
        ),
      ).rejects.toThrow('روز کارکرد');
      await service.updateRecord(
        correction.id,
        { version: edit.version, status: 'تأییدشده' },
        admin,
      );
      const next = await service.createRecord(
        { ...body, section: 'requests', tab: 'attendance' },
        key(),
        admin,
      );
      expect(next.values[2]).toBe('6:00');
    });
    it('allows a current direct manager to approve only their team', async () => {
      const managerActor = (
        await actor('hr_test_manager', ['hr.team', 'hr.approve'], [branchA])
      ).actor;
      const manager = await service.createEmployee(
        employeeInput('Synthetic Manager', { userId: managerActor.userId }),
        key(),
        admin,
      );
      const report = await service.createEmployee(
        employeeInput('Synthetic Report', { managerId: manager.id }),
        key(),
        admin,
      );
      await service.grantLeave(
        {
          employeeId: report.id,
          type: 'استحقاقی',
          days: '5',
          year: 2026,
          reason: 'Test grant',
        },
        key(),
        admin,
      );
      const request = await service.createRecord(
        {
          section: 'time',
          tab: 'leave',
          employeeId: report.id,
          values: [
            report.name,
            'استحقاقی',
            '2026-10-01',
            '2026-10-01',
            '1',
            '—',
          ],
          status: 'در انتظار تأیید',
        },
        key(),
        admin,
      );
      expect(
        (
          await service.updateRecord(
            request.id,
            { version: request.version, status: 'تأییدشده' },
            managerActor,
          )
        ).status,
      ).toBe('تأییدشده');
      await expect(service.getRecord(leave.id, managerActor)).rejects.toThrow(
        'محدوده',
      );
      const own = await service.createRecord(
        {
          section: 'time',
          tab: 'leave',
          employeeId: manager.id,
          values: [
            manager.name,
            'استحقاقی',
            '2026-10-01',
            '2026-10-01',
            '1',
            '—',
          ],
          status: 'در انتظار تأیید',
        },
        key(),
        admin,
      );
      await expect(
        service.updateRecord(
          own.id,
          { version: own.version, status: 'تأییدشده' },
          managerActor,
        ),
      ).rejects.toThrow('خود');
    });
    it('applies due approved job changes automatically on authorized reads without replay', async () => {
      const before = await client.hrRecord.count({
        where: {
          employeeId: employee.id,
          section: 'employee',
          tab: 'assignment',
        },
      });
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2099-01-02T00:00:00Z'));
        const snapshot = await service.bootstrap(admin);
        expect(
          snapshot.employees.find((row) => row.id === employee.id)?.position,
        ).toBe('سرپرست');
        expect(snapshot.workflowWarnings).toEqual([]);
        await service.bootstrap(admin);
        expect(
          await client.hrRecord.count({
            where: {
              employeeId: employee.id,
              section: 'employee',
              tab: 'assignment',
            },
          }),
        ).toBe(before + 1);
      } finally {
        vi.useRealTimers();
      }
    });
  },
);
