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
    for (const id of [sender, reviewer])
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
      {} as never,
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
