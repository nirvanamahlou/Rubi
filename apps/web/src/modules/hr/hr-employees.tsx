'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { HrEmployeeDto } from '@rubi/contracts';
import { hrApi } from './hr-api';
import type { HrStore } from './hr-store';
import {
  HrButton,
  HrConfirmDelete,
  HrExportButton,
  HrPanel,
  HrPdfButton,
  HrRangeBar,
  HrTable,
} from './hr-controls';
import type { NewEmployeeFormValue } from './new-employee-dialog';
const NewEmployeeDialog = dynamic(() =>
  import('./new-employee-dialog').then((module) => module.NewEmployeeDialog),
);
import { employeeLabel, hrCompanies } from './hr-live-data';
import type { HrPreviewDataset } from './hr-preview-data';
import { normalizeHrText } from './hr-data-utils';
import ui from './hr-unified.module.css';

export function employeeDataset(
  employees: readonly HrEmployeeDto[],
  branches: readonly { id: string; name: string }[],
): HrPreviewDataset {
  return {
    columns: [
      'کد پرسنلی',
      'نام و نام خانوادگی',
      'نوع همکاری',
      'شرکت و واحد',
      'سمت',
      'رده',
      'مدیر مستقیم',
      'تاریخ شروع',
      'وضعیت',
    ],
    rows: employees.map((item) => [
      item.personnelCode,
      item.name,
      item.kind,
      `${item.companyName || branches.find((branch) => branch.id === item.branchId)?.name || ''} / ${item.unit}`,
      item.position,
      item.grade,
      item.manager,
      item.startedAtValue,
      item.status,
    ]),
    recordIds: employees.map((item) => item.id),
    versions: employees.map((item) => item.version),
    totalLabel: `${employees.length.toLocaleString('fa-IR')} کارمند`,
  };
}
export function employeeFormValue(
  employee: HrEmployeeDto,
  store: HrStore,
): NewEmployeeFormValue {
  const [firstName, ...last] = employee.name.split(' ');
  return {
    firstName: firstName ?? '',
    lastName: last.join(' '),
    personnelCode: employee.personnelCode,
    employmentType: employee.kind,
    branch:
      employee.companyName ||
      store.data!.branches.find((item) => item.id === employee.branchId)
        ?.name ||
      '',
    unit: employee.unit,
    position: employee.position,
    grade: employee.grade,
    manager: employee.managerId
      ? employeeLabel(
          store.data!.employees.find(
            (item) => item.id === employee.managerId,
          ) ?? { name: employee.manager, personnelCode: '' },
        )
      : 'بدون مدیر مستقیم',
    startedAt: employee.startedAtValue,
    status: (['فعال', 'در حال تکمیل', 'تعلیق‌شده'].includes(employee.status)
      ? employee.status
      : 'فعال') as NewEmployeeFormValue['status'],
  };
}
export function HrEmployeeEditor({
  employee,
  store,
  onClose,
}: {
  employee?: HrEmployeeDto | undefined;
  store: HrStore;
  onClose: () => void;
}) {
  const key = useRef(crypto.randomUUID());
  const companies = hrCompanies(store.data!);
  return (
    <NewEmployeeDialog
      lockAssignment={Boolean(employee)}
      existingPersonnelCodes={store
        .data!.employees.filter((item) => item.id !== employee?.id)
        .map((item) => item.personnelCode)}
      initialValue={employee ? employeeFormValue(employee, store) : undefined}
      branchOptions={
        employee?.organizationBranchId
          ? [employee.companyName]
          : companies.map((company) => company.name)
      }
      unitOptions={Array.from(
        new Set(
          store
            .data!.records.filter(
              (item) => item.section === 'organization' && item.tab === 'units',
            )
            .map((item) => item.values[0]!)
            .concat(store.data!.employees.map((item) => item.unit)),
        ),
      )}
      managerOptions={store
        .data!.employees.filter((item) => item.id !== employee?.id)
        .map(employeeLabel)}
      onClose={onClose}
      onSubmit={async (value) => {
        const branch = companies.find((item) => item.name === value.branch);
        if (!branch) throw new Error('شرکت یا شعبه مجاز را انتخاب کنید.');
        const manager = store.data!.employees.find(
          (item) => employeeLabel(item) === value.manager,
        );
        if (value.manager !== 'بدون مدیر مستقیم' && !manager)
          throw new Error('مدیر مستقیم را از فهرست کارکنان انتخاب کنید.');
        const input = {
          branchId: branch.branchId,
          ...(branch.organizationBranchId
            ? { organizationBranchId: branch.organizationBranchId }
            : {}),
          name: `${value.firstName} ${value.lastName}`.trim(),
          kind: value.employmentType,
          unit: value.unit,
          position: value.position,
          grade: value.grade,
          managerId: manager?.id ?? null,
          startedAtValue: value.startedAt,
          status: value.status,
        };
        if (employee)
          await hrApi.employees.update(employee.id, {
            name: input.name,
            kind: input.kind,
            status: input.status,
            version: employee.version,
          });
        else await hrApi.employees.create(input, key.current);
        await store.mutated();
        onClose();
      }}
    />
  );
}
export function HrEmployees({
  store,
  onProfile,
}: {
  store: HrStore;
  onProfile: (employee: HrEmployeeDto) => void;
}) {
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [editing, setEditing] = useState<HrEmployeeDto | null | undefined>(
    undefined,
  );
  const [removing, setRemoving] = useState<HrEmployeeDto | null>(null);
  const filtered = useMemo(
    () =>
      store.data!.employees.filter(
        (item) =>
          (!branch ||
            (item.organizationBranchId || item.branchId) === branch) &&
          (!unit || item.unit === unit) &&
          (!status || item.status === status) &&
          (!query ||
            normalizeHrText(
              `${item.name} ${item.personnelCode} ${item.position}`,
            ).includes(normalizeHrText(query))) &&
          (!range.from || item.startedAtValue >= range.from) &&
          (!range.to || item.startedAtValue <= range.to),
      ),
    [store.data, branch, unit, status, query, range],
  );
  const dataset = employeeDataset(filtered, store.data!.branches);
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <div>
          <h1>کارکنان</h1>
          <p>پرونده شخصی، جایگاه سازمانی و وضعیت همکاری کارکنان</p>
        </div>
        <Link href="/hr?section=lifecycle&tab=onboarding">
          ثبت ورود نیروی جدید
        </Link>
      </header>
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton data={dataset} name="hr-employees" />
            <HrPdfButton data={dataset} title="کارکنان" />
            {store.data!.capabilities.write ? (
              <HrButton primary onClick={() => setEditing(null)}>
                کارمند جدید
              </HrButton>
            ) : null}
          </>
        }
      />
      <HrPanel title="فهرست کارکنان">
        <div className={ui.filters}>
          <label>
            جست‌وجو
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="نام، کد پرسنلی یا سمت"
            />
          </label>
          <label>
            وضعیت
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              {Array.from(
                new Set(store.data!.employees.map((item) => item.status)),
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            شرکت / شعبه
            <select
              value={branch}
              onChange={(event) => {
                setBranch(event.target.value);
                setUnit('');
              }}
            >
              <option value="">همه شرکت‌های مجاز</option>
              {hrCompanies(store.data!).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            واحد
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="">همه واحدها</option>
              {Array.from(
                new Set(
                  store
                    .data!.employees.filter(
                      (item) =>
                        !branch ||
                        (item.organizationBranchId || item.branchId) === branch,
                    )
                    .map((item) => item.unit),
                ),
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <HrButton
            onClick={() => {
              setQuery('');
              setBranch('');
              setUnit('');
              setStatus('');
            }}
          >
            پاک‌کردن فیلتر
          </HrButton>
        </div>
        <HrTable
          data={dataset}
          onOpen={(index) => onProfile(filtered[index]!)}
          {...(store.data!.capabilities.write
            ? {
                onEdit: (index: number) => setEditing(filtered[index]!),
                onDelete: (index: number) => setRemoving(filtered[index]!),
              }
            : {})}
        />
      </HrPanel>
      {editing !== undefined ? (
        <HrEmployeeEditor
          employee={editing ?? undefined}
          store={store}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {removing ? (
        <HrConfirmDelete
          title={removing.name}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await hrApi.employees.remove(removing.id, removing.version);
            await store.mutated();
          }}
        />
      ) : null}
    </div>
  );
}
