import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { employeeEmploymentDates } from './employee-employment-dates';
import { employeeDataset, HrEmployees } from './hr-employees';
import type { HrStore } from './hr-store';

vi.mock('./hr-reference-data', () => ({
  useHrReferenceData: (store: HrStore) => ({
    data: store.data,
    loading: false,
  }),
}));

const record = (
  id: string,
  section: string,
  tab: string,
  values: string[],
  employeeId = 'employee-a',
): HrRecordDto =>
  ({
    id,
    section,
    tab,
    values,
    employeeId,
    createdAt: '2026-11-02T10:00:00Z',
    status: 'پیش‌نویس',
    deletedAt: null,
  }) as HrRecordDto;
const contract = (
  id: string,
  start: string,
  end: string,
  employeeId?: string,
) =>
  record(id, 'contracts', 'active', ['', id, '', '', start, end], employeeId);
const employee = {
  id: 'employee-a',
  personnelCode: '001',
  name: 'Synthetic employee',
  startedAtValue: '2026-01-01',
  status: 'پایان همکاری',
  version: 1,
} as HrEmployeeDto;

it('selects the latest contract independently of expiry and uses last working day rather than exit interview', () => {
  const records = [
    contract('old', '2026-01-01', '2027-01-01'),
    contract('new', '2026-10-01', '2026-12-31'),
    contract('other', '2026-11-01', '2028-01-01', 'employee-b'),
    record('separation', 'lifecycle', 'separation', ['', '', '2026-12-15']),
    record('interview', 'lifecycle', 'exit', ['', '2026-12-20']),
  ];
  expect(employeeEmploymentDates(records).get(employee.id)).toEqual({
    contractEnd: '2026-12-31',
    employmentEnd: '2026-12-15',
  });
  const data = employeeDataset([employee], [], records);
  expect(data.columns.slice(-4)).toEqual([
    'تاریخ شروع به کار',
    'تاریخ پایان قرارداد',
    'تاریخ پایان همکاری',
    'وضعیت',
  ]);
  expect(data.rows[0]!.slice(-3, -1).every((x) => x !== '—')).toBe(true);
  expect(data.recordIds).toEqual([employee.id]);
});

it('does not revive an old expiry for an open-ended latest contract or cancelled/deleted cases', () => {
  const cancelled = contract('cancelled', '2026-12-01', '2029-01-01');
  cancelled.status = 'لغوشده';
  const deleted = record('deleted', 'lifecycle', 'separation', [
    '',
    '',
    '2026-12-15',
  ]);
  deleted.deletedAt = '2026-11-02';
  expect(
    employeeEmploymentDates([
      contract('old', '2026-01-01', '2027-01-01'),
      contract('current', '2026-10-01', ''),
      cancelled,
      deleted,
    ]).get(employee.id),
  ).toEqual({ contractEnd: '' });
  const data = employeeDataset([employee], []);
  expect(data.rows[0]!.slice(-3, -1)).toEqual(['—', '—']);
});

it('retains former employees in the dataset while the list defaults to current employees', () => {
  const store = {
    revision: 0,
    data: {
      employees: [employee],
      branches: [],
      records: [],
      capabilities: { write: false },
    },
  } as unknown as HrStore;
  expect(
    renderToStaticMarkup(<HrEmployees store={store} onProfile={() => {}} />),
  ).not.toContain('Synthetic employee');
  expect(employeeDataset([employee], []).recordIds).toEqual([employee.id]);
});
