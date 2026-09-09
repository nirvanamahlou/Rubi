import {
  getHrResource,
  type HrRecordDto,
  type HrBootstrapDto,
} from '@rubi/contracts';
import type { HrPreviewDataset } from './hr-preview-data';
import { retiredHrColumns } from './hr-form-model';

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
    columns: ['شناسه', ...visible.map((item) => item.label), 'وضعیت'],
    rows: items.map((record) => [
      record.code,
      ...visible.map((item) => record.values[item.index] ?? ''),
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
  return catalog.length
    ? catalog.map((item) => ({
        id: item.id,
        branchId: item.branchId,
        name: item.values[0] ?? item.code,
        organizationBranchId: item.id,
      }))
    : data.branches.map((item) => ({
        ...item,
        branchId: item.id,
        organizationBranchId: '',
      }));
}
