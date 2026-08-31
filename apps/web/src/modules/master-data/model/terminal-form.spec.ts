import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import { masterDataListQuerySchema } from '../api/contracts';
import {
  terminalFormStatus,
  terminalFormValues,
  terminalHoursLabel,
  terminalMutationValues,
  terminalStatusLabel,
  terminalUpdatedLabel,
  validateTerminalForm,
} from './terminal-form';
const base = {
  ...terminalFormValues(),
  name: 'ترمینال آزمون',
  airportId: '22222222-2222-4222-8222-222222222222',
  terminalType: 'MIXED',
};
const record: MasterDataRecord = {
  id: 'terminal-test',
  resource: 'terminals',
  code: 'TERMINAL_TEST',
  name: base.name,
  status: 'inactive',
  version: 2,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T01:00:00Z',
  attributes: {
    ...base,
    gateCount: 0,
    isUnderMaintenance: true,
    updatedByUserId: 'test-user',
  },
};
describe('terminal form model', () => {
  it('accepts MIXED in the public list/filter contract without extending shared status values', () => {
    expect(
      masterDataListQuerySchema.parse({ terminalType: 'MIXED' }).terminalType,
    ).toBe('MIXED');
    expect(
      masterDataListQuerySchema.safeParse({ status: 'maintenance' }).success,
    ).toBe(false);
  });
  it('does not invent gate counts or operating hours on legacy records', () => {
    expect(terminalFormValues().gateCount).toBe('');
    expect(terminalFormValues().operatingHoursMode).toBe('');
    expect(terminalHoursLabel(record)).toBe('تعیین نشده');
    expect(terminalFormValues(record).gateCount).toBe('0');
  });
  it('keeps maintenance distinguishable from ordinary inactivity', () => {
    expect(terminalFormStatus(record)).toBe('maintenance');
    expect(terminalStatusLabel(record)).toBe('تعمیرات');
    expect(terminalStatusLabel({ ...record, attributes: {} })).toBe('غیرفعال');
  });
  it('normalizes Persian gate counts and local clocks including 24:00', () => {
    const result = validateTerminalForm({
      ...base,
      gateCount: '۲۸',
      operatingHoursMode: 'TIME_RANGE',
      opensAt: '۰۵:۰۰',
      closesAt: '۲۴:۰۰',
    });
    expect(result.success).toBe(true);
    expect(result.values).toMatchObject({
      gateCount: '28',
      opensAt: '05:00',
      closesAt: '24:00',
    });
  });
  it.each([
    { name: '' },
    { englishName: 'x'.repeat(161) },
    { airportId: '' },
    { airportId: 'fake' },
    { terminalType: '' },
    { terminalType: 'INVALID' },
    { gateCount: '-1' },
    { gateCount: '1.5' },
    { gateCount: '1e2' },
    { gateCount: '2147483648' },
    { status: '' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '24:00', closesAt: '06:00' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '05:00', closesAt: '24:01' },
    { operatingHoursMode: 'TIME_RANGE', opensAt: '06:00', closesAt: '06:00' },
    { operatingHoursMode: 'ALL_DAY', opensAt: '06:00' },
    { closesAt: '24:00' },
  ])('rejects invalid or cleared required fields %j', (values) =>
    expect(validateTerminalForm({ ...base, ...values }).success).toBe(false),
  );
  it('accepts overnight ranges and all-day mode', () => {
    expect(
      validateTerminalForm({
        ...base,
        operatingHoursMode: 'TIME_RANGE',
        opensAt: '22:00',
        closesAt: '06:00',
      }).success,
    ).toBe(true);
    expect(
      validateTerminalForm({ ...base, operatingHoursMode: 'ALL_DAY' }).success,
    ).toBe(true);
    expect(
      terminalHoursLabel({
        ...record,
        attributes: { operatingHoursMode: 'ALL_DAY' },
      }),
    ).toBe('۲۴ ساعته');
    expect(
      terminalHoursLabel({
        ...record,
        attributes: {
          operatingHoursMode: 'TIME_RANGE',
          opensAt: '22:00',
          closesAt: '06:00',
        },
      }),
    ).toBe('22:00 تا 06:00');
  });
  it('omits server-owned metadata and unchanged status; sends changed status with form', () => {
    const values = {
      ...base,
      code: 'FORGED',
      cityId: 'FORGED',
      updatedAt: 'FORGED',
      updatedByUserId: 'FORGED',
    };
    const mutation = terminalMutationValues(values);
    for (const key of [
      'code',
      'cityId',
      'updatedAt',
      'updatedByUserId',
      'status',
    ])
      expect(mutation).not.toHaveProperty(key);
    expect(
      terminalMutationValues(terminalFormValues(record), record),
    ).not.toHaveProperty('status');
    expect(
      terminalMutationValues({ ...base, status: 'maintenance' }).status,
    ).toBe('maintenance');
  });
  it('uses actual actor names or honest unavailable fallback', () => {
    expect(
      terminalUpdatedLabel(record, { 'test-user': 'کاربر آزمون' }),
    ).toContain('کاربر آزمون');
    expect(terminalUpdatedLabel(record)).toContain('test-user');
    expect(terminalUpdatedLabel()).toBe('پس از ثبت، خودکار درج می‌شود');
  });
});
