import {
  getHrResource,
  hrBranchName,
  hrBranchKey,
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
  const options = [
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
  const headquarters =
    data.branches.find((b) => hrBranchName(b.name) === 'دفتر مرکزی') ??
    data.branches[0];
  const grouped = new Map<
    string,
    (typeof options)[number] & {
      aliases: string[];
      branchIds: string[];
      isHeadquarters: boolean;
    }
  >();
  for (const item of options) {
    const key = hrBranchKey(item.name);
    const existing = grouped.get(key);
    if (existing) {
      existing.aliases.push(item.id);
      existing.branchIds.push(item.branchId);
    } else
      grouped.set(key, {
        ...item,
        name: hrBranchName(item.name),
        aliases: [item.id],
        branchIds: [item.branchId],
        isHeadquarters: key === 'دفتر مرکزی',
      });
  }
  if (headquarters && !grouped.has('دفتر مرکزی'))
    grouped.set('دفتر مرکزی', {
      id: 'hr-headquarters',
      branchId: headquarters.id,
      name: 'دفتر مرکزی',
      organizationBranchId: '',
      aliases: ['hr-headquarters'],
      branchIds: [headquarters.id],
      isHeadquarters: true,
    });
  return [...grouped.values()];
}
