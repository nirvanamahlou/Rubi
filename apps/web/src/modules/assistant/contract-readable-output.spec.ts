import { describe, expect, it } from 'vitest';
import { contractUpdateTime } from './contract-inspection-text';
import { contractGuidePath } from './contract-guides';

describe('readable contract output', () => {
  it('uses an actual arrow for navigation', () => {
    const path = contractGuidePath([
      'فروش و ارتباط با مشتری',
      'قرارداد',
      'قرارداد جدید',
    ]);
    expect(path).toContain(' → ');
    expect(path).not.toContain('->');
  });
  it('separates the Persian date and Tehran clock time including day rollover', () => {
    const lines = contractUpdateTime('2026-11-11T21:15:00Z');
    expect(lines).toEqual([
      'تاریخ آخرین تغییر قرارداد: ۱۴۰۵/۰۸/۲۱',
      'ساعت آخرین تغییر قرارداد (تهران): ۰۰:۴۵:۰۰',
    ]);
    expect(lines.join('\n')).not.toContain('T21:');
  });
  it('does not invent a time for an invalid source timestamp', () => {
    expect(contractUpdateTime('invalid')).toEqual([]);
  });
});
