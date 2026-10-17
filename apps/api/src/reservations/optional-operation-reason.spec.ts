import { expect, it } from 'vitest';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow,
} from './travel-workflow';
import { validReason } from '../system-management/system-management.validation';
it('accepts an empty operation reason without bypassing version checks or accepting empty note content', () => {
  const initial = initialTravelWorkflow();
  const command = {
    action: 'TABLE_STATUS',
    expectedVersion: 0,
    note: '',
    tableFlag: 'visaRequested',
    checked: true,
  } as const;
  expect(transitionTravelWorkflow(initial, command, [])).toMatchObject({
    version: 1,
    note: '',
    tableFlags: { visaRequested: { checked: true } },
  });
  expect(() =>
    transitionTravelWorkflow(initial, { ...command, expectedVersion: 3 }, []),
  ).toThrow();
  expect(() =>
    transitionTravelWorkflow(
      initial,
      { action: 'NOTE', expectedVersion: 0, note: '' },
      [],
    ),
  ).toThrow();
  for (const reason of ['', undefined, null, 'x'])
    expect(validReason(reason)).toBe(reason === 'x' ? 'x' : '');
  expect(() => validReason({})).toThrow();
  expect(() => validReason('x'.repeat(1001))).toThrow();
});
