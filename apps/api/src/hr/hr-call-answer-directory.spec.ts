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
    expect(result.label).toContain('Person A (Sales)');
    expect(result.label).toContain('Person B (Visa)');
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
import { privateAnswerDirectory } from './hr-call-answer-directory';

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
