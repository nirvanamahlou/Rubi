import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import {
  findReservationEditReference,
  reservationEditReferenceOption,
} from './reservation-edit-references';

const record = (overrides: Partial<MasterDataRecord> = {}): MasterDataRecord =>
  ({
    id: 'reference-1',
    resource: 'airlines',
    code: 'IR-001',
    name: 'ایرلاین نمونه',
    status: 'active',
    version: 1,
    attributes: { englishName: 'Sample Air' },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }) as MasterDataRecord;

describe('reservation operational reference choices', () => {
  it('uses the English airline/hotel label while retaining every directory alias', () => {
    const option = reservationEditReferenceOption('airlines', record());
    expect(option.label).toBe('Sample Air');
    expect(option.searchText).toContain('ایرلاین نمونه');
    expect(option.searchText).toContain('IR-001');
  });

  it('matches existing snapshots by Persian or English names and rejects free text', () => {
    const option = reservationEditReferenceOption('airlines', record());
    expect(findReservationEditReference('Sample Air', [option])?.id).toBe(
      'reference-1',
    );
    expect(findReservationEditReference('ايرلاين نمونه', [option])?.id).toBe(
      'reference-1',
    );
    expect(findReservationEditReference('نام دستی', [option])).toBeUndefined();
  });

  it('keeps a broker Persian display name instead of replacing it with metadata', () => {
    expect(reservationEditReferenceOption('brokers', record()).label).toBe(
      'ایرلاین نمونه',
    );
  });
});
