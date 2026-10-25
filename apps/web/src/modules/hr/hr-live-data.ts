import {
  getHrResource,
  type HrRecordDto,
  type HrBootstrapDto,
} from '@nora/contracts';
import type { HrPreviewDataset } from './hr-preview-data';
import { hrFieldLabel, retiredHrColumns } from './hr-form-model';
import { hrDisplayDate } from './hr-dates';

export function recordsDataset(
  section: string,
  tab: string,
  records: readonly HrRecordDto[],
): HrPreviewDataset {
  const source = getHrResource(section, tab);
  const visible =
    source?.columns
      .map((label, index) => ({ label, index }))
      .filter((item) => !retiredHrColumns(section, tab).includes(item.label)) ??
    [];
  const items = records.filter(
    (record) =>
      record.section === section && record.tab === tab && !record.deletedAt,
  );
  return {
    columns: [
      'شناسه',
      ...visible.map((item) => hrFieldLabel(item.label)),
      'وضعیت',
    ],
    rows: items.map((record) => [
      record.code,
      ...visible.map((item) =>
        /تاریخ|موعد|آخرین روز کاری/.test(item.label)
          ? hrDisplayDate(record.values[item.index] ?? '')
          : (record.values[item.index] ?? ''),
      ),
      record.status,
    ]),
    recordIds: items.map((r) => r.id),
    versions: items.map((r) => r.version),
    employeeIds: items.map((r) => r.employeeId),
    parentIds: items.map((r) => r.parentId),
    totalLabel: `${items.length.toLocaleString('fa-IR')} رکورد`,
  };
}
export function employeeLabel(employee: {
  name: string;
  personnelCode: string;
}) {
  return `${employee.name} · ${employee.personnelCode}`;
}

export function hrCompanies(data: HrBootstrapDto) {
  const catalog = data.records.filter(
    (item) =>
      item.section === 'organization' &&
      item.tab === 'branches' &&
      !item.deletedAt &&
      item.status === 'فعال',
  );
  return [
    ...catalog.map((item) => ({
      id: item.id,
      branchId: item.branchId,
      name: item.values[0] ?? item.code,
      organizationBranchId: item.id,
    })),
    ...data.branches
      .filter(
        (branch) => !catalog.some((company) => company.branchId === branch.id),
      )
      .map((item) => ({
        ...item,
        branchId: item.id,
        organizationBranchId: '',
      })),
  ];
}
