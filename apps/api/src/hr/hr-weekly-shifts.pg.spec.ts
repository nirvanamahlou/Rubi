import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { HrService } from './hr.service';
import { HrSelfPerformanceService } from './hr-self-performance.service';

describe.skipIf(process.env.HR_WEEKLY_SHIFTS_DATABASE_TEST !== '1')(
  'Weekly shifts PostgreSQL',
  () => {
    let database: DatabaseService;
    let service: HrService;
    let actor: AuthenticatedActor;
    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL ?? '');
      if (
        target.hostname !== '127.0.0.1' ||
        target.port !== '55593' ||
        target.pathname !== '/nora_ci'
      )
        throw new Error('Dedicated disposable database required');
      database = new DatabaseService();
      service = new HrService(database, {} as never, {} as never, {} as never);
      const user = await database.client.user.create({
        data: {
          username: `shift-${randomUUID()}`,
          displayName: 'Synthetic shifts',
          passwordHash: 'disabled-synthetic',
        },
      });
      actor = {
        userId: user.id,
        sessionId: randomUUID(),
        branchIds: [],
        permissions: ['hr.manage', 'hr.read'],
      };
    });
    afterAll(async () => {
      await database?.onModuleDestroy();
    });
    async function fixture() {
      const branch = await database.client.branch.create({
        data: {
          code: `SHF-${randomUUID().slice(0, 12)}`,
          name: 'Synthetic shifts',
        },
      });
      const staff = await Promise.all(
        [1, 2].map(async (i) =>
          database.client.hrEmployee.create({
            data: {
              branchId: branch.id,
              personnelCode: `SHF-${randomUUID()}`,
              name: `Synthetic ${i}`,
              kind: 'تمام‌وقت',
              unit: 'Synthetic',
              position: 'Synthetic',
              grade: '1',
              startedAt: new Date('2020-01-01'),
            },
          }),
        ),
      );
      const reader = { ...actor, branchIds: [branch.id] };
      const input = {
        branchId: branch.id,
        employeeIds: staff.map((e) => e.id),
        title: 'Synthetic Sunday',
        weekday: 'یکشنبه',
        start: '09:00',
        end: '17:00',
        from: '2026-10-01',
        to: '2026-11-02',
      };
      return { reader, input, staff };
    }
    it('assigns every selected employee atomically, replays once and rejects foreign staff', async () => {
      const { reader, input } = await fixture();
      const key = randomUUID();
      const rows = await service.assignWeeklyShift(input, key, reader);
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.values[9] === 'یکشنبه')).toBe(true);
      expect(
        (await service.assignWeeklyShift(input, key, reader)).map((r) => r.id),
      ).toEqual(rows.map((r) => r.id));
      await expect(
        service.assignWeeklyShift({ ...input, title: 'Changed' }, key, reader),
      ).rejects.toThrow();
      const other = await fixture();
      await expect(
        service.assignWeeklyShift(
          { ...input, employeeIds: [input.employeeIds[0], other.staff[0]!.id] },
          randomUUID(),
          reader,
        ),
      ).rejects.toThrow();
      expect(
        await database.client.hrRecord.count({
          where: { branchId: input.branchId, tab: 'shift' },
        }),
      ).toBe(2);
      await expect(
        service.assignWeeklyShift(input, randomUUID(), {
          ...reader,
          permissions: ['hr.self'],
        }),
      ).rejects.toThrow();
    });
    it('processes paired device punches, scheduled absence, rest days and overnight shifts', async () => {
      const { reader, input, staff } = await fixture();
      await service.assignWeeklyShift(input, randomUUID(), reader);
      await service.importDevicePunches(
        {
          branchId: input.branchId,
          source: 'synthetic-weekly',
          punches: [
            {
              id: randomUUID(),
              personnelCode: staff[0]!.personnelCode,
              date: '2026-11-01',
              time: '09:00',
              kind: 'ورود',
              accepted: true,
            },
            {
              id: randomUUID(),
              personnelCode: staff[0]!.personnelCode,
              date: '2026-11-01',
              time: '17:00',
              kind: 'خروج',
              accepted: true,
            },
          ],
        },
        randomUUID(),
        reader,
      );
      await service.processAttendance(
        { branchId: input.branchId, date: '2026-11-01' },
        randomUUID(),
        reader,
        true,
      );
      await service.processAttendance(
        { branchId: input.branchId, date: '2026-11-02' },
        randomUUID(),
        reader,
        true,
      );
      const attendance = await database.client.hrRecord.findMany({
        where: { branchId: input.branchId, tab: 'attendance' },
      });
      expect(
        attendance.find(
          (r) =>
            r.employeeId === staff[0]!.id &&
            (r.values as string[])[1] === '2026-11-01',
        )?.status,
      ).toBe('حاضر');
      expect(
        attendance.find(
          (r) =>
            r.employeeId === staff[1]!.id &&
            (r.values as string[])[1] === '2026-11-01',
        )?.status,
      ).toBe('غایب');
      expect(
        attendance
          .filter((r) => (r.values as string[])[1] === '2026-11-02')
          .map((r) => r.status),
      ).toEqual(['عدم روزکاری', 'عدم روزکاری']);
      const night = await fixture();
      await service.assignWeeklyShift(
        { ...night.input, start: '22:00', end: '06:00' },
        randomUUID(),
        night.reader,
      );
      await service.importDevicePunches(
        {
          branchId: night.input.branchId,
          source: 'synthetic-night',
          punches: [
            {
              id: randomUUID(),
              personnelCode: night.staff[0]!.personnelCode,
              date: '2026-11-01',
              time: '22:00',
              kind: 'ورود',
              accepted: true,
            },
            {
              id: randomUUID(),
              personnelCode: night.staff[0]!.personnelCode,
              date: '2026-11-02',
              time: '06:00',
              kind: 'خروج',
              accepted: true,
            },
          ],
        },
        randomUUID(),
        night.reader,
      );
      await service.processAttendance(
        { branchId: night.input.branchId, date: '2026-11-01' },
        randomUUID(),
        night.reader,
        true,
      );
      const result = await database.client.hrRecord.findFirstOrThrow({
        where: { employeeId: night.staff[0]!.id, tab: 'attendance' },
      });
      expect(result.status).toBe('حاضر');
      expect((result.data as { workedMinutes: number }).workedMinutes).toBe(
        480,
      );
    });
    it('supports versioned editing and deletion and exposes only own shifts in Workbench', async () => {
      const { reader, input, staff } = await fixture();
      await database.client.hrEmployee.update({
        where: { id: staff[0]!.id },
        data: { userId: actor.userId },
      });
      const rows = await service.assignWeeklyShift(input, randomUUID(), reader);
      const own = rows.find((r) => r.employeeId === staff[0]!.id)!;
      const values = [...own.values];
      values[0] = 'Updated';
      values[9] = 'دوشنبه';
      const edited = await service.updateRecord(
        own.id,
        { version: own.version, values },
        reader,
      );
      const projection = await new HrSelfPerformanceService(
        database,
        service,
      ).get({ ...reader, permissions: [] }, 30, true);
      expect(projection.shifts.map((r) => r.id)).toEqual([own.id]);
      expect(projection.shifts[0]!.fields).toContainEqual({
        label: 'روز هفته',
        value: 'دوشنبه',
      });
      await expect(
        service.deleteRecord(own.id, own.version, reader),
      ).rejects.toThrow();
      await service.deleteRecord(own.id, edited.version, reader);
      expect(
        (
          await new HrSelfPerformanceService(database, service).get(
            { ...reader, permissions: [] },
            30,
            true,
          )
        ).shifts,
      ).toEqual([]);
    });
    it('shows no-work days without an assignment and waits until a scheduled shift ends', async () => {
      const { reader, input, staff } = await fixture();
      await service.processAttendance(
        { branchId: input.branchId, date: '2026-11-01' },
        randomUUID(),
        reader,
        true,
      );
      const rest = await database.client.hrRecord.findMany({
        where: { branchId: input.branchId, tab: 'attendance' },
      });
      expect(rest.map((r) => r.status)).toEqual(['عدم روزکاری', 'عدم روزکاری']);
      await service.assignWeeklyShift(
        { ...input, from: '2099-11-01', to: '2099-11-01', weekday: 'یکشنبه' },
        randomUUID(),
        reader,
      );
      await service.processAttendance(
        { branchId: input.branchId, date: '2099-11-01' },
        randomUUID(),
        reader,
        true,
      );
      const future = await database.client.hrRecord.findFirstOrThrow({
        where: {
          employeeId: staff[0]!.id,
          tab: 'attendance',
          values: { path: ['1'], equals: '2099-11-01' },
        },
      });
      expect(future.status).toBe('در انتظار تردد');
    });

    it('rejects invalid ranges and protects any overlapping closed period', async () => {
      const { reader, input } = await fixture();
      await expect(
        service.assignWeeklyShift(
          { ...input, weekday: 'invalid' },
          randomUUID(),
          reader,
        ),
      ).rejects.toThrow();
      await expect(
        service.assignWeeklyShift(
          { ...input, to: '2026-09-30' },
          randomUUID(),
          reader,
        ),
      ).rejects.toThrow();
      await database.client.hrRecord.create({
        data: {
          branchId: input.branchId,
          section: 'time',
          tab: 'periods',
          code: randomUUID(),
          values: ['Closed', '2026-10-10', '2026-10-20'],
          status: 'بسته‌شده',
        },
      });
      await expect(
        service.assignWeeklyShift(input, randomUUID(), reader),
      ).rejects.toThrow('بسته');
      await expect(
        service.processAttendance(
          { branchId: input.branchId, date: '2026-10-12' },
          randomUUID(),
          reader,
          true,
        ),
      ).resolves.toMatchObject({ processed: 0 });
    });
  },
);
