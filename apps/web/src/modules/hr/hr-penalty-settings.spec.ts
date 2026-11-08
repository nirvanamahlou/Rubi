import { expect, it } from 'vitest';
import type { HrRecordDto } from '@nora/contracts';
import { savedPenaltySettings } from './hr-penalty-settings';
const record = (id: string, data = {}, overrides = {}) =>
  ({
    id,
    branchId: 'branch',
    section: 'time',
    tab: 'penaltySettings',
    deletedAt: null,
    createdAt: id,
    data,
    values: ['1200', '2400', '2026-11-08', 'بله', 'خیر', 'بله'],
    version: 3,
    ...overrides,
  }) as HrRecordDto;
it('reopens the saved record and its values/version instead of new defaults', () => {
  const saved = record('2');
  expect(savedPenaltySettings([record('1'), saved], 'branch')).toBe(saved);
});
it('keeps organization and headquarters settings separate', () => {
  const company = {
    isHeadquarters: false,
    organizationBranchId: 'org',
    aliases: ['org'],
  };
  const own = record('1', { organizationBranchId: 'org' });
  const shared = record('9', { allBranches: true });
  expect(
    savedPenaltySettings(
      [own, shared, record('8', { organizationBranchId: 'other' })],
      'branch',
      company,
    ),
  ).toBe(own);
  expect(
    savedPenaltySettings([own, shared], 'branch', {
      ...company,
      isHeadquarters: true,
    }),
  ).toBe(shared);
});
it('does not load another branch, deleted settings or another resource', () => {
  expect(
    savedPenaltySettings(
      [
        record('1', {}, { branchId: 'other' }),
        record('2', {}, { deletedAt: '2026-11-08' }),
        record('3', {}, { tab: 'shift' }),
      ],
      'branch',
    ),
  ).toBeUndefined();
});
