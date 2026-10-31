import { describe, expect, it } from 'vitest';
import { getHrResource, type AuthenticatedActor } from '@nora/contracts';
import { workflowData, recordValues } from './hr.validation';
import { HrService } from './hr.service';

describe('organization chart command contracts', () => {
  it('accepts finite signed offsets and rejects malformed or unbounded coordinates', () => {
    for (const value of [-5000, -25.5, 0, 5000])
      expect(workflowData({ chartX: value, chartY: value })).toEqual({
        chartX: value,
        chartY: value,
      });
    for (const value of ['1', null, NaN, Infinity, -5001, 5001])
      expect(() => workflowData({ chartX: value })).toThrow();
  });
  it('requires a real employee and limits chart parents to department/employee nodes', () => {
    const definition = getHrResource('organization', 'chartEmployees')!;
    expect(definition.employeeRequired).toBe(true);
    expect(definition.parentOptional).toBe(true);
    expect(definition.parentResources).toEqual([
      'organization.units',
      'organization.chartEmployees',
    ]);
    expect(recordValues(['همکار', 'عنوان اختیاری'], definition)).toHaveLength(
      2,
    );
    expect(() => recordValues(['', 'عنوان'], definition)).toThrow();
    expect(getHrResource('organization', 'units')?.parentResources).toEqual([
      'organization.units',
    ]);
  });
  it('rejects chart metadata on unrelated resources before touching persistence', async () => {
    const service = new HrService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const actor = {
      userId: 'u',
      branchIds: ['b'],
      permissions: ['hr.read', 'hr.manage'],
    } as unknown as AuthenticatedActor;
    await expect(
      service.createRecord(
        {
          section: 'organization',
          tab: 'groups',
          values: ['گروه', ''],
          data: { chartX: 20 },
        },
        'command-key',
        actor,
      ),
    ).rejects.toThrow('مختصات فقط');
  });
});
