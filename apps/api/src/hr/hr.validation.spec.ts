import { describe, expect, it } from 'vitest';
import { HR_RESOURCE_KEYS, getHrResource } from '@rubi/contracts';

import {
  attendanceMinutes,
  isoDate,
  localClockParts,
  localClockToUtc,
  object,
  recordValues,
  resource,
  status,
  workflowData,
} from './hr.validation';

describe('HR resource and time validation', () => {
  it('accepts only registered, bounded field arrays', () => {
    for (const key of HR_RESOURCE_KEYS) {
      const [section, tab] = key.split('.');
      const schema = getHrResource(section!, tab!)!;
      expect(schema.fields).toHaveLength(schema.columns.length);
      expect(schema.fields.length).toBeLessThanOrEqual(24);
    }
    expect(() => resource('other', 'table')).toThrow();
    expect(() => recordValues(['wrong'], resource('time', 'leave'))).toThrow();
    expect(() => object({ values: [], rawSecret: 'x' }, ['values'])).toThrow();
  });
  it('rejects ambiguous dates, local timestamps and fake external receipts', () => {
    for (const value of ['۱۴۰۵/۰۶/۰۱', '2026-02-30', '2026-9-1'])
      expect(() => isoDate(value)).toThrow();
    expect(() =>
      workflowData({ startsAt: '2026-09-01T08:00:00+03:30' }),
    ).toThrow();
    expect(() => workflowData({ paymentId: 'fake' })).toThrow();
    expect(() => workflowData({ contractState: 'SIGNED' })).toThrow();
    expect(() => workflowData({ signedDocumentId: 'fake' })).toThrow();
    expect(() => workflowData({ organizationBranchId: null })).toThrow();
    expect(() => status('پرداخت‌شده', false)).toThrow();
    expect(isoDate('2026-09-01').toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });
  it('pairs shuffled clock events including overnight work and reports orphan events', () => {
    expect(
      attendanceMinutes([
        { at: new Date('2026-09-02T05:00:00Z'), kind: 'خروج' },
        { at: new Date('2026-09-01T21:00:00Z'), kind: 'ورود' },
      ]),
    ).toEqual({ worked: 480, exceptions: [] });
    expect(
      attendanceMinutes([
        { at: new Date('2026-09-01T08:00:00Z'), kind: 'خروج' },
        { at: new Date('2026-09-01T09:00:00Z'), kind: 'ورود' },
        { at: new Date('2026-09-01T10:00:00Z'), kind: 'ورود' },
      ]),
    ).toEqual({
      worked: 0,
      exceptions: ['خروج بدون ورود', 'ورود تکراری', 'خروج ثبت نشده'],
    });
  });
  it('stores a Tehran wall clock as UTC with a reversible date boundary', () => {
    expect(localClockToUtc('2026-09-01', '08:00').toISOString()).toBe(
      '2026-09-01T04:30:00.000Z',
    );
    expect(localClockParts(new Date('2026-09-01T21:30:00Z'))).toEqual({
      date: '2026-09-02',
      time: '01:00',
    });
  });
});
