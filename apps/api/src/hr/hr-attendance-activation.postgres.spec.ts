import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@nora/database';
import { expect, it } from 'vitest';
import { HrService } from './hr.service';
import type { AuthenticatedActor } from '@nora/contracts';
it.skipIf(process.env.NORA_RUN_HR_PENALTY_POSTGRES_TESTS !== '1')(
  'persists exclusion through sync, reactivation, replay and transaction rollback without changing raw punches',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/nora_ci'
    )
      throw new Error('Disposable local nora_ci required');
    const client = createDatabaseClient(url.toString());
    try {
      const branch = await client.branch.create({
        data: { code: randomUUID(), name: 'Synthetic activation' },
      });
      const user = await client.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Synthetic activation',
          passwordHash: 'disabled',
        },
      });
      const employee = await client.hrEmployee.create({
        data: {
          branchId: branch.id,
          personnelCode: randomUUID(),
          name: 'Synthetic activation',
          kind: 'تمام‌وقت',
          unit: 'Test',
          position: 'Test',
          grade: 'Test',
          startedAt: new Date('2020-01-01'),
        },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        sessionId: randomUUID(),
        branchIds: [branch.id],
        permissions: ['hr.manage', 'hr.read'],
      };
      const service = new HrService(
        { client } as never,
        {
          describeMessagingParticipants: async () => [
            { id: user.id, username: 'demo' },
          ],
        } as never,
        {} as never,
        {} as never,
      );
      for (const [time, direction] of [
        ['09:00', 'ورود'],
        ['17:00', 'خروج'],
      ])
        await client.hrRecord.create({
          data: {
            branchId: branch.id,
            employeeId: employee.id,
            section: 'time',
            tab: 'checkins',
            code: randomUUID(),
            status: 'تأییدشده',
            values: [employee.name, '2026-11-08', time!, direction!],
            data: { attendanceSource: 'synthetic' },
          },
        });
      await client.hrRecord.create({
        data: {
          branchId: branch.id,
          section: 'time',
          tab: 'workingHours',
          code: randomUUID(),
          status: 'فعال',
          values: ['Day', '', '09:00', '17:00', 'همان روز'],
          data: {},
        },
      });
      const raw = () =>
        client.hrRecord.findMany({
          where: { branchId: branch.id, tab: 'checkins' },
          orderBy: { id: 'asc' },
        });
      const before = await raw();
      const input = {
        employeeIds: [employee.id],
        from: '2026-11-08',
        to: '2026-11-09',
        active: false,
      };
      const key = randomUUID();
      expect(await service.setAttendanceActivation(input, key, actor)).toEqual({
        changed: 2,
      });
      expect(await service.setAttendanceActivation(input, key, actor)).toEqual({
        changed: 2,
      });
      await service.processAttendance(
        { branchId: branch.id, date: '2026-11-08' },
        randomUUID(),
        actor,
      );
      const row = await client.hrRecord.findFirstOrThrow({
        where: {
          branchId: branch.id,
          tab: 'attendance',
          values: { path: ['1'], equals: input.from },
        },
      });
      expect(row.status).toBe('غیرفعال');
      expect(row.data).toMatchObject({
        attendanceActive: false,
        workedMinutes: 480,
      });
      await service.setAttendanceActivation(
        {
          ...input,
          to: input.from,
          active: true,
          recordId: row.id,
          version: row.version,
        },
        randomUUID(),
        actor,
      );
      expect(
        (await client.hrRecord.findUniqueOrThrow({ where: { id: row.id } }))
          .status,
      ).toBe('حاضر');
      await expect(
        service.setAttendanceActivation(
          { ...input, employeeIds: [employee.id, randomUUID()] },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow();
      expect(
        (await client.hrRecord.findUniqueOrThrow({ where: { id: row.id } }))
          .status,
      ).toBe('حاضر');
      expect(await raw()).toEqual(before);
    } finally {
      await client.$disconnect();
    }
  },
  30000,
);
