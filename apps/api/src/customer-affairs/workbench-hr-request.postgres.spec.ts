import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { CustomerAffairsService } from './customer-affairs.service';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { HrService } from '../hr/hr.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
const enabled = process.env.NORA_RUN_WORKBENCH_REQUEST_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)('transactional Workbench HR leave approval', () => {
  let db: DatabaseClient, service: CustomerAffairsService;
  const branch = randomUUID(),
    sender = randomUUID(),
    reviewer = randomUUID(),
    initialReviewer = randomUUID(),
    employee = randomUUID();
  const actor = {
    userId: reviewer,
    branchIds: [branch],
    permissions: ['hr.read', 'hr.manage', 'hr.approve'],
  } as unknown as AuthenticatedActor;
  const leave = {
    from: '2026-11-05',
    to: '2026-11-05',
    mode: 'روزانه',
    reason: 'Synthetic leave reason',
  };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !['/nora_workbench_test_1018', '/nora_ci'].includes(url.pathname)
    )
      throw Error('Disposable local database required');
    db = createDatabaseClient(url.toString());
    await db.branch.create({
      data: { id: branch, code: branch, name: 'Synthetic HR branch' },
    });
    for (const id of [sender, reviewer, initialReviewer])
      await db.user.create({
        data: {
          id,
          username: id,
          displayName: 'Synthetic user',
          passwordHash: 'not-usable',
          status: 'ACTIVE',
          branches: { create: { branchId: branch } },
        },
      });
    await db.hrEmployee.create({
      data: {
        id: employee,
        branchId: branch,
        userId: sender,
        personnelCode: employee,
        name: 'Synthetic Employee',
        kind: 'تمام‌وقت',
        unit: 'فروش',
        position: 'کارشناس',
        grade: 'کارشناس',
        startedAt: new Date('2026-01-01'),
        status: 'فعال',
      },
    });
    const records = [
      {
        tab: 'workingHours',
        values: ['Work', '', '09:15', '17:00', 'همان روز', '6', '6'],
      },
      {
        tab: 'calculationSettings',
        values: [
          'Calculation',
          '[]',
          'خیر',
          '285',
          'خیر',
          'خیر',
          'بله',
          'خیر',
          'خیر',
          'روزانه',
        ],
      },
    ];
    for (const record of records)
      await db.hrRecord.create({
        data: {
          ...record,
          code: randomUUID(),
          branchId: branch,
          section: 'time',
          status: 'فعال',
        },
      });
    const database = { client: db };
    const hr = new HrService(
      database as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service = new CustomerAffairsService(
      new CustomerAffairsRepository(database as never),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new NotificationsService(new NotificationsRepository(database as never)),
      { workbenchFeedbackRecipientUserIds: async () => [reviewer] } as never,
      undefined,
      undefined,
      hr,
    );
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  async function request() {
    const id = randomUUID();
    await db.customerAffairsTicket.create({
      data: {
        id,
        trackingNumber: `TEST-${id.slice(0, 8)}`,
        branchId: branch,
        subject: 'Synthetic leave',
        description: 'Synthetic request',
        channel: 'CHAT',
        contactOccurredAt: new Date(),
        category: 'WORKBENCH_INTERNAL',
        serviceType: 'INTERNAL_REQUEST',
        impact: 'NORMAL',
        urgency: 'LOW',
        priority: 'NORMAL',
        customerOwnerUserId: sender,
        executionOwnerUserId: reviewer,
        executionUnit: 'منابع انسانی',
        references: [],
        slaPolicyVersion: 'test',
        firstResponseDueAt: new Date(),
        resolutionDueAt: new Date(Date.now() + 86400000),
        nextAction: 'Review',
        nextActionAt: new Date(),
        createdByUserId: sender,
        updatedByUserId: sender,
        timeline: {
          create: {
            type: 'WORKBENCH_LEAVE',
            summary: JSON.stringify(leave),
            actorUserId: sender,
            documentVersionIds: [],
          },
        },
      },
    });
    return id;
  }
  it('routes once after recipient consent without consuming leave before HR review', async () => {
    const id = await request();
    await db.customerAffairsTicket.update({
      where: { id },
      data: { executionUnit: 'فروش', executionOwnerUserId: initialReviewer },
    });
    const initialActor = {
      ...actor,
      userId: initialReviewer,
      permissions: [],
    } as AuthenticatedActor;
    const results = await Promise.allSettled([
      service.reviewHrWorkbenchRequest(
        id,
        { version: 1, status: 'APPROVED' },
        initialActor,
      ),
      service.reviewHrWorkbenchRequest(
        id,
        { version: 1, status: 'APPROVED' },
        initialActor,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.customerAffairsTicket.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      executionUnit: 'منابع انسانی',
      executionOwnerUserId: reviewer,
      version: 2,
    });
    expect(
      await db.customerAffairsTimeline.count({
        where: { ticketId: id, type: 'WORKBENCH_RECIPIENT_REVIEW' },
      }),
    ).toBe(1);
    expect(await db.hrRecord.count({ where: { code: `WB-${id}` } })).toBe(0);
  });
  it('repairs valid legacy settings drafts with an audit while preserving inactive and invalid records', async () => {
    const branchId = randomUUID();
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic settings repair' },
    });
    const values = [
      'Calculation',
      '[]',
      'خیر',
      '480',
      'خیر',
      'خیر',
      'بله',
      'خیر',
      'خیر',
      'تردد',
    ];
    const rows = [];
    for (const [status, minutes] of [
      ['پیش‌نویس', '480'],
      ['غیرفعال', '480'],
      ['پیش‌نویس', 'bad'],
    ]) {
      const row = await db.hrRecord.create({
        data: {
          branchId,
          section: 'time',
          tab: 'calculationSettings',
          status: status!,
          code: randomUUID(),
          values: values.map((v, i) => (i === 3 ? minutes! : v)),
        },
      });
      rows.push(row);
      await db.hrAuditEvent.create({
        data: {
          branchId,
          actorId: reviewer,
          recordId: row.id,
          action: 'CREATE',
          version: 1,
          changes: {},
        },
      });
    }
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations/20261108190000_activate_saved_calculation_settings/migration.sql',
      ),
      'utf8',
    )
      .replace(/^BEGIN;/, '')
      .replace(/COMMIT;\s*$/, '');
    await db.$executeRawUnsafe(sql);
    await db.$executeRawUnsafe(sql);
    const repaired = await db.hrRecord.findUniqueOrThrow({
      where: { id: rows[0]!.id },
    });
    expect(repaired).toMatchObject({ status: 'فعال', version: 2 });
    expect(
      (await db.hrRecord.findUniqueOrThrow({ where: { id: rows[1]!.id } }))
        .status,
    ).toBe('غیرفعال');
    expect(
      (await db.hrRecord.findUniqueOrThrow({ where: { id: rows[2]!.id } }))
        .status,
    ).toBe('پیش‌نویس');
    expect(
      await db.hrAuditEvent.count({
        where: { recordId: repaired.id, action: 'CALCULATION_SETTINGS_REPAIR' },
      }),
    ).toBe(1);
  });
  it('rolls back approval and native leave on insufficient balance; approved replay consumes once and replaces absence', async () => {
    const id = await request();
    await expect(
      service.reviewHrWorkbenchRequest(
        id,
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow('مانده');
    expect(
      (await db.customerAffairsTicket.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe('NEW');
    expect(await db.hrRecord.count({ where: { code: `WB-${id}` } })).toBe(0);
    await db.hrRecord.create({
      data: {
        branchId: branch,
        employeeId: employee,
        code: randomUUID(),
        section: 'time',
        tab: 'minuteLedger',
        values: [
          'Synthetic Employee',
          '1405',
          '8',
          'استحقاقی',
          'افزایش',
          '1000',
          '',
        ],
        status: 'تأییدشده',
      },
    });
    await service.reviewHrWorkbenchRequest(
      id,
      { version: 1, status: 'APPROVED' },
      actor,
    );
    await service.reviewHrWorkbenchRequest(
      id,
      { version: 1, status: 'APPROVED' },
      actor,
    );
    const record = await db.hrRecord.findUniqueOrThrow({
      where: { code: `WB-${id}` },
    });
    expect(record.status).toBe('تأییدشده');
    expect(
      await db.hrRecord.count({
        where: { parentId: record.id, tab: 'minuteLedger' },
      }),
    ).toBe(1);
    const attendance = await db.hrRecord.findFirstOrThrow({
      where: {
        employeeId: employee,
        tab: 'attendance',
        values: { path: ['1'], equals: leave.from },
      },
    });
    expect(attendance.status).toBe('مرخصی');
    expect(attendance.data).toMatchObject({
      deficitMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
    });
    const own = await service.workbenchRequests({ ...actor, userId: sender });
    expect(own.data.find((row) => row.id === id)?.status).toBe('APPROVED');
  }, 30000);
  it('does not create leave for rejected or revision decisions', async () => {
    for (const status of ['REJECTED', 'NEEDS_REVISION']) {
      const id = await request();
      await service.reviewHrWorkbenchRequest(id, { version: 1, status }, actor);
      expect(await db.hrRecord.count({ where: { code: `WB-${id}` } })).toBe(0);
    }
  }, 30000);
});
