import { dashboardPeriods } from './hr-dashboard.domain';
import { revealHrValues } from './hr-private-values';
import { getHrResource } from '@nora/contracts';
import { zipSync, strToU8, unzipSync } from 'fflate';
import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  HR_PERMISSION_CODES,
  type AuthenticatedActor,
  type HrEmployeeDto,
  type HrRecordDto,
  type IamPermissionCode,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
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
import { MfaTotpService } from '../iam/mfa-totp';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrDirectoryService } from './hr-directory.service';
import { HrDirectoryController } from './hr-directory.module';
import { MasterHrDirectory } from '../master-data/master-hr-directory';
import { HrConnectionsService } from './hr-connections.service';
import { HrConnectionsController } from './hr-connections.controller';

const databaseName = `nora_hr_test_${randomUUID().replaceAll('-', '')}`;
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
let connections: HrConnectionsService;
let directory: HrDirectoryService;
let employee: HrEmployeeDto, otherEmployee: HrEmployeeDto, leave: HrRecordDto;
const key = () => randomUUID();
function sql(database: string, input: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'nora-postgres-1',
      'psql',
      '-U',
      'nora_local',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: process.env.NORA_HR_TEST_SLOW_HOST === '1' ? 120000 : 60000,
    },
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
    cookie: `nora_access=${login.accessToken}`,
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

describe.skipIf(process.env.NORA_RUN_HR_POSTGRES_TESTS !== '1')(
  'HR real authenticated PostgreSQL commands',
  () => {
    beforeAll(
      async () => {
        const env = parseEnv(
          readFileSync(
            process.env.NORA_HR_TEST_ENV_FILE ?? resolve(process.cwd(), '.env'),
            'utf8',
          ),
        );
        const url = new URL(env.DATABASE_URL!);
        if (
          !['localhost', '127.0.0.1'].includes(url.hostname) ||
          url.port !== (process.env.NORA_HR_TEST_PORT ?? '55432') ||
          !/^nora_hr_test_[a-f0-9]{32}$/.test(databaseName)
        )
          throw new Error(
            'Only a randomly named isolated local HR test database is permitted.',
          );
        sql('postgres', `CREATE DATABASE "${databaseName}";`);
        created = true;
        const migrationsDirectory = resolve(
          process.cwd(),
          '../../packages/database/prisma/migrations',
        );
        sql(
          databaseName,
          readdirSync(migrationsDirectory, { withFileTypes: true })
            .filter((item) => item.isDirectory())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) =>
              readFileSync(
                resolve(migrationsDirectory, item.name, 'migration.sql'),
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
            signOptions: { issuer: 'nora-api', audience: 'nora-web' },
            verifyOptions: { issuer: 'nora-api', audience: 'nora-web' },
          }),
          new MfaTotpService(new ConfigService(env)),
        );
        directory = new HrDirectoryService(
          database,
          iam,
          new MasterHrDirectory(database),
        );
        service = new HrService(
          database,
          iam,
          new DocumentsService(
            new DocumentsRepository(
              database,
              new NotificationsService(new NotificationsRepository(database)),
            ),
            {} as LocalDocumentStorage,
            { available: false } as DocumentsScanProcessor,
            iam,
            directory,
          ),
          directory,
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
        await client.masterCurrency.create({
          data: {
            code: 'IRR',
            name: 'Synthetic Rial',
            createdByUserId: admin.userId,
            updatedByUserId: admin.userId,
          },
        });
        const selfResult = await actor('hr_test_self', ['hr.self'], [branchA]);
        self = selfResult.actor;
        selfCookie = selfResult.cookie;
        outsider = (
          await actor('hr_test_outsider', ['hr.read', 'hr.manage'], [branchB])
        ).actor;
        reader = (await actor('hr_test_reader', ['hr.read'], [branchA])).actor;
        const module = await Test.createTestingModule({
          controllers: [
            HrController,
            HrConnectionsController,
            HrDirectoryController,
          ],
          providers: [
            AuthGuard,
            { provide: IamService, useValue: iam },
            { provide: HrService, useValue: service },
            { provide: HrDirectoryService, useValue: directory },
            {
              provide: HrConnectionsService,
              useValue: (connections = new HrConnectionsService(database)),
            },
          ],
        }).compile();
        app = module.createNestApplication();
        app.setGlobalPrefix('api/v1');
        await app.init();
      },
      process.env.NORA_HR_TEST_SLOW_HOST === '1' ? 180000 : 60000,
    );
    afterAll(async () => {
      if (app) await app.close();
      if (client) await client.$disconnect();
      if (created && /^nora_hr_test_[a-f0-9]{32}$/.test(databaseName))
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
    it('persists employee extensions through create, replay, partial edit and clear with scope and CAS guards', async () => {
      const input = employeeInput('Synthetic Extension', { extension: '۰۰۱۲' });
      const commandKey = key();
      const response = await request(app.getHttpServer())
        .post('/api/v1/hr/employees')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', commandKey)
        .send(input)
        .expect(201);
      const target = response.body as HrEmployeeDto;
      expect(target.extension).toBe('0012');
      expect(
        (await service.createEmployee(input, commandKey, admin)).extension,
      ).toBe('0012');
      expect(
        await client.hrRecord.count({
          where: {
            employeeId: target.id,
            tab: 'internalContact',
            deletedAt: null,
          },
        }),
      ).toBe(1);
      expect(
        (await service.bootstrap(reader)).employees.find(
          (e) => e.id === target.id,
        )?.extension,
      ).toBe('0012');
      const edited = await service.updateEmployee(
        target.id,
        { version: 1, extension: '0024' },
        admin,
      );
      expect(edited.extension).toBe('0024');
      await expect(
        service.updateEmployee(
          target.id,
          { version: 1, extension: '999' },
          admin,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateEmployee(
          target.id,
          { version: 2, extension: '888' },
          outsider,
        ),
      ).rejects.toThrow();
      const partial = await service.updateEmployee(
        target.id,
        { version: 2, kind: 'پاره‌وقت' },
        admin,
      );
      expect(partial.extension).toBe('0024');
      await expect(
        service.updateEmployee(
          target.id,
          { version: 3, extension: '*123' },
          admin,
        ),
      ).rejects.toThrow();
      const cleared = await service.updateEmployee(
        target.id,
        { version: 3, extension: '' },
        admin,
      );
      expect(cleared.extension).toBe('');
      expect(
        await client.hrRecord.count({
          where: {
            employeeId: target.id,
            tab: 'internalContact',
            deletedAt: null,
          },
        }),
      ).toBe(0);
      for (const extension of ['abc', '1'.repeat(21), 123])
        await expect(
          service.createEmployee(
            employeeInput('Invalid Extension', { extension }),
            key(),
            admin,
          ),
        ).rejects.toThrow();
      expect(
        await client.hrEmployee.count({ where: { name: 'Invalid Extension' } }),
      ).toBe(0);
      await expect(
        service.createRecord(
          {
            section: 'employee',
            tab: 'internalContact',
            employeeId: target.id,
            values: ['999'],
          },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      await client.hrRecord.updateMany({
        where: { employeeId: target.id },
        data: { deletedAt: new Date() },
      });
      await client.hrEmployee.update({
        where: { id: target.id },
        data: { deletedAt: new Date() },
      });
    });
    it('loses exactly one stale concurrent edit and rejects unknown job titles', async () => {
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
      ).rejects.toThrow('عنوان شغلی');
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
          { version: active.version, state: 'ENDED', reason: 'x'.repeat(1001) },
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
    it('links applicants to authorized openings and persists changes without trusting copied job text', async () => {
      const opening = await service.createRecord(
        {
          branchId: branchA,
          section: 'recruitment',
          tab: 'staffing',
          values: ['2026', 'تهران', 'فروش', '1', '2', '', 'مدیر'],
        },
        key(),
        admin,
      );
      const next = await service.createRecord(
        {
          branchId: branchA,
          section: 'recruitment',
          tab: 'staffing',
          values: ['2026', 'تهران', 'فروش', '1', '2', '', 'مدیر'],
        },
        key(),
        admin,
      );
      const applicant = await service.createRecord(
        {
          branchId: branchA,
          section: 'recruitment',
          tab: 'applicants',
          parentId: opening.id,
          values: [
            'متقاضی آزمایش ارتباط',
            'عنوان ناسازگار',
            '',
            '',
            '',
            '2026-09-09',
            'دریافت رزومه',
            '',
          ],
        },
        key(),
        admin,
      );
      expect(applicant.parentId).toBe(opening.id);
      expect(applicant.values[1]).toBe('برنامه 2026 - فروش');
      const updated = await service.updateRecord(
        applicant.id,
        { version: applicant.version, parentId: next.id },
        admin,
      );
      expect(updated.parentId).toBe(next.id);
      expect(updated.values[1]).toBe('برنامه 2026 - فروش');
      const otherRecruiter = (
        await actor(
          'hr_test_other_recruiter',
          ['hr.read', 'hr.manage', 'hr.sensitive'],
          [branchB],
        )
      ).actor;
      const foreign = await service.createRecord(
        {
          branchId: branchB,
          section: 'recruitment',
          tab: 'staffing',
          values: ['2026', 'تهران', 'فروش', '1', '2', '', 'مدیر'],
        },
        key(),
        otherRecruiter,
      );
      await expect(
        service.updateRecord(
          applicant.id,
          { version: updated.version, parentId: foreign.id },
          admin,
        ),
      ).rejects.toThrow();
    });
    it('persists expense mission links and rejects scope, stale-version and approval bypasses', async () => {
      const company = (name: string) =>
        service.createRecord(
          {
            branchId: branchA,
            section: 'organization',
            tab: 'branches',
            values: [name, name, 'Test', '', '2026-01-01'],
            status: 'فعال',
          },
          key(),
          admin,
        );
      const companyA = await company('Mission company A');
      const companyB = await company('Mission company B');
      const worker = await service.createEmployee(
        employeeInput('Mission worker', {
          organizationBranchId: companyA.id,
        }),
        key(),
        admin,
      );
      const missionInput = {
        branchId: branchA,
        section: 'expenses',
        tab: 'mission',
        employeeId: worker.id,
        values: [
          worker.name,
          'شیراز',
          '2026-10-01',
          '2026-10-03',
          'جلسه آزمایشی',
          '',
        ],
        data: { organizationBranchId: companyA.id },
      };
      const current = await service.createRecord(missionInput, key(), admin);
      const legacy = await service.createRecord(
        { ...missionInput, section: 'time', data: {} },
        key(),
        admin,
      );
      const wrongCompany = await service.createRecord(
        { ...missionInput, data: { organizationBranchId: companyB.id } },
        key(),
        admin,
      );
      const wrongWorker = await service.createRecord(
        { ...missionInput, employeeId: otherEmployee.id },
        key(),
        admin,
      );
      const expense = {
        branchId: branchA,
        employeeId: worker.id,
        section: 'expenses',
        tab: 'claims',
        values: [worker.name, 'رفت‌وآمد', '2026-10-01', 'IRR', '1200', '', ''],
        data: { organizationBranchId: companyA.id, currency: 'IRR' },
      };
      const direct = await service.createRecord(
        { ...expense, parentId: current.id },
        key(),
        admin,
      );
      expect(direct.parentId).toBe(current.id);
      await expect(
        service.createRecord(
          { ...expense, parentId: wrongCompany.id },
          key(),
          admin,
        ),
      ).rejects.toThrow('شرکت');
      await expect(
        service.createRecord(
          { ...expense, parentId: wrongWorker.id },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      await expect(
        service.createRecord(
          { ...expense, parentId: companyA.id },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      const independent = await service.createRecord(expense, key(), admin);
      expect(independent.parentId).toBeNull();
      const linked = await service.updateRecord(
        independent.id,
        { version: 1, parentId: current.id },
        admin,
      );
      expect((await service.getRecord(linked.id, admin)).parentId).toBe(
        current.id,
      );
      expect(
        (await service.listRecords({ parentId: current.id }, admin)).items.map(
          (r) => r.id,
        ),
      ).toContain(linked.id);
      await expect(
        service.updateRecord(
          linked.id,
          { version: 1, parentId: legacy.id },
          admin,
        ),
      ).rejects.toThrow('دیگری');
      await expect(
        service.updateRecord(
          linked.id,
          { version: linked.version, parentId: wrongCompany.id },
          admin,
        ),
      ).rejects.toThrow('شرکت');
      await expect(
        service.updateRecord(
          linked.id,
          { version: linked.version, parentId: wrongWorker.id },
          admin,
        ),
      ).rejects.toThrow('کارمند');
      await expect(
        service.updateRecord(
          linked.id,
          { version: linked.version, parentId: legacy.id },
          reader,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateRecord(
          linked.id,
          { version: linked.version, parentId: legacy.id },
          outsider,
        ),
      ).rejects.toThrow();
      const replaced = await service.updateRecord(
        linked.id,
        { version: linked.version, parentId: legacy.id },
        admin,
      );
      expect(replaced.parentId).toBe(legacy.id);
      const cleared = await service.updateRecord(
        linked.id,
        { version: replaced.version, parentId: null },
        admin,
      );
      expect((await service.getRecord(cleared.id, admin)).parentId).toBeNull();
      await expect(
        service.updateRecord(
          cleared.id,
          {
            version: cleared.version,
            parentId: current.id,
            status: 'تأییدشده',
          },
          admin,
        ),
      ).rejects.toThrow('جدا');
      const approved = await service.updateRecord(
        cleared.id,
        { version: cleared.version, status: 'تأییدشده' },
        admin,
      );
      await expect(
        service.updateRecord(
          cleared.id,
          { version: approved.version, parentId: current.id },
          admin,
        ),
      ).rejects.toThrow('نهایی');
      await expect(
        service.updateRecord(
          cleared.id,
          {
            version: approved.version,
            parentId: current.id,
            status: 'لغوشده',
            data: { reason: 'Test' },
          },
          admin,
        ),
      ).rejects.toThrow('بدون تغییر');
      const advance = await service.createRecord(
        {
          ...expense,
          tab: 'advances',
          parentId: current.id,
          values: [
            worker.name,
            'forged reference',
            'IRR',
            '1200',
            '2026-10-01',
            'نقدی',
          ],
        },
        key(),
        admin,
      );
      expect(advance.values[1]).toBe(current.code);
      const advanceMoved = await service.updateRecord(
        advance.id,
        { version: advance.version, parentId: legacy.id },
        admin,
      );
      expect(advanceMoved.values[1]).toBe(legacy.code);
      const advanceCleared = await service.updateRecord(
        advance.id,
        { version: advanceMoved.version, parentId: null },
        admin,
      );
      expect(advanceCleared.values[1]).toBe('');
      expect(
        await client.hrAuditEvent.count({
          where: { recordId: linked.id, action: 'record.update' },
        }),
      ).toBeGreaterThanOrEqual(3);
    });
    it('persists and isolates referrals, replies, idempotency, deadlines and source references', async () => {
      const receiver = await actor(
        'hr_connection_finance',
        ['hr.connections.finance.receive'],
        [branchA],
      );
      const wrongBranch = await actor(
        'hr_connection_other',
        ['hr.connections.finance.receive'],
        [branchB],
      );
      const worker = await service.createEmployee(
        employeeInput('Synthetic Connection Worker'),
        key(),
        admin,
      );
      const source = await service.createRecord(
        {
          branchId: branchA,
          employeeId: worker.id,
          section: 'employee',
          tab: 'contact',
          values: ['تلفن', 'PRIVATE_NOT_SHARED***', '2026-01-01', 'Synthetic'],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const input = {
        target: 'finance',
        sourceId: source.id,
        sourceVersion: source.version,
        title: 'Synthetic review',
        message: 'Only explicitly shared text',
        dueAt: '2099-12-01T20:29:59.000Z',
      };
      await request(app.getHttpServer())
        .get('/api/v1/hr/connections')
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/hr/connections')
        .set('Cookie', selfCookie)
        .expect(403);
      await expect(connections.create(input, key(), reader)).rejects.toThrow();
      await expect(
        connections.create({ ...input, sourceVersion: 999 }, key(), admin),
      ).rejects.toThrow('تغییر');
      const idempotency = key();
      const [one, replay] = await Promise.all([
        connections.create(input, idempotency, admin),
        connections.create(input, idempotency, admin),
      ]);
      expect(replay.id).toBe(one.id);
      await expect(
        connections.create(
          { ...input, message: 'changed' },
          idempotency,
          admin,
        ),
      ).rejects.toThrow('محتوای');
      await expect(connections.create(input, key(), admin)).rejects.toThrow(
        'درخواست باز',
      );
      const inbox = await connections.list({}, receiver.actor);
      expect(inbox.items.map((r) => r.id)).toEqual([one.id]);
      expect(inbox.items[0]?.sourceHref).toBeNull();
      expect(JSON.stringify(inbox)).not.toContain('PRIVATE_NOT_SHARED');
      expect((await connections.list({}, wrongBranch.actor)).total).toBe(0);
      expect(
        (await connections.list({ target: 'purchases' }, receiver.actor)).total,
      ).toBe(0);
      expect(
        (await service.listRecords({}, admin)).items.some(
          (r) => r.id === one.id,
        ),
      ).toBe(false);
      await expect(service.getRecord(one.id, admin)).rejects.toThrow();
      await expect(
        service.deleteRecord(source.id, String(source.version), admin),
      ).rejects.toThrow('وابسته');
      await expect(
        connections.decide(
          one.id,
          { version: 1, status: 'IN_REVIEW', note: 'self response' },
          key(),
          admin,
        ),
      ).rejects.toThrow('خود');
      await expect(
        connections.decide(
          one.id,
          { version: 1, status: 'IN_REVIEW', note: 'wrong branch' },
          key(),
          wrongBranch.actor,
        ),
      ).rejects.toThrow();
      await expect(
        connections.decide(
          one.id,
          { version: 1, status: 'ANSWERED', note: 'skip' },
          key(),
          receiver.actor,
        ),
      ).rejects.toThrow('ترتیب');
      const response = await request(app.getHttpServer())
        .post(`/api/v1/hr/connections/${one.id}/response`)
        .set('Cookie', receiver.cookie)
        .set('Idempotency-Key', key())
        .send({ version: 1, status: 'IN_REVIEW', note: 'Review started' })
        .expect(201);
      expect(response.body.status).toBe('IN_REVIEW');
      await expect(
        connections.decide(
          one.id,
          { version: 1, status: 'REJECTED', note: 'stale' },
          key(),
          receiver.actor,
        ),
      ).rejects.toThrow('هم‌زمان');
      const answerKey = key(),
        answer = {
          version: 2,
          status: 'ANSWERED',
          note: 'Reviewed; no payment posted',
        };
      const answered = await connections.decide(
        one.id,
        answer,
        answerKey,
        receiver.actor,
      );
      expect(answered.history).toHaveLength(3);
      expect(
        (await connections.decide(one.id, answer, answerKey, receiver.actor))
          .version,
      ).toBe(3);
      await expect(
        connections.decide(
          one.id,
          { version: 3, status: 'IN_REVIEW', note: 'reopen' },
          key(),
          receiver.actor,
        ),
      ).rejects.toThrow();
      expect(
        (await connections.list({}, admin)).items.find((r) => r.id === one.id)
          ?.response,
      ).toBe(answer.note);
      expect(
        await client.hrNotification.count({
          where: {
            action: 'connection.response',
            targetUserId: admin.userId,
            recordId: source.id,
          },
        }),
      ).toBe(2);
      const another = await connections.create(
        { ...input, target: 'system' },
        key(),
        admin,
      );
      const cancelled = await connections.decide(
        another.id,
        { version: 1, status: 'CANCELLED', note: 'No longer needed' },
        key(),
        admin,
      );
      expect(cancelled.status).toBe('CANCELLED');
      const deadline = await connections.create(
        { ...input, target: 'tasks', dueAt: '2099-12-01T20:29:59.000Z' },
        key(),
        admin,
      );
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2099-12-01T10:00:00Z'));
        expect(
          (await connections.list({ target: 'tasks' }, admin)).counts.overdue,
        ).toBe(0);
        vi.setSystemTime(new Date('2099-12-01T21:00:00Z'));
        expect(
          (await connections.list({ target: 'tasks' }, admin)).counts.overdue,
        ).toBe(1);
      } finally {
        vi.useRealTimers();
      }
      expect(deadline.status).toBe('SUBMITTED');
    }, 30000);
    it('round trips IAM selection through HR and exposes only a scoped minimal directory', async () => {
      const account = await actor(
        'hr_directory_account',
        ['hr.self'],
        [branchA],
      );
      const receiver = await actor(
        'hr_directory_receiver',
        ['hr.directory.read'],
        [branchA],
      );
      const before = await request(app.getHttpServer())
        .get('/api/v1/hr/form-references')
        .set('Cookie', adminCookie)
        .expect(200);
      expect(
        before.body.users.some(
          (u: { id: string }) => u.id === account.actor.userId,
        ),
      ).toBe(true);
      expect(JSON.stringify(before.body)).not.toContain('lastLoginAt');
      const input = employeeInput('Directory canonical employee', {
        userId: account.actor.userId,
      });
      const createdEmployee = await service.createEmployee(input, key(), admin);
      const after = await directory.formReferences(admin);
      expect(
        after.users.find((u) => u.id === account.actor.userId),
      ).toMatchObject({
        unavailableReason: 'LINKED',
      });
      expect(
        (await directory.formReferences(admin, createdEmployee.id)).users.some(
          (u) => u.id === account.actor.userId,
        ),
      ).toBe(true);
      const response = await request(app.getHttpServer())
        .get('/api/v1/hr/directory?search=Directory')
        .set('Cookie', receiver.cookie)
        .expect(200);
      const choice = response.body.employees.find(
        (e: { id: string }) => e.id === createdEmployee.id,
      );
      expect(choice).toEqual({
        id: createdEmployee.id,
        branchId: branchA,
        name: createdEmployee.name,
        personnelCode: createdEmployee.personnelCode,
        unit: createdEmployee.unit,
        position: createdEmployee.position,
        userId: account.actor.userId,
      });
      await request(app.getHttpServer())
        .get('/api/v1/hr/bootstrap')
        .set('Cookie', receiver.cookie)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/hr/directory?branchId=${branchB}`)
        .set('Cookie', receiver.cookie)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/hr/directory')
        .set('Cookie', selfCookie)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/hr/directory')
        .expect(401);
      const linkedSelf = await service.bootstrap(account.actor);
      expect(linkedSelf.employees.map((e) => e.id)).toEqual([
        createdEmployee.id,
      ]);
      const changed = await service.updateEmployee(
        createdEmployee.id,
        {
          version: createdEmployee.version,
          name: 'Directory renamed employee',
        },
        admin,
      );
      expect(
        (
          await directory.employees(
            { search: 'Directory renamed' },
            receiver.actor,
          )
        ).employees[0]?.id,
      ).toBe(createdEmployee.id);
      const unlinked = await service.updateEmployee(
        createdEmployee.id,
        { version: changed.version, userId: null },
        admin,
      );
      expect(unlinked.userId).toBeNull();
      expect((await service.bootstrap(account.actor)).employees).toEqual([]);
      expect(
        (await directory.formReferences(admin)).users.some(
          (u) => u.id === account.actor.userId,
        ),
      ).toBe(true);
      await expect(
        service.updateEmployee(
          createdEmployee.id,
          { version: unlinked.version, userId: outsider.userId },
          admin,
        ),
      ).rejects.toThrow('حساب کاربری فعال در شعبه');
    }, 30000);

    it('paginates employee options without leaking inactive, deleted or other-branch records', async () => {
      const stamp = key();
      await client.hrEmployee.createMany({
        data: Array.from({ length: 54 }, (_, index) => ({
          branchId: index === 53 ? branchB : branchA,
          name: `Directory-page-${stamp}-${index.toString().padStart(2, '0')}`,
          personnelCode: `PAGE-${stamp.slice(0, 8)}-${index}`,
          kind: 'تمام‌وقت',
          unit: 'واحد',
          position: 'سمت',
          grade: 'G1',
          startedAt: new Date('2026-01-01'),
          status: index === 51 ? 'قطع همکاری' : 'فعال',
          ...(index === 52 ? { deletedAt: new Date() } : {}),
        })),
      });
      const first = await directory.employees(
        { branchId: branchA, search: stamp },
        reader,
      );
      const second = await directory.employees(
        { branchId: branchA, search: stamp, page: '2' },
        reader,
      );
      expect(first.employees).toHaveLength(50);
      expect(first.hasMore).toBe(true);
      expect(second.employees).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(
        new Set([...first.employees, ...second.employees].map((e) => e.id))
          .size,
      ).toBe(51);
      await expect(
        directory.employee(first.employees[0]!.id, branchB, admin),
      ).rejects.toThrow();
    });

    it('loads new master currencies in HR and persists Decimal amounts while rejecting inactive currencies', async () => {
      await client.masterCurrency.create({
        data: {
          code: 'XTS',
          name: 'Synthetic reference currency',
          createdByUserId: admin.userId,
          updatedByUserId: admin.userId,
        },
      });
      expect(
        (await directory.formReferences(reader)).currencies.some(
          (c) => c.code === 'XTS',
        ),
      ).toBe(true);
      const worker = await service.createEmployee(
        employeeInput('Currency reference worker'),
        key(),
        admin,
      );
      const input = {
        branchId: branchA,
        employeeId: worker.id,
        section: 'expenses',
        tab: 'claims',
        values: [
          worker.name,
          'رفت‌وآمد',
          '2026-10-01',
          'XTS',
          '1234.25',
          '',
          '',
        ],
        data: { currency: 'XTS' },
      };
      const record = await service.createRecord(input, key(), admin);
      const amount = await client.hrRecordAmount.findFirstOrThrow({
        where: { recordId: record.id },
      });
      expect(amount.currency).toBe('XTS');
      expect(amount.amount.toString()).toBe('1234.25');
      expect((await service.getRecord(record.id, admin)).values[3]).toBe('XTS');
      await client.masterCurrency.update({
        where: { code: 'XTS' },
        data: { isActive: false },
      });
      expect(
        (await directory.formReferences(reader)).currencies.some(
          (c) => c.code === 'XTS',
        ),
      ).toBe(false);
      await expect(service.createRecord(input, key(), admin)).rejects.toThrow(
        'اطلاعات پایه',
      );
      expect(
        await client.hrRecord.count({
          where: { employeeId: worker.id, section: 'expenses', tab: 'claims' },
        }),
      ).toBe(1);
    });

    it('persists an existing Documents reference in HR and rejects cross-branch attachment on create and edit', async () => {
      const type = await client.documentType.create({
        data: {
          code: 'HR_DIRECTORY_DOC',
          name: 'Synthetic archive',
          domain: 'HUMAN_RESOURCES',
          allowedMimeTypes: ['application/pdf'],
        },
      });
      const createDocument = async (branchId: string) => {
        const doc = await client.document.create({
          data: {
            title: 'Synthetic existing archive',
            documentTypeId: type.id,
            branchId,
            ownerUserId: admin.userId,
            sourceModule: 'HUMAN_RESOURCES',
            createdByUserId: admin.userId,
            updatedByUserId: admin.userId,
          },
        });
        const version = await client.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNumber: 1,
            storageObjectKey: `synthetic/${randomUUID()}`,
            originalFileName: 'reference.pdf',
            safeDownloadName: 'reference.pdf',
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
          where: { id: doc.id },
          data: { currentVersionId: version.id, currentVersionNumber: 1 },
        });
        return doc;
      };
      const [local, other] = await Promise.all([
        createDocument(branchA),
        createDocument(branchB),
      ]);
      const worker = await service.createEmployee(
        employeeInput('Document reference worker'),
        key(),
        admin,
      );
      const input = {
        branchId: branchA,
        employeeId: worker.id,
        section: 'expenses',
        tab: 'claims',
        values: [
          worker.name,
          'رفت‌وآمد',
          '2026-10-01',
          'IRR',
          '100',
          `document://${local.id}`,
          '',
        ],
        data: { currency: 'IRR', documentId: local.id },
      };
      const record = await service.createRecord(input, key(), admin);
      expect(
        (await client.hrRecord.findUniqueOrThrow({ where: { id: record.id } }))
          .documentId,
      ).toBe(local.id);
      expect((await service.getRecord(record.id, admin)).data.documentId).toBe(
        local.id,
      );
      await expect(
        service.createRecord(
          { ...input, data: { ...input.data, documentId: other.id } },
          key(),
          admin,
        ),
      ).rejects.toThrow('همان شعبه');
      await expect(
        service.updateRecord(
          record.id,
          { version: record.version, data: { documentId: other.id } },
          admin,
        ),
      ).rejects.toThrow('همان شعبه');
      expect((await service.getRecord(record.id, admin)).data.documentId).toBe(
        local.id,
      );
    });

    it('imports payslip Excel through authenticated multipart without touching Finance', async () => {
      const slipOwner = await actor('radan_slip_owner', ['hr.self'], [branchA]);
      const target = await service.createEmployee(
        employeeInput('Radan Payslip', { userId: slipOwner.actor.userId }),
        key(),
        admin,
      );
      const buffer = Buffer.from(
        zipSync({
          'xl/worksheets/sheet1.xml': strToU8(
            `<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>کد پرسنلی</t></is></c><c r="B1" t="inlineStr"><is><t>خالص</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>${target.personnelCode}</t></is></c><c r="B2"><v>123456789012345.25</v></c></row></sheetData></worksheet>`,
          ),
        }),
      );
      const token = key();
      for (let retry = 0; retry < 2; retry++)
        await request(app.getHttpServer())
          .post('/api/v1/hr/payslips/import')
          .set('Cookie', adminCookie)
          .set('Idempotency-Key', token)
          .field('branchId', branchA)
          .field('year', '1405')
          .field('month', '7')
          .attach('file', buffer, 'pay.xlsx')
          .expect(201);
      const rows = await client.hrRecord.findMany({
        where: {
          employeeId: target.id,
          section: 'payroll',
          tab: 'importedPayslips',
        },
      });
      expect(rows).toHaveLength(1);
      expect(
        (await service.getRecord(rows[0]!.id, slipOwner.actor)).values[4],
      ).toBe('123456789012345.25');
      expect((await service.getRecord(rows[0]!.id, reader)).values[4]).toBe(
        '••••',
      );
      expect((rows[0]!.values as string[])[4]).toBe('123456789012345.25');
      const englishParts = unzipSync(buffer);
      englishParts['xl/worksheets/sheet1.xml'] = strToU8(
        Buffer.from(englishParts['xl/worksheets/sheet1.xml']!)
          .toString('utf8')
          .replace('کد پرسنلی', 'Personnel code'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/hr/payslips/import')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', key())
        .field('branchId', branchA)
        .field('year', '1405')
        .field('month', '8')
        .attach('file', Buffer.from(zipSync(englishParts)), 'english-pay.xlsx')
        .expect(201);
      await expect(
        service.importPayslips(
          { buffer, originalname: 'pay.xlsx' },
          { branchId: branchA, year: 1405, month: 7 },
          key(),
          admin,
        ),
      ).rejects.toThrow('قبلاً');
      await expect(
        service.updateRecord(
          rows[0]!.id,
          { version: 1, values: ['forged'] },
          admin,
        ),
      ).rejects.toThrow();
      await request(app.getHttpServer())
        .post('/api/v1/hr/payslips/import')
        .set('Cookie', selfCookie)
        .set('Idempotency-Key', key())
        .field('branchId', branchA)
        .field('year', '1405')
        .field('month', '8')
        .attach('file', buffer, 'pay.xlsx')
        .expect(403);
    });
    it('links the employee group selector using actual memberships and branch validation', async () => {
      const group = await service.createRecord(
        {
          branchId: branchA,
          section: 'organization',
          tab: 'groups',
          values: ['گروه آزمایش', ''],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const target = await service.createEmployee(
        employeeInput('Radan Group', { groupId: group.id }),
        key(),
        admin,
      );
      expect(
        await client.hrRecord.count({
          where: {
            employeeId: target.id,
            parentId: group.id,
            tab: 'groupMembers',
            status: 'فعال',
          },
        }),
      ).toBe(1);
      await service.updateEmployee(
        target.id,
        { version: target.version, groupId: null },
        admin,
      );
      expect(
        await client.hrRecord.count({
          where: { employeeId: target.id, tab: 'groupMembers', status: 'فعال' },
        }),
      ).toBe(0);
    });

    it('saves device credentials atomically inside the device form without exposing them', async () => {
      const previousKey = process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
      process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 =
        randomBytes(32).toString('base64');
      try {
        const schema = getHrResource('time', 'biometric')!,
          values = schema.columns.map(() => '');
        values[0] = 'Synthetic private device';
        values[schema.columns.indexOf('آدرس دستگاه')] = '127.0.0.1';
        values[schema.columns.indexOf('نوع دستگاه')] = 'ZK';
        const input = {
          branchId: branchA,
          section: 'time',
          tab: 'biometric',
          values,
          status: 'فعال',
          privateData: { networkPassword: ' 0087-synthetic ' },
        };
        const token = key(),
          device = await service.createRecord(input, token, admin);
        expect((await service.createRecord(input, token, admin)).id).toBe(
          device.id,
        );
        expect(JSON.stringify(device)).not.toContain('0087-synthetic');
        expect(JSON.stringify(device.data)).not.toContain('privatePayload');
        let stored = await client.hrRecord.findUniqueOrThrow({
          where: { id: device.id },
        });
        expect(JSON.stringify(stored)).not.toContain('0087-synthetic');
        expect(
          revealHrValues(stored.data, `${branchA}:${device.id}:time.biometric`),
        ).toEqual([' 0087-synthetic ']);
        const changed = await service.updateRecord(
          device.id,
          {
            version: device.version,
            privateData: { networkPassword: 'new-synthetic-secret' },
          },
          admin,
        );
        stored = await client.hrRecord.findUniqueOrThrow({
          where: { id: device.id },
        });
        expect(
          revealHrValues(stored.data, `${branchA}:${device.id}:time.biometric`),
        ).toEqual(['new-synthetic-secret']);
        expect(
          JSON.stringify(await service.getRecord(device.id, reader)),
        ).not.toContain('privatePayload');
        const unchanged = await service.updateRecord(
          device.id,
          { version: changed.version, privateData: { networkPassword: '' } },
          admin,
        );
        const preserved = await client.hrRecord.findUniqueOrThrow({
          where: { id: device.id },
        });
        expect(
          revealHrValues(
            preserved.data,
            `${branchA}:${device.id}:time.biometric`,
          ),
        ).toEqual(['new-synthetic-secret']);
        const audit = await client.hrAuditEvent.findMany({
          where: { recordId: device.id },
        });
        expect(JSON.stringify(audit)).not.toContain('new-synthetic-secret');
        expect(JSON.stringify(audit)).not.toContain('0087-synthetic');
        const manager = (
          await actor('device_manager_no_sensitive', ['hr.manage'], [branchA])
        ).actor;
        await expect(
          service.updateRecord(
            device.id,
            {
              version: unchanged.version,
              privateData: { networkPassword: 'denied' },
            },
            manager,
          ),
        ).rejects.toThrow();
        await service.deleteRecord(device.id, String(unchanged.version), admin);
      } finally {
        if (previousKey === undefined)
          delete process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
        else process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 = previousKey;
      }
    });
    it('atomically creates the Radan personnel identity and contacts with replay, permission and rollback guards', async () => {
      const previousKey = process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
      process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 =
        randomBytes(32).toString('base64');
      const identity = [
        'Atomic',
        'Personnel',
        '0123456789',
        '',
        '',
        '1990-01-02',
        'مرد',
        'مجرد',
        'تهران',
        'تهران',
        'کارشناسی',
        'ایرانی',
        'نامشخص',
        'Synthetic private address',
      ];
      const input = employeeInput('Atomic Personnel', {
        firstName: 'Atomic',
        lastName: 'Personnel',
        identityValues: identity,
        contactValues: [
          ['موبایل', '09123456789'],
          ['خانه', '02112345678'],
        ],
      });
      const commandKey = key();
      let id: string | undefined;
      try {
        const response = await request(app.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Cookie', adminCookie)
          .set('Idempotency-Key', commandKey)
          .send(input)
          .expect(201);
        const created = response.body as HrEmployeeDto;
        id = created.id;
        expect(
          (await service.createEmployee(input, commandKey, admin)).id,
        ).toBe(id);
        const rows = await client.hrRecord.findMany({
          where: { employeeId: id, tab: { in: ['identity', 'phones'] } },
        });
        expect(rows).toHaveLength(3);
        const identityRow = rows.find((row) => row.tab === 'identity')!;
        expect(
          revealHrValues(
            identityRow.data,
            `${branchA}:${id}:employee.identity`,
          ),
        ).toEqual([...identity, '']);
        expect(JSON.stringify(rows)).not.toContain(identity[13]);
        expect(JSON.stringify(created)).not.toContain(identity[2]);
        expect(
          (
            await service.listRecords(
              { section: 'employee', tab: 'identity', employeeId: id },
              admin,
            )
          ).items[0]?.values,
        ).toEqual([...identity, '']);
        const audit = await client.hrAuditEvent.findMany({
          where: { employeeId: id },
        });
        expect(JSON.stringify(audit)).not.toContain(identity[13]);
        const count = await client.hrEmployee.count({
          where: { name: 'Atomic Personnel' },
        });
        await expect(
          service.createEmployee(
            { ...input, contactValues: [['موبایل', 'bad']] },
            key(),
            admin,
          ),
        ).rejects.toThrow();
        await expect(
          service.createEmployee(
            {
              ...input,
              contactValues: [
                ['موبایل', '0912-3456789'],
                ['موبایل', '۰۹۱۲۳۴۵۶۷۸۹'],
              ],
            },
            key(),
            admin,
          ),
        ).rejects.toThrow();
        await expect(
          service.createEmployee(
            {
              ...input,
              identityValues: [
                ...identity.slice(0, 2),
                'bad',
                ...identity.slice(3),
              ],
            },
            key(),
            admin,
          ),
        ).rejects.toThrow();
        await expect(
          service.createEmployee(input, key(), {
            ...admin,
            permissions: admin.permissions.filter((p) => p !== 'hr.sensitive'),
          }),
        ).rejects.toThrow();
        expect(
          await client.hrEmployee.count({
            where: { name: 'Atomic Personnel' },
          }),
        ).toBe(count);
        const longFirstName = 'A'.repeat(81);
        await expect(
          service.createEmployee(
            employeeInput(`${longFirstName} Worker`, {
              identityValues: [longFirstName, 'Worker', ...identity.slice(2)],
              contactValues: [],
            }),
            key(),
            admin,
          ),
        ).rejects.toThrow();
        expect(
          await client.hrEmployee.count({
            where: { name: `${longFirstName} Worker` },
          }),
        ).toBe(0);
        await expect(
          service.updateEmployee(
            id,
            { version: created.version, identityValues: identity },
            admin,
          ),
        ).rejects.toThrow();
        await expect(
          service.createEmployee(
            { ...input, contactValues: [] },
            commandKey,
            admin,
          ),
        ).rejects.toThrow();
      } finally {
        if (id)
          await client.hrRecord.updateMany({
            where: { employeeId: id },
            data: { deletedAt: new Date() },
          });
        if (id)
          await client.hrEmployee.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        if (previousKey === undefined)
          delete process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
        else process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 = previousKey;
      }
    });
    it('atomically edits the complete personnel form with private snapshot, rollback and permission guards', async () => {
      const previousKey = process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
      process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 =
        randomBytes(32).toString('base64');
      let id: string | undefined;
      const identity = [
        'Unified',
        'Worker',
        '',
        '',
        '',
        '1990-01-02',
        'مرد',
        'مجرد',
        'تهران',
        'تهران',
        'کارشناسی',
        'ایرانی',
        'نامشخص',
        'Synthetic edit address',
      ];
      try {
        const created = await service.createEmployee(
          employeeInput('Unified Worker', {
            identityValues: identity,
            contactValues: [
              ['موبایل', '09123456789'],
              ['خانه', '02112345678'],
            ],
          }),
          key(),
          admin,
        );
        id = created.id;
        const privateRows = () =>
          client.hrRecord.findMany({
            where: {
              employeeId: created.id,
              section: 'employee',
              tab: { in: ['identity', 'phones'] },
              deletedAt: null,
            },
            orderBy: { id: 'asc' },
          });
        const original = await privateRows();
        const snapshot = original.map(({ id, version }) => ({ id, version }));
        const input = {
          version: created.version,
          firstName: 'Edited',
          lastName: 'Worker',
          identityValues: [
            'Edited',
            identity[1]!,
            '0123456789',
            ...identity.slice(3),
            '۰۱۲۳۴۵۶۷۸۹',
          ],
          contactValues: [['محل کار', '02187654321']],
          profileRecords: snapshot,
          extension: '0019',
        };
        await expect(
          service.updateEmployee(id, input, {
            ...admin,
            permissions: admin.permissions.filter((p) => p !== 'hr.sensitive'),
          }),
        ).rejects.toThrow();
        await expect(
          service.updateEmployee(id, input, outsider),
        ).rejects.toThrow();
        await expect(
          service.updateEmployee(id, { ...input, profileRecords: [] }, admin),
        ).rejects.toThrow();
        await expect(
          service.updateEmployee(
            id,
            { ...input, contactValues: [['موبایل', 'invalid']] },
            admin,
          ),
        ).rejects.toThrow();
        expect(
          (await client.hrEmployee.findUniqueOrThrow({ where: { id } }))
            .version,
        ).toBe(created.version);
        expect(await privateRows()).toEqual(original);
        const auditSpy = vi
          .spyOn(
            service as unknown as {
              audit: (...args: unknown[]) => Promise<unknown>;
            },
            'audit',
          )
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(
          service.updateEmployee(id, input, admin),
        ).rejects.toThrow();
        auditSpy.mockRestore();
        expect(
          (await client.hrEmployee.findUniqueOrThrow({ where: { id } })).name,
        ).toBe('Unified Worker');
        expect(await privateRows()).toEqual(original);
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/hr/employees/${id}`)
          .set('Cookie', adminCookie)
          .send(input)
          .expect(200);
        const edited = response.body as HrEmployeeDto;
        expect(edited.name).toBe('Edited Worker');
        expect(edited.extension).toBe('0019');
        const rows = await privateRows();
        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r.tab === 'identity')?.id).toBe(
          original.find((r) => r.tab === 'identity')?.id,
        );
        expect(
          revealHrValues(
            rows.find((r) => r.tab === 'identity')!.data,
            `${branchA}:${id}:employee.identity`,
          ),
        ).toEqual(input.identityValues);
        expect(
          revealHrValues(
            rows.find((r) => r.tab === 'phones')!.data,
            `${branchA}:${id}:employee.phones`,
          ),
        ).toEqual(input.contactValues[0]);
        expect(JSON.stringify(rows)).not.toContain(identity[13]);
        expect(
          JSON.stringify(
            await client.hrAuditEvent.findMany({ where: { employeeId: id } }),
          ),
        ).not.toContain(identity[13]);
        // Employee version is current, but an independently edited private record is stale.
        await expect(
          service.updateEmployee(
            id,
            { ...input, version: edited.version },
            admin,
          ),
        ).rejects.toThrow();
        const beforeLegacy = rows.find((r) => r.tab === 'identity')!;
        const legacyEdit = await service.updateRecord(
          beforeLegacy.id,
          {
            version: beforeLegacy.version,
            values: input.identityValues.slice(0, 14),
          },
          admin,
        );
        expect(legacyEdit.values[14]).toBe('۰۱۲۳۴۵۶۷۸۹');
        const currentSnapshot = rows.map(({ id, version }) => ({
          id,
          version,
        }));
        const identityRow = rows.find((r) => r.tab === 'identity')!;
        await client.hrRecord.update({
          where: { id: identityRow.id },
          data: { version: { increment: 1 } },
        });
        await expect(
          service.updateEmployee(
            id,
            {
              ...input,
              version: edited.version,
              profileRecords: currentSnapshot,
            },
            admin,
          ),
        ).rejects.toThrow();
        expect(
          (await client.hrEmployee.findUniqueOrThrow({ where: { id } }))
            .version,
        ).toBe(edited.version);
        const fresh = (await privateRows()).map(({ id, version }) => ({
          id,
          version,
        }));
        const cleared = await service.updateEmployee(
          id,
          {
            ...input,
            version: edited.version,
            profileRecords: fresh,
            contactValues: [],
            identityValues: ['Edited', ...identity.slice(1)],
          },
          admin,
        );
        expect(
          (await privateRows()).filter((r) => r.tab === 'phones'),
        ).toHaveLength(0);
        // Legacy public partial edits preserve private information.
        const partial = await service.updateEmployee(
          id,
          { version: cleared.version, extension: '0020' },
          admin,
        );
        expect(
          (await privateRows()).find((r) => r.tab === 'identity'),
        ).toBeDefined();
        const finalRecords = await privateRows();
        const finalIdentity = finalRecords.find((r) => r.tab === 'identity')!;
        expect(
          revealHrValues(
            finalIdentity.data,
            `${branchA}:${id}:employee.identity`,
          )[14],
        ).toBe('۰۱۲۳۴۵۶۷۸۹');
        await service.updateEmployee(
          id,
          {
            version: partial.version,
            identityValues: ['Edited', ...identity.slice(1), ''],
            contactValues: [],
            profileRecords: finalRecords.map(({ id, version }) => ({
              id,
              version,
            })),
          },
          admin,
        );
        const emptyPostal = (await privateRows()).find(
          (r) => r.tab === 'identity',
        )!;
        expect(
          revealHrValues(
            emptyPostal.data,
            `${branchA}:${id}:employee.identity`,
          )[14],
        ).toBe('');
      } finally {
        vi.restoreAllMocks();
        if (id) {
          await client.hrRecord.updateMany({
            where: { employeeId: id },
            data: { deletedAt: new Date() },
          });
          await client.hrEmployee.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        }
        if (previousKey === undefined)
          delete process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
        else process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 = previousKey;
      }
    });
    it('shares only job-title metadata across branches and atomically corrects employee assignments with canonical references', async () => {
      const branchAdmin = { ...admin, branchIds: [branchA] };
      const title = await service.createRecord(
        {
          section: 'organization',
          tab: 'positions',
          branchId: branchB,
          values: ['', 'Shared synthetic title', '', '', '', ''],
          status: 'فعال',
        },
        key(),
        outsider,
      );
      const unit = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchA,
          values: ['Synthetic corrected unit', '', '', '', '', ''],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const foreignUnit = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchB,
          values: ['Synthetic foreign unit', '', '', '', '', ''],
          status: 'فعال',
        },
        key(),
        outsider,
      );
      const catalogue = (await service.bootstrap(branchAdmin)).jobTitles!;
      expect(catalogue.find((t) => t.id === title.id)).toEqual({
        id: title.id,
        name: 'Shared synthetic title',
        status: 'فعال',
      });
      expect(
        (
          await service.listRecords(
            { section: 'organization', tab: 'positions' },
            branchAdmin,
          )
        ).items.some((r) => r.id === title.id),
      ).toBe(false);
      await expect(
        service.updateRecord(
          title.id,
          { version: title.version, values: title.values },
          branchAdmin,
        ),
      ).rejects.toThrow();
      const target = await service.createEmployee(
        employeeInput('Synthetic job correction', {
          position: 'Shared synthetic title',
          jobTitleId: title.id,
        }),
        key(),
        admin,
      );
      expect(
        await client.hrRecord.findFirst({
          where: {
            employeeId: target.id,
            tab: 'assignment',
            jobTitleId: title.id,
          },
        }),
      ).not.toBeNull();
      const before = await client.hrRecord.count({
        where: { employeeId: target.id, tab: 'assignment' },
      });
      const input = {
        version: target.version,
        unit: unit.values[0],
        grade: 'مدیر',
        managerId: employee.id,
      };
      await expect(
        service.updateEmployee(
          target.id,
          { ...input, unit: foreignUnit.values[0] },
          admin,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateEmployee(target.id, input, reader),
      ).rejects.toThrow();
      await expect(
        service.updateEmployee(target.id, input, outsider),
      ).rejects.toThrow();
      await expect(
        service.updateEmployee(
          target.id,
          { ...input, branchId: branchB },
          admin,
        ),
      ).rejects.toThrow();
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/hr/employees/${target.id}`)
        .set('Cookie', adminCookie)
        .send(input)
        .expect(200);
      const corrected = response.body as HrEmployeeDto;
      expect(corrected).toMatchObject({
        unit: 'Synthetic corrected unit',
        grade: 'مدیر',
        managerId: employee.id,
        position: 'Shared synthetic title',
      });
      expect(
        await client.hrRecord.count({
          where: { employeeId: target.id, tab: 'assignment' },
        }),
      ).toBe(before + 1);
      const audit = await client.hrAuditEvent.findFirst({
        where: { employeeId: target.id, action: 'employee.assignment.correct' },
      });
      expect(audit?.changes).toMatchObject({
        before: { grade: 'G4' },
        after: { grade: 'مدیر', unit: 'Synthetic corrected unit' },
      });
      await expect(
        service.updateEmployee(target.id, input, admin),
      ).rejects.toThrow();
      const ownTitle = await service.createRecord(
        {
          section: 'organization',
          tab: 'positions',
          branchId: branchA,
          values: ['', 'Second synthetic title', '', '', '', ''],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const changed = await service.updateEmployee(
        target.id,
        {
          version: corrected.version,
          position: 'Second synthetic title',
          jobTitleId: ownTitle.id,
        },
        admin,
      );
      expect(changed.position).toBe('Second synthetic title');
      expect(
        await client.hrRecord.findFirst({
          where: {
            employeeId: target.id,
            tab: 'assignment',
            jobTitleId: ownTitle.id,
          },
        }),
      ).not.toBeNull();
      const titleRow = await client.hrRecord.findUniqueOrThrow({
        where: { id: ownTitle.id },
      });
      await client.hrRecord.update({
        where: { id: ownTitle.id },
        data: { status: 'غیرفعال' },
      });
      await expect(
        service.updateEmployee(
          target.id,
          {
            version: changed.version,
            position: 'Second synthetic title',
            jobTitleId: ownTitle.id,
          },
          admin,
        ),
      ).rejects.toThrow();
      await client.hrRecord.update({
        where: { id: ownTitle.id },
        data: { status: titleRow.status },
      });
    });
    it('persists Radan identity encrypted and never returns ciphertext or private audit values', async () => {
      const previousKey = process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
      process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 =
        randomBytes(32).toString('base64');
      try {
        const target = await service.createEmployee(
          employeeInput('Radan Private'),
          key(),
          admin,
        );
        const values = [
          'نام',
          'نام خانوادگی',
          '0123456789',
          '',
          '',
          '',
          'مرد',
          'مجرد',
          '',
          '',
          'کارشناسی',
          '',
          'نامشخص',
          'نشانی محرمانه',
        ];
        const record = await service.createRecord(
          {
            section: 'employee',
            tab: 'identity',
            employeeId: target.id,
            values,
            status: 'فعال',
          },
          key(),
          admin,
        );
        expect(record.values).toEqual([...values, '']);
        expect(
          (
            await client.hrEmployee.findUniqueOrThrow({
              where: { id: target.id },
            })
          ).name,
        ).toBe('نام نام خانوادگی');
        expect(JSON.stringify(record.data)).not.toContain('privatePayload');
        const stored = await client.hrRecord.findUniqueOrThrow({
          where: { id: record.id },
        });
        expect(JSON.stringify(stored)).not.toContain('0123456789');
        expect(stored.searchText).toBe('');
        expect(
          (await service.getRecord(record.id, reader)).values.every(
            (v) => v === '••••',
          ),
        ).toBe(true);
        const updated = await service.updateRecord(
          record.id,
          {
            version: record.version,
            values: values.map((v, i) => (i === 13 ? 'نشانی جدید' : v)),
          },
          admin,
        );
        expect(updated.values[13]).toBe('نشانی جدید');
        const audit = await client.hrAuditEvent.findMany({
          where: { recordId: record.id },
        });
        expect(JSON.stringify(audit)).not.toContain('0123456789');
        expect(JSON.stringify(audit)).not.toContain('نشانی جدید');
        await expect(service.getRecord(record.id, outsider)).rejects.toThrow();
        const currentEmployee = await client.hrEmployee.findUniqueOrThrow({
          where: { id: target.id },
        });
        await expect(
          service.updateEmployee(
            target.id,
            {
              version: currentEmployee.version,
              name: 'Different',
              firstName: 'نام',
              lastName: 'خانواده',
            },
            admin,
          ),
        ).rejects.toThrow();
        const named = await service.updateEmployee(
          target.id,
          {
            version: currentEmployee.version,
            name: 'نام دو بخشی خانواده',
            firstName: 'نام دو بخشی',
            lastName: 'خانواده',
          },
          admin,
        );
        const synchronized = await service.getRecord(record.id, admin);
        expect(synchronized.values.slice(0, 2)).toEqual([
          'نام دو بخشی',
          'خانواده',
        ]);
        expect(synchronized.values[2]).toBe('0123456789');
        await expect(
          service.updateRecord(
            record.id,
            { version: updated.version, values },
            admin,
          ),
        ).rejects.toThrow();
        await service.updateEmployee(
          target.id,
          { version: named.version, name: 'Legacy Name' },
          admin,
        );
        const legacy = await service.getRecord(record.id, admin);
        expect(legacy.values.slice(0, 2)).toEqual(['Legacy', 'Name']);
        expect(legacy.values[2]).toBe('0123456789');
        await service.deleteRecord(record.id, String(legacy.version), admin);
      } finally {
        if (previousKey === undefined)
          delete process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64;
        else process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 = previousKey;
      }
    });
    it('grants exact monthly minutes, retries once and conserves carry/burn/buyback', async () => {
      const target = await service.createEmployee(
        employeeInput('Radan Minutes'),
        key(),
        admin,
      );
      const grant = {
        employeeIds: [target.id],
        year: 1405,
        months: [1, 2],
        duration: '16:20',
        type: 'استحقاقی',
      };
      const token = key();
      await service.minuteLeave(grant, token, admin);
      await service.minuteLeave(grant, token, admin);
      expect(
        (
          await service.minuteCardex(
            { employeeId: target.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(1960);
      const rule = await service.createRecord(
        {
          section: 'time',
          tab: 'leaveTransferRules',
          branchId: branchA,
          values: [
            'قاعده',
            '1405',
            '10:00',
            '30:00',
            '01:00',
            '01:40',
            '00:00',
            '00:00',
            '00:00',
          ],
          status: 'فعال',
        },
        key(),
        admin,
      );
      await service.minuteLeave(
        {
          employeeIds: [target.id],
          year: 1405,
          type: 'استحقاقی',
          ruleId: rule.id,
        },
        key(),
        admin,
      );
      expect(
        (
          await service.minuteCardex(
            { employeeId: target.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(0);
      expect(
        (
          await service.minuteCardex(
            { employeeId: target.id, year: 1406 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(1800);
      await expect(
        service.minuteLeave(
          {
            employeeIds: [target.id],
            year: 1405,
            type: 'استحقاقی',
            ruleId: rule.id,
          },
          key(),
          admin,
        ),
      ).rejects.toThrow('قبلاً');
      await expect(service.minuteLeave(grant, key(), self)).rejects.toThrow();
    });
    it('approves every nominated stage before final effects and prevents bypass', async () => {
      const approverAccount = await actor(
        'radan_approver',
        ['hr.self', 'hr.approve'],
        [branchA],
      );
      const first = await service.createEmployee(
        employeeInput('Radan First', { userId: admin.userId }),
        key(),
        admin,
      );
      const second = await service.createEmployee(
        employeeInput('Radan Second', { userId: approverAccount.actor.userId }),
        key(),
        admin,
      );
      const target = await service.createEmployee(
        employeeInput('Radan Workflow'),
        key(),
        admin,
      );
      const procedure = await service.createRecord(
        {
          branchId: branchA,
          section: 'requests',
          tab: 'procedures',
          values: ['دو مرحله', '', JSON.stringify(['دورکاری ساعتی'])],
          status: 'فعال',
        },
        key(),
        admin,
      );
      await service.createRecord(
        {
          section: 'requests',
          tab: 'procedureMembers',
          parentId: procedure.id,
          employeeId: target.id,
          values: [''],
          status: 'فعال',
        },
        key(),
        admin,
      );
      for (const [staff, priority] of [
        [first, 1],
        [second, 2],
      ] as const)
        await service.createRecord(
          {
            section: 'requests',
            tab: 'approvalStages',
            parentId: procedure.id,
            employeeId: staff.id,
            values: ['', String(priority), 'خیر'],
            status: 'فعال',
          },
          key(),
          admin,
        );
      const item = await service.createRecord(
        {
          section: 'time',
          tab: 'remote',
          employeeId: target.id,
          values: ['', '2027-01-15', '2027-01-15', 'ساعتی', '09:00', '11:00'],
          status: 'در انتظار تأیید',
        },
        key(),
        admin,
      );
      await expect(
        service.updateRecord(
          item.id,
          { version: item.version, status: 'تأییدشده' },
          approverAccount.actor,
        ),
      ).rejects.toThrow();
      const partial = await service.updateRecord(
        item.id,
        { version: item.version, status: 'تأییدشده' },
        admin,
      );
      expect(partial.status).toBe('در انتظار تأیید');
      expect(partial.data.approvalStep).toBe(1);
      await expect(
        service.updateRecord(
          item.id,
          { version: partial.version, values: item.values },
          admin,
        ),
      ).rejects.toThrow();
      await expect(
        service.updateRecord(
          item.id,
          { version: partial.version, status: 'تأییدشده' },
          admin,
        ),
      ).rejects.toThrow('مرحله');
      const final = await service.updateRecord(
        item.id,
        { version: partial.version, status: 'تأییدشده' },
        approverAccount.actor,
      );
      expect(final.status).toBe('تأییدشده');
      expect(final.data.approvalStep).toBe(2);
      expect(final.data.minutes).toBe(120);
    });
    it('saves a calendar atomically and assigns an immutable schedule snapshot', async () => {
      const target = await service.createEmployee(
        employeeInput('Radan Calendar'),
        key(),
        admin,
      );
      const hours = await service.createRecord(
        {
          branchId: branchA,
          section: 'time',
          tab: 'workingHours',
          values: [
            'صبح',
            '',
            '08:00',
            '16:00',
            'همان روز',
            '0',
            '0',
            '#123456',
          ],
          status: 'فعال',
        },
        key(),
        admin,
      );
      const template = await service.createRecord(
        {
          branchId: branchA,
          section: 'time',
          tab: 'shiftTemplates',
          values: ['تقویم', ''],
          status: 'فعال',
        },
        key(),
        admin,
      );
      await service.saveTemplateCalendar(
        template.id,
        {
          version: 1,
          dates: ['2027-01-15', '2027-01-16'],
          workingHoursId: hours.id,
        },
        key(),
        admin,
      );
      await expect(
        service.saveTemplateCalendar(
          template.id,
          { version: 1, dates: ['2027-01-17'], workingHoursId: hours.id },
          key(),
          admin,
        ),
      ).rejects.toThrow();
      const assignment = await service.createRecord(
        {
          section: 'time',
          tab: 'shift',
          employeeId: target.id,
          parentId: template.id,
          values: [
            'تقویم',
            '',
            '',
            '0',
            '0',
            '',
            '',
            '2027-01-15',
            '2027-01-16',
          ],
          status: 'فعال',
        },
        key(),
        admin,
      );
      expect(assignment.data.templateSchedule?.['2027-01-15']?.values[0]).toBe(
        '08:00',
      );
      await service.saveTemplateCalendar(
        template.id,
        { version: 2, dates: ['2027-01-15'], remove: true },
        key(),
        admin,
      );
      expect(
        (await service.getRecord(assignment.id, admin)).data.templateSchedule?.[
          '2027-01-15'
        ],
      ).toBeDefined();
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
    it('serves complete scoped dashboard aggregates through authenticated HTTP without leaking another branch', async () => {
      const first = await service.createEmployee(
        employeeInput('Chart A', { unit: 'Chart unit' }),
        key(),
        admin,
      );
      const second = await service.createEmployee(
        employeeInput('Chart B', { branchId: branchB, unit: 'Chart unit' }),
        key(),
        admin,
      );
      const today = dashboardPeriods(new Date()).today;
      const fixtureIds: string[] = [];
      try {
        for (const e of [first, second]) {
          const r = await client.hrRecord.create({
            data: {
              branchId: e.branchId,
              employeeId: e.id,
              section: 'time',
              tab: 'attendance',
              code: `CHART-${key()}`,
              status: 'حاضر',
              values: [e.name, today, '', '08:00', '5'],
              effectiveAt: new Date(today),
              data: { workedMinutes: 480, lateMinutes: 5, overtimeMinutes: 60 },
            },
          });
          fixtureIds.push(r.id);
        }
        const result = await request(app.getHttpServer())
          .get('/api/v1/hr/dashboard/charts?unit=Chart%20unit')
          .set('Cookie', adminCookie)
          .expect(200);
        expect(result.headers['cache-control']).toContain('no-store');
        expect(result.body.charts).toHaveLength(7);
        expect(
          result.body.charts
            .find((c: { id: string }) => c.id === 'present')
            .points.at(-1).value,
        ).toBe(2);
        const scoped = await service.dashboardCharts(
          { unit: 'Chart unit' },
          { ...admin, branchIds: [branchA] },
        );
        expect(
          scoped.charts.find((c) => c.id === 'present')?.points.at(-1)?.value,
        ).toBe(1);
        expect(
          scoped.charts
            .find((c) => c.id === 'weeklyAttendance')
            ?.points.map((p) => p.label),
        ).toEqual(['Chart A']);
        const selfResult = await request(app.getHttpServer())
          .get('/api/v1/hr/dashboard/charts?unit=Chart%20unit')
          .set('Cookie', selfCookie)
          .expect(200);
        expect(
          selfResult.body.charts.find(
            (c: { id: string }) => c.id === 'weeklyAttendance',
          ).points,
        ).toEqual([]);
        await request(app.getHttpServer())
          .get('/api/v1/hr/dashboard/charts')
          .expect(401);
        await request(app.getHttpServer())
          .get('/api/v1/hr/dashboard/charts?organizationBranchId=bad')
          .set('Cookie', adminCookie)
          .expect(400);
      } finally {
        await client.hrRecord.updateMany({
          where: { id: { in: fixtureIds } },
          data: { deletedAt: new Date() },
        });
        await client.hrEmployee.updateMany({
          where: { id: { in: [first.id, second.id] } },
          data: { deletedAt: new Date() },
        });
      }
    });
    it('persists organization employee nodes and positions with CAS, hierarchy guards and safe node deletion', async () => {
      const first = await service.createEmployee(
        employeeInput('Org chart first'),
        key(),
        admin,
      );
      const second = await service.createEmployee(
        employeeInput('Org chart second'),
        key(),
        admin,
      );
      const values = (name: string) =>
        getHrResource('organization', 'units')!.columns.map((_, i) =>
          i === 0 ? name : '',
        );
      const a = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchA,
          values: values('Org chart department A'),
          status: 'فعال',
        },
        key(),
        admin,
      );
      const b = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchA,
          values: values('Org chart department B'),
          status: 'فعال',
        },
        key(),
        admin,
      );
      const body = {
        section: 'organization',
        tab: 'chartEmployees',
        branchId: branchA,
        employeeId: first.id,
        parentId: a.id,
        values: [first.name, ''],
        status: 'فعال',
      };
      const response = await request(app.getHttpServer())
        .post('/api/v1/hr/records')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', key())
        .send(body)
        .expect(201);
      const node = response.body as HrRecordDto;
      const moved = await request(app.getHttpServer())
        .patch(`/api/v1/hr/records/${node.id}`)
        .set('Cookie', adminCookie)
        .send({ version: node.version, data: { chartX: 120, chartY: -35 } })
        .expect(200);
      expect((await service.getRecord(node.id, admin)).data).toMatchObject({
        chartX: 120,
        chartY: -35,
      });
      await request(app.getHttpServer())
        .patch(`/api/v1/hr/records/${node.id}`)
        .set('Cookie', adminCookie)
        .send({ version: node.version, data: { chartX: 10 } })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/api/v1/hr/records/${node.id}`)
        .set('Cookie', adminCookie)
        .send({ version: moved.body.version, data: { chartY: 5001 } })
        .expect(400);
      await expect(
        service.updateRecord(
          node.id,
          { version: moved.body.version, data: { chartX: 0 } },
          outsider,
        ),
      ).rejects.toThrow();
      await request(app.getHttpServer())
        .post('/api/v1/hr/records')
        .set('Cookie', selfCookie)
        .set('Idempotency-Key', key())
        .send({ ...body, employeeId: employee.id, values: [employee.name, ''] })
        .expect(403);
      const child = await service.createRecord(
        {
          ...body,
          employeeId: second.id,
          parentId: node.id,
          values: [second.name, 'جانشین'],
        },
        key(),
        admin,
      );
      await expect(
        service.updateRecord(
          node.id,
          { version: moved.body.version, parentId: child.id },
          admin,
        ),
      ).rejects.toThrow('چرخه');
      await expect(
        service.deleteRecord(node.id, moved.body.version, admin),
      ).rejects.toThrow('وابسته');
      await expect(
        service.deleteRecord(a.id, a.version, admin),
      ).rejects.toThrow('وابسته');
      const childMoved = await service.updateRecord(
        child.id,
        {
          version: child.version,
          parentId: b.id,
          values: [second.name, 'عنوان جدید'],
        },
        admin,
      );
      expect(childMoved.parentId).toBe(b.id);
      await service.deleteRecord(node.id, moved.body.version, admin);
      const person = await client.hrEmployee.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(person.deletedAt).toBeNull();
      expect(person.unit).toBe(first.unit);
      expect(person.version).toBe(first.version);
      const readded = await service.createRecord(body, key(), admin);
      expect(readded.id).not.toBe(node.id);
      const unitMoved = await service.updateRecord(
        a.id,
        { version: a.version, data: { chartX: -10, chartY: 50 } },
        admin,
      );
      expect(unitMoved.data.chartY).toBe(50);
      const audited = await client.hrAuditEvent.count({
        where: { recordId: node.id, action: 'record.update' },
      });
      expect(audited).toBe(1);
      await client.hrRecord.updateMany({
        where: { id: { in: [a.id, b.id, node.id, child.id, readded.id] } },
        data: { deletedAt: new Date() },
      });
      await client.hrEmployee.updateMany({
        where: { id: { in: [first.id, second.id] } },
        data: { deletedAt: new Date() },
      });
    });
    it('rejects cross-company chart parents and duplicate employee nodes under concurrent requests', async () => {
      const company = async (name: string) =>
        service.createRecord(
          {
            section: 'organization',
            tab: 'branches',
            branchId: branchA,
            values: getHrResource('organization', 'branches')!.columns.map(
              (_, i) => (i === 0 ? name : ''),
            ),
            status: 'فعال',
          },
          key(),
          admin,
        );
      const companyA = await company('Chart company A'),
        companyB = await company('Chart company B');
      const first = await service.createEmployee(
        employeeInput('Company chart employee', {
          organizationBranchId: companyA.id,
        }),
        key(),
        admin,
      );
      const foreign = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchA,
          values: getHrResource('organization', 'units')!.columns.map((_, i) =>
            i === 0 ? 'Foreign chart department' : '',
          ),
          status: 'فعال',
          data: { organizationBranchId: companyB.id },
        },
        key(),
        admin,
      );
      const body = {
        section: 'organization',
        tab: 'chartEmployees',
        branchId: branchA,
        employeeId: first.id,
        values: [first.name, ''],
        status: 'فعال',
      };
      await expect(
        service.createRecord({ ...body, parentId: foreign.id }, key(), admin),
      ).rejects.toThrow('شرکت');
      await expect(
        service.createRecord(
          { ...body, data: { organizationBranchId: companyB.id } },
          key(),
          admin,
        ),
      ).rejects.toThrow('شرکت');
      const ownDepartment = await service.createRecord(
        {
          section: 'organization',
          tab: 'units',
          branchId: branchA,
          values: getHrResource('organization', 'units')!.columns.map((_, i) =>
            i === 0 ? 'Own chart department' : '',
          ),
          status: 'فعال',
          data: { organizationBranchId: companyA.id },
        },
        key(),
        admin,
      );
      const attached = { ...body, parentId: ownDepartment.id };
      const results = await Promise.allSettled([
        service.createRecord(attached, key(), admin),
        service.createRecord(attached, key(), admin),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await expect(
        service.updateRecord(
          ownDepartment.id,
          {
            version: ownDepartment.version,
            data: { organizationBranchId: companyB.id },
          },
          admin,
        ),
      ).rejects.toThrow('زیرمجموعه');
      expect(
        await client.hrRecord.count({
          where: {
            employeeId: first.id,
            tab: 'chartEmployees',
            deletedAt: null,
          },
        }),
      ).toBe(1);
      // A canonical personnel transfer leaves historical chart records intact; a new current-company node is allowed.
      await client.hrEmployee.update({
        where: { id: first.id },
        data: { organizationBranchId: companyB.id },
      });
      const transferredNode = await service.createRecord(
        { ...body, parentId: foreign.id },
        key(),
        admin,
      );
      expect(transferredNode.data.organizationBranchId).toBe(companyB.id);
      await client.hrRecord.updateMany({
        where: {
          OR: [
            {
              id: {
                in: [companyA.id, companyB.id, foreign.id, ownDepartment.id],
              },
            },
            { employeeId: first.id, tab: 'chartEmployees' },
          ],
        },
        data: { deletedAt: new Date() },
      });
      await client.hrEmployee.update({
        where: { id: first.id },
        data: { deletedAt: new Date() },
      });
    });
    it('runs inline transfers atomically across branches and reports exact scoped balances through HTTP', async () => {
      const first = await service.createEmployee(
        employeeInput('Leave parity A'),
        key(),
        admin,
      );
      const second = await service.createEmployee(
        employeeInput('Leave parity B', { branchId: branchB }),
        key(),
        admin,
      );
      const grant = {
        employeeIds: [first.id, second.id],
        year: 1405,
        months: [1],
        duration: '11:00',
        type: 'استحقاقی',
      };
      await expect(
        service.minuteLeave(
          { ...grant, employeeIds: [first.id, first.id.toUpperCase()] },
          key(),
          admin,
        ),
      ).rejects.toThrow('یکتا');
      await service.minuteLeave(grant, key(), admin);
      const draft = await client.hrRecord.create({
        data: {
          branchId: branchA,
          employeeId: first.id,
          section: 'time',
          tab: 'minuteLedger',
          code: `DRAFT-${key()}`,
          values: [first.name, '1405', '1', 'استحقاقی', 'تخصیص', '9999', ''],
          data: {},
          status: 'پیش‌نویس',
        },
      });
      const snapshot = await request(app.getHttpServer())
        .get('/api/v1/hr/leave/report')
        .set('Cookie', adminCookie)
        .query({ year: 1405, employeeIds: [first.id, second.id].join(',') })
        .expect(200);
      expect(snapshot.headers['cache-control']).toBe('private, no-store');
      expect(
        snapshot.body.items.map(
          (item: { balanceMinutes: number }) => item.balanceMinutes,
        ),
      ).toEqual([660, 660]);
      expect(
        snapshot.body.records.some(
          (row: { id: string }) => row.id === draft.id,
        ),
      ).toBe(false);
      expect(
        (
          await service.minuteCardex(
            { employeeId: first.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(660);
      await request(app.getHttpServer())
        .get('/api/v1/hr/leave/report')
        .set('Cookie', adminCookie)
        .query({
          year: 1405,
          employeeIds: `${first.id},${first.id.toUpperCase()}`,
        })
        .expect(400);
      const scoped = { ...admin, branchIds: [branchA] };
      expect(
        (await service.leavePersonnel(scoped)).items.some(
          (item) => item.id === second.id,
        ),
      ).toBe(false);
      await expect(
        service.leaveReport({ year: 1405, employeeIds: second.id }, scoped),
      ).rejects.toThrow();
      await expect(
        service.leaveReport(
          { year: 1405, employeeIds: `${first.id},${first.id}` },
          admin,
        ),
      ).rejects.toThrow();
      await request(app.getHttpServer())
        .get('/api/v1/hr/leave/personnel')
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/hr/leave/report')
        .set('Cookie', selfCookie)
        .query({ year: 1405, employeeIds: first.id })
        .expect(404);
      const transfer = {
        greaterThan: '10:00',
        lessThan: '08:00',
        greaterCarry: '08:00',
        greaterBurn: '02:00',
        greaterBuyback: '01:00',
        lessCarry: '06:00',
        lessBurn: '00:00',
        lessBuyback: '00:00',
      };
      const command = {
        employeeIds: [first.id, second.id],
        year: 1405,
        type: 'استحقاقی',
        transfer,
      };
      const ruleCount = await client.hrRecord.count({
        where: { tab: 'leaveTransferRules' },
      });
      await service.minuteLeave(
        { ...grant, employeeIds: [second.id], duration: '01:00' },
        key(),
        admin,
      );
      await expect(service.minuteLeave(command, key(), admin)).rejects.toThrow(
        'مجموع',
      );
      expect(
        await client.hrRecord.count({ where: { tab: 'leaveTransferRules' } }),
      ).toBe(ruleCount);
      expect(
        (
          await service.minuteCardex(
            { employeeId: first.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(660);
      const token = key();
      const successful = { ...command, employeeIds: [first.id] };
      await request(app.getHttpServer())
        .post('/api/v1/hr/leave/minutes')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', token)
        .send(successful)
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/hr/leave/minutes')
        .set('Cookie', adminCookie)
        .set('Idempotency-Key', token)
        .send(successful)
        .expect(201);
      expect(
        (
          await service.minuteCardex(
            { employeeId: first.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(0);
      expect(
        (
          await service.minuteCardex(
            { employeeId: first.id, year: 1406 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(480);
      expect(
        await client.hrRecord.count({ where: { tab: 'leaveTransferRules' } }),
      ).toBe(ruleCount + 1);
      await expect(
        service.minuteLeave(successful, key(), admin),
      ).rejects.toThrow('صفر');
      await expect(
        service.minuteLeave(
          {
            ...command,
            employeeIds: [second.id],
            transfer: { ...transfer, lessThan: '11:00' },
          },
          key(),
          admin,
        ),
      ).rejects.toThrow('حد پایین');
      await expect(
        service.minuteLeave(
          { ...command, employeeIds: [second.id], year: 1600 },
          key(),
          admin,
        ),
      ).rejects.toThrow('سال مقصد');
      await expect(service.minuteLeave(command, key(), self)).rejects.toThrow();
      const lower = await service.createEmployee(
        employeeInput('Leave lower branch'),
        key(),
        admin,
      );
      await service.minuteLeave(
        { ...grant, employeeIds: [lower.id], duration: '06:00' },
        key(),
        admin,
      );
      await service.minuteLeave(
        { ...command, employeeIds: [lower.id] },
        key(),
        admin,
      );
      expect(
        (
          await service.minuteCardex(
            { employeeId: lower.id, year: 1406 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(360);
      const boundary = await service.createEmployee(
        employeeInput('Leave boundary'),
        key(),
        admin,
      );
      await service.minuteLeave(
        { ...grant, employeeIds: [boundary.id], duration: '08:00' },
        key(),
        admin,
      );
      await expect(
        service.minuteLeave(
          { ...command, employeeIds: [boundary.id] },
          key(),
          admin,
        ),
      ).rejects.toThrow('محدوده');
      expect(
        (
          await service.minuteCardex(
            { employeeId: boundary.id, year: 1405 },
            admin,
          )
        ).balanceMinutes,
      ).toBe(480);
      await client.hrRecord.update({
        where: { id: draft.id },
        data: { deletedAt: new Date() },
      });
    });
    it('reads complete scoped attendance report data including overlapping requests and undated references', async () => {
      const batch = Array.from({ length: 2001 }, (_, index) => ({
        id: key(),
        personnelCode: `ZZREPORT-${index.toString().padStart(4, '0')}`,
        branchId: branchA,
        name: 'Synthetic report personnel',
        kind: 'تمام‌وقت',
        unit: 'عملیات',
        position: 'کارشناس',
        grade: 'G4',
        startedAt: new Date('2024-01-01'),
      }));
      await client.hrEmployee.createMany({ data: batch });
      const target = batch.at(-1)!;
      const foreign = await service.createEmployee(
        employeeInput('Report other branch', { branchId: branchB }),
        key(),
        admin,
      );
      const fixture = async (
        section: string,
        tab: string,
        values: string[],
        employeeId: string | null = target.id,
        extra: Record<string, unknown> = {},
      ) =>
        client.hrRecord.create({
          data: {
            branchId: branchA,
            employeeId,
            section,
            tab,
            code: `REPORT-${key()}`,
            values,
            status: 'فعال',
            data: {},
            ...extra,
          },
        });
      const group = await fixture(
        'organization',
        'groups',
        ['Report group', ''],
        null,
      );
      const membership = await fixture(
        'organization',
        'groupMembers',
        ['Synthetic report personnel'],
        target.id,
        { parentId: group.id },
      );
      const attendance = await fixture(
        'time',
        'attendance',
        [target.name, '2026-10-20', '', '8:00', '10', '0'],
        target.id,
        {
          effectiveAt: new Date('2026-10-20'),
          data: {
            workedMinutes: 480,
            lateMinutes: 10,
            earlyMinutes: 0,
            overtimeMinutes: 0,
          },
          status: 'حاضر',
        },
      );
      const overlap = await fixture(
        'time',
        'remote',
        [target.name, '2026-09-30', '2026-10-02', 'روزانه', '', ''],
        target.id,
        {
          effectiveAt: new Date('2026-09-30'),
          data: {
            startsAt: '2026-09-30T00:00:00.000Z',
            endsAt: '2026-10-02T23:59:00.000Z',
          },
        },
      );
      const missionValues = [
        target.name,
        'Synthetic destination',
        '2026-09-30',
        '2026-10-02',
        'Synthetic mission',
        '',
      ];
      const legacyMission = await fixture('time', 'mission', missionValues);
      const mission = await fixture('expenses', 'mission', missionValues);
      const futureMission = await fixture('time', 'mission', [
        target.name,
        'Synthetic destination',
        '2027-01-01',
        '2027-01-02',
        '',
        '',
      ]);
      const future = await fixture(
        'time',
        'attendance',
        [target.name, '2027-01-01', '', '8:00', '0', '0'],
        target.id,
        { effectiveAt: new Date('2027-01-01') },
      );
      const result = await request(app.getHttpServer())
        .get('/api/v1/hr/reports/attendance-data')
        .set('Cookie', adminCookie)
        .query({ from: '2026-10-01', to: '2026-10-31' })
        .expect(200);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.body.employees.length).toBeGreaterThan(2000);
      expect(
        result.body.employees.some(
          (person: { id: string }) => person.id === target.id,
        ),
      ).toBe(true);
      const ids = result.body.records.map((row: { id: string }) => row.id);
      expect(ids).toContain(attendance.id);
      expect(ids).toContain(overlap.id);
      expect(ids).toContain(legacyMission.id);
      expect(ids).toContain(mission.id);
      expect(ids).not.toContain(futureMission.id);
      expect(ids).not.toContain(future.id);
      expect(
        result.body.references.some(
          (row: { id: string }) => row.id === group.id,
        ),
      ).toBe(true);
      expect(
        result.body.references.some(
          (row: { id: string }) => row.id === membership.id,
        ),
      ).toBe(true);
      const scoped = await service.attendanceReportData(
        { from: '2026-10-01', to: '2026-10-31' },
        { ...admin, branchIds: [branchA] },
      );
      expect(scoped.employees.some((person) => person.id === foreign.id)).toBe(
        false,
      );
      expect(scoped.records.every((row) => row.branchId === branchA)).toBe(
        true,
      );
      const selfResult = await request(app.getHttpServer())
        .get('/api/v1/hr/reports/attendance-data')
        .set('Cookie', selfCookie)
        .query({ from: '2026-10-01', to: '2026-10-31' })
        .expect(200);
      expect(
        selfResult.body.employees.some(
          (person: { id: string }) => person.id === target.id,
        ),
      ).toBe(false);
      expect(
        selfResult.body.records.some(
          (row: { id: string }) => row.id === attendance.id,
        ),
      ).toBe(false);
      await request(app.getHttpServer())
        .get('/api/v1/hr/reports/attendance-data')
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/hr/reports/attendance-data')
        .set('Cookie', adminCookie)
        .query({ from: '2026-11-01', to: '2026-10-01' })
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/hr/reports/attendance-data')
        .set('Cookie', adminCookie)
        .query({ to: 'wrong-date' })
        .expect(400);
      await client.hrRecord.updateMany({
        where: {
          id: {
            in: [
              group.id,
              membership.id,
              attendance.id,
              overlap.id,
              future.id,
              legacyMission.id,
              mission.id,
              futureMission.id,
            ],
          },
        },
        data: { deletedAt: new Date() },
      });
      await client.hrEmployee.updateMany({
        where: { id: { in: batch.map((person) => person.id) } },
        data: { deletedAt: new Date() },
      });
    });
    it('preserves appended working-hour and transfer fields when legacy clients edit older payload lengths', async () => {
      const hours = await service.createRecord(
        {
          section: 'time',
          tab: 'workingHours',
          branchId: branchA,
          status: 'فعال',
          values: [
            'Legacy editor',
            '',
            '08:00',
            '16:00',
            'همان روز',
            '0',
            '0',
            '#000000',
            'بله',
          ],
        },
        key(),
        admin,
      );
      const updatedHours = await service.updateRecord(
        hours.id,
        { version: hours.version, values: hours.values.slice(0, 8) },
        admin,
      );
      expect(updatedHours.values[8]).toBe('بله');
      const rule = await service.createRecord(
        {
          section: 'time',
          tab: 'leaveTransferRules',
          branchId: branchA,
          status: 'فعال',
          values: [
            'Legacy rule',
            '1405',
            '10:00',
            '08:00',
            '02:00',
            '01:00',
            '06:00',
            '00:00',
            '00:00',
            '08:00',
          ],
        },
        key(),
        admin,
      );
      const updatedRule = await service.updateRecord(
        rule.id,
        { version: rule.version, values: rule.values.slice(0, 9) },
        admin,
      );
      expect(updatedRule.values[9]).toBe('08:00');
    });
  },
);
