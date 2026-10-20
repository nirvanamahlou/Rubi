import { describe, expect, it } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { radanOptionalLabels } from './hr-form-model';
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
