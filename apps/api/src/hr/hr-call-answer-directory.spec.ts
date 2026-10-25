import { describe, expect, it, vi } from 'vitest';
import { HrCallAnswerDirectory } from './hr-call-answer-directory';
import type { DatabaseService } from '../database/database.service';

describe('HR call answer directory', () => {
  it('returns every matching person for a shared extension without choosing an owner', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { name: 'Person A', unit: 'Sales' },
      { name: 'Person B', unit: 'Visa' },
    ]);
    const service = new HrCallAnswerDirectory({
      client: { hrEmployee: { findMany } },
    } as unknown as DatabaseService);
    const result = await service.resolve(
      'branch-a',
      '203',
      '2026-10-22T10:00:00Z',
    );
    expect(result.shared).toBe(true);
    expect(result.label).toContain('Sales - Person A - 203');
    expect(result.label).toContain('Visa - Person B - 203');
    expect(result).not.toHaveProperty('userId');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-a',
          status: 'فعال',
          deletedAt: null,
        }),
      }),
    );
  });
  it('retains a confirmed extension when no employee mapping exists', async () => {
    const service = new HrCallAnswerDirectory({
      client: { hrEmployee: { findMany: async () => [] } },
    } as unknown as DatabaseService);
    expect(
      await service.resolve('branch-a', '001', '2026-10-22T10:00:00Z'),
    ).toMatchObject({ label: 'داخلی 001', shared: false });
  });
});
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  privateAnswerDirectory,
  callDestinationLabel,
} from './hr-call-answer-directory';

it('formats recorded job title, department, full name and extension in requested order', () => {
  expect(
    callDestinationLabel({
      position: 'کارشناس',
      unit: 'شرکت آزمایشی / فروش',
      name: 'کارمند آزمایشی',
      extension: '404',
    }),
  ).toBe('کارشناس فروش - کارمند آزمایشی - 404');
});
it.each([
  ['کارشناس فروش', 'فروش'],
  ['مدیر رزرواسیون', 'رزرواسیون'],
  ['کارشناس هوش مصنوعی', 'هوش مصنوعی'],
  ['کارشناس هوش مصنوعي', 'هوش مصنوعی'],
])('does not repeat department already present in %s', (position, unit) => {
  expect(
    callDestinationLabel({
      position,
      unit: `شرکت / ${unit}`,
      name: 'کارمند آزمایشی',
      extension: '404',
    }),
  ).toBe(`${position} - کارمند آزمایشی - 404`);
});

it('lists distinct employees on shared extensions using only the requested active branch', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      name: 'Person A',
      unit: 'Company / Sales',
      position: 'Expert',
      records: [{ values: ['203'] }],
    },
    {
      name: 'Person B',
      unit: 'Company / Visa',
      position: 'Manager',
      records: [{ values: ['203'] }],
    },
  ]);
  const directory = new HrCallAnswerDirectory({
    client: { hrEmployee: { findMany } },
  } as unknown as DatabaseService);
  expect(await directory.options('branch-a')).toEqual([
    { label: 'Expert Sales - Person A - 203', extension: '203' },
    { label: 'Manager Visa - Person B - 203', extension: '203' },
  ]);
  expect(findMany.mock.calls[0]?.[0].where).toEqual({
    branchId: 'branch-a',
    status: 'فعال',
    deletedAt: null,
  });
});

it('does not resurrect the private snapshot when HR contains inactive or deleted employees', async () => {
  const directory = new HrCallAnswerDirectory({
    client: { hrEmployee: { findMany: async () => [], count: async () => 1 } },
  } as unknown as DatabaseService);
  expect(await directory.options('branch-a', 'pbx-a')).toEqual([]);
});

it('scopes a private bootstrap directory to the exact PBX connection and branch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'answer-directory-'));
  const path = join(dir, 'directory.json');
  try {
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        branchId: 'a',
        connectionId: 'pbx-a',
        employees: [
          { extension: '203', name: 'Synthetic A', unit: 'Sales' },
          { extension: '203', name: 'Synthetic B', unit: 'Visa' },
        ],
      }),
    );
    expect(privateAnswerDirectory(path, 'a', 'pbx-a', '203')).toHaveLength(2);
    expect(privateAnswerDirectory(path, 'b', 'pbx-a', '203')).toEqual([]);
    expect(privateAnswerDirectory(path, 'a', 'pbx-b', '203')).toEqual([]);
    expect(privateAnswerDirectory(path, 'a', 'pbx-a', '404')).toEqual([]);
    writeFileSync(path, 'invalid');
    expect(privateAnswerDirectory(path, 'a', 'pbx-a', '203')).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
