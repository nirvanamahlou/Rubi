import { describe, it, expect, vi } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { recordValues } from './hr.validation';
import { HrService } from './hr.service';

const hours = ['روز', '', '08:00', '16:00', 'همان روز', '2', '3', '#123abc'];
describe('Radan observed forms and legacy compatibility', () => {
  it('accepts same, next and two-day schedules and rejects impossible same-day range', () => {
    const schema = getHrResource('time', 'workingHours')!;
    expect(recordValues(hours, schema)[2]).toBe('08:00');
    expect(() =>
      recordValues([...hours.slice(0, 3), '06:00', ...hours.slice(4)], schema),
    ).toThrow();
    for (const end of ['یک روز بعد', 'دو روز بعد']) {
      const values = [...hours];
      values[4] = end;
      expect(recordValues(values, schema)[4]).toBe(end);
    }
    const invalid = [...hours];
    invalid[5] = '49';
    expect(() => recordValues(invalid, schema)).toThrow();
  });
  it('pads old devices without moving fields and rejects invalid new ports/types', () => {
    const schema = getHrResource('time', 'biometric')!;
    expect(
      recordValues(['دستگاه', 'A', 'شعبه', '', '', ''], schema),
    ).toHaveLength(10);
    for (const port of ['0', '65536', '12x'])
      expect(() =>
        recordValues(
          ['دستگاه', 'A', 'شعبه', '', '', '', '192.168.1.2', port, 'ZK', ''],
          schema,
        ),
      ).toThrow();
    expect(
      recordValues(
        ['دستگاه', 'A', 'شعبه', '', '', '', '192.168.1.2', '4370', 'ZK', ''],
        schema,
      )[8],
    ).toBe('ZK');
  });
  it('requires a valid hourly remote interval and dates', () => {
    const schema = getHrResource('time', 'remote')!;
    expect(() =>
      recordValues(
        ['همکار', '2026-10-20', '2026-10-20', 'ساعتی', '', ''],
        schema,
      ),
    ).toThrow();
    expect(
      recordValues(
        ['همکار', '2026-10-20', '2026-10-20', 'ساعتی', '08:00', '10:00'],
        schema,
      ),
    ).toHaveLength(6);
    expect(() =>
      recordValues(
        ['همکار', '2026-10-20', '2026-10-21', 'ساعتی', '08:00', '10:00'],
        schema,
      ),
    ).toThrow();
  });
});

describe('request history date filter', () => {
  it('uses an exclusive next-day creation bound without dropping the authorization scope', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const scope = { branchId: { in: ['allowed-branch'] }, deletedAt: null };
    const target = {
      database: {
        client: { hrRecord: { findMany, count: vi.fn().mockResolvedValue(0) } },
      },
      recordScope: () => scope,
      recordDtos: async () => [],
      auditRead: vi.fn(),
    };
    await HrService.prototype.listRecords.call(
      target as never,
      {
        from: '2026-10-01',
        to: '2026-10-20',
        dateField: 'createdAt',
        sortBy: 'name',
      },
      {} as never,
    );
    const query = findMany.mock.calls[0]![0];
    expect(query.where.AND[0]).toEqual(scope);
    expect(query.where.AND[1].createdAt.lt.toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    );
    expect(query.orderBy).toEqual([
      { employee: { name: 'asc' } },
      { id: 'asc' },
    ]);
    await expect(
      HrService.prototype.listRecords.call(
        target as never,
        { sortBy: 'arbitrary' },
        {} as never,
      ),
    ).rejects.toThrow();
  });
});

describe('working-hours attendance window', () => {
  it('includes an exit exactly at shift end when the after-window is zero', () => {
    const shift = {
      id: 's',
      tab: 'shift',
      employeeId: 'e',
      status: 'فعال',
      values: [
        'Day',
        '08:00',
        '16:00',
        '0',
        '480',
        '',
        'e',
        '2026-10-20',
        '2026-10-20',
      ],
      data: {
        shiftEndDayOffset: 0,
        attendanceBeforeHours: 0,
        attendanceAfterHours: 0,
      },
    };
    const punch = (kind: string, time: string) => ({
      id: kind,
      tab: 'checkins',
      employeeId: 'e',
      parentId: null,
      values: ['Employee', '2026-10-20', time, kind],
      data: {},
      createdAt: new Date('2026-10-20T00:00:00Z'),
    });
    const view = (
      HrService.prototype as unknown as {
        attendanceView: (
          source: unknown[],
          employeeId: string,
          date: string,
        ) => { result: { worked: number; exceptions: string[] } };
      }
    ).attendanceView;
    const result = view.call(
      {},
      [shift, punch('ورود', '08:00'), punch('خروج', '16:00')],
      'e',
      '2026-10-20',
    );
    expect(result.result.worked).toBe(480);
    expect(result.result.exceptions).toEqual([]);
  });
});

it('rejects repeated multi-day long shifts while accepting a single start-day snapshot', async () => {
  const findFirst = vi.fn().mockResolvedValue({
    values: ['Long', '', '08:00', '16:00', 'دو روز بعد', '۰', '۰', '#123456'],
  });
  const tx = { hrRecord: { findFirst } };
  const schema = getHrResource('time', 'shift')!;
  const values = [
    'Long',
    '08:00',
    '16:00',
    '0',
    '480',
    '',
    'Employee',
    '2026-10-20',
    '2026-10-22',
  ];
  const derive = (
    HrService.prototype as unknown as {
      values: (
        tx: unknown,
        schema: unknown,
        input: unknown,
        employee: unknown,
        branch: string,
        data: Record<string, unknown>,
        parentId: string,
      ) => Promise<string[]>;
    }
  ).values;
  await expect(
    derive.call({}, tx, schema, values, null, 'branch', {}, 'hours'),
  ).rejects.toThrow();
  const data: Record<string, unknown> = {};
  await expect(
    derive.call(
      {},
      tx,
      schema,
      [...values.slice(0, 8), '2026-10-20'],
      null,
      'branch',
      data,
      'hours',
    ),
  ).resolves.toHaveLength(9);
  expect(data.attendanceBeforeHours).toBe(0);
  expect(data.shiftEndDayOffset).toBe(2);
  expect(
    findFirst.mock.calls.find(
      (call) => call[0].where.tab === 'workingHours',
    )![0].where,
  ).toMatchObject({
    id: 'hours',
    branchId: 'branch',
    section: 'time',
    tab: 'workingHours',
    status: 'فعال',
    deletedAt: null,
  });
});

it('stores the actual hourly remote interval in UTC and clears stale hourly minutes for daily mode', async () => {
  const derive = (
    HrService.prototype as unknown as {
      values: (
        tx: unknown,
        schema: unknown,
        input: unknown,
        employee: unknown,
        branch: string,
        data: Record<string, unknown>,
      ) => Promise<string[]>;
    }
  ).values;
  const schema = getHrResource('time', 'remote')!;
  const data: Record<string, unknown> = {
    startsAt: '2026-10-20T00:00:00.000Z',
    endsAt: '2026-10-20T23:59:59.999Z',
    minutes: 999,
  };
  await derive.call(
    {},
    null,
    schema,
    ['Employee', '2026-10-20', '2026-10-20', 'ساعتی', '08:00', '10:00'],
    null,
    'branch',
    data,
  );
  expect(data.startsAt).toBe('2026-10-20T04:30:00.000Z');
  expect(data.endsAt).toBe('2026-10-20T06:30:00.000Z');
  expect(data.minutes).toBe(120);
  await derive.call(
    {},
    null,
    schema,
    ['Employee', '2026-10-20', '2026-10-21', 'روزانه', '', ''],
    null,
    'branch',
    data,
  );
  expect(data.minutes).toBeUndefined();
  expect(data.startsAt).toBe('2026-10-20T00:00:00.000Z');
  expect(data.endsAt).toBe('2026-10-21T23:59:59.999Z');
});

describe('optional HR national ID', () => {
  it('accepts blank and valid IDs while rejecting malformed supplied IDs', () => {
    const schema = getHrResource('employee', 'identity')!;
    const values = [
      'Synthetic',
      'Worker',
      '',
      '',
      '',
      '',
      'مرد',
      'مجرد',
      '',
      '',
      'نامشخص',
      'ایرانی',
      'نامشخص',
      '',
    ];
    expect(schema.fields[2]?.required).toBe(false);
    for (const id of ['', '   ', '0123456789', '۰۱۲۳۴۵۶۷۸۹'])
      expect(() =>
        recordValues(
          values.map((v, i) => (i === 2 ? id : v)),
          schema,
        ),
      ).not.toThrow();
    for (const id of ['123', 'abcdefghij', '01234567890'])
      expect(() =>
        recordValues(
          values.map((v, i) => (i === 2 ? id : v)),
          schema,
        ),
      ).toThrow();
  });
});

describe('HR postal code and shared job title shape', () => {
  it('accepts legacy identity14, pads a blank postal code and validates optional Persian/ASCII ten digits', () => {
    const schema = getHrResource('employee', 'identity')!;
    const legacy = [
      'Synthetic',
      'Worker',
      '',
      '',
      '',
      '',
      'مرد',
      'مجرد',
      '',
      '',
      'نامشخص',
      'ایرانی',
      'نامشخص',
      'Address',
    ];
    expect(recordValues(legacy, schema)).toEqual([...legacy, '']);
    for (const postal of ['', '0123456789', '۰۱۲۳۴۵۶۷۸۹'])
      expect(recordValues([...legacy, postal], schema)[14]).toBe(postal);
    for (const postal of ['123', 'abcdefghij', '12345678901'])
      expect(() => recordValues([...legacy, postal], schema)).toThrow();
  });
  it('retains legacy position slots while making only the canonical job title mandatory', () => {
    const schema = getHrResource('organization', 'positions')!;
    expect(schema.fields[0]?.required).toBe(false);
    expect(schema.fields[1]?.required).toBe(true);
    expect(recordValues(['', 'Shared title', '', '', '', ''], schema)[1]).toBe(
      'Shared title',
    );
    expect(recordValues(['Legacy title', '', '', '', '', ''], schema)[1]).toBe(
      'Legacy title',
    );
    expect(() => recordValues(['', '', '', '', '', ''], schema)).toThrow();
  });
});
