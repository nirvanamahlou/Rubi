import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HrService } from './hr.service';
const enabled = process.env.NORA_RUN_HR_PENALTY_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)('persisted attendance penalty settings', () => {
  let client: DatabaseClient;
  const branchId = randomUUID(),
    employeeId = randomUUID();
  let policyId: string;
  let service: HrService;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/nora_ci'
    )
      throw new Error('A local disposable nora_ci database is required.');
    client = createDatabaseClient(url.toString());
    await client.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic penalty branch' },
    });
    await client.hrEmployee.create({
      data: {
        id: employeeId,
        branchId,
        personnelCode: employeeId,
        name: 'Synthetic employee',
        kind: 'تمام‌وقت',
        unit: 'test',
        position: 'test',
        grade: 'test',
        startedAt: new Date('2026-01-01'),
      },
    });
    const create = (tab: string, values: string[], extra = {}) =>
      client.hrRecord.create({
        data: {
          branchId,
          section: 'time',
          tab,
          code: randomUUID(),
          status: 'فعال',
          values,
          data: {},
          ...extra,
        },
      });
    policyId = (
      await create('penaltySettings', [
        '50000',
        '60000',
        '2026-11-01',
        'بله',
        'بله',
        'بله',
      ])
    ).id;
    await create('workingHours', ['Test', '', '09:00', '17:00', 'همان روز']);
    await create('checkins', ['Test', '2026-11-08', '09:10', 'ورود'], {
      employeeId,
    });
    await create('checkins', ['Test', '2026-11-08', '16:55', 'خروج'], {
      employeeId,
    });
    service = new HrService(
      { client } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });
  afterAll(async () => {
    await client?.$disconnect();
  });
  const amount = () =>
    (
      service as unknown as {
        dailyPenalty: (row: unknown) => Promise<string | null>;
      }
    ).dailyPenalty({
      branchId,
      section: 'time',
      tab: 'attendance',
      employeeId,
      values: ['', '2026-11-08'],
    });
  it('uses persisted rates and live approved exemptions without changing device punches', async () => {
    expect(await amount()).toBe('800000');
    const leave = await client.hrRecord.create({
      data: {
        branchId,
        employeeId,
        section: 'requests',
        tab: 'radanLeave',
        code: randomUUID(),
        status: 'در انتظار تأیید',
        values: ['', '', '', '', 'ساعتی'],
        data: {
          startsAt: '2026-11-08T05:30:00Z',
          endsAt: '2026-11-08T05:40:00Z',
        },
      },
    });
    expect(await amount()).toBe('800000');
    await client.hrRecord.update({
      where: { id: leave.id },
      data: { status: 'تأییدشده' },
    });
    expect(await amount()).toBe('300000');
    await client.hrRecord.update({
      where: { id: policyId },
      data: { values: ['50000', '60000', '2026-11-01', 'بله', 'خیر', 'بله'] },
    });
    expect(await amount()).toBe('800000');
    await client.hrRecord.update({
      where: { id: policyId },
      data: { values: ['50000', '60000', '2026-12-01', 'بله', 'بله', 'بله'] },
    });
    expect(await amount()).toBeNull();
    expect(
      await client.hrRecord.count({
        where: { branchId, tab: 'checkins', deletedAt: null },
      }),
    ).toBe(2);
  });
});
