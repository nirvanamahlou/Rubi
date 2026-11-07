import { describe, expect, it } from 'vitest';
import { HR_RADAN_CONTRACT_TYPES, getHrResource } from '@nora/contracts';
import { radanOptionalLabels } from './hr-form-model';
import { buildContextualHrFields } from './contextual-hr-form';
describe('Radan field rules stay inside the observed forms', () => {
  it('does not relax required inputs on unrelated existing contracts, recruitment or leave forms', () => {
    for (const [section, tab] of [
      ['contracts', 'active'],
      ['recruitment', 'staffing'],
      ['time', 'leave'],
      ['time', 'shift'],
    ])
      expect(radanOptionalLabels(getHrResource(section!, tab!)!)).toEqual([]);
  });
  it('keeps working-hours clocks mandatory while allowing description and color', () => {
    const labels = radanOptionalLabels(getHrResource('time', 'workingHours')!);
    expect(labels).toContain('توضیحات');
    expect(labels).toContain('رنگ');
    expect(labels).not.toContain('ساعت شروع');
    expect(labels).not.toContain('روز پایان');
  });
});

it('offers probationary and temporary contract kinds without removing historical labels', () => {
  expect(buildContextualHrFields(['نوع قرارداد'])[0]?.options).toEqual(
    expect.arrayContaining(['آزمایشی', 'موقت']),
  );
  expect(HR_RADAN_CONTRACT_TYPES).toEqual(
    expect.arrayContaining(['قراردادی', 'آزمایشی', 'موقت', 'موقت (مدت معین)']),
  );
});
