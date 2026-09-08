'use client';
import { useMemo, useState } from 'react';
import type { HrRecordDto } from '@rubi/contracts';
import { OrganizationChart, type OrganizationNode } from './organization-chart';
import { HrButton, HrConfirmDelete, HrPanel, HrTabs } from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';
import { HrUnifiedSection, sourceForRecord } from './hr-unified-section';
import type { HrSource } from './hr-navigation';
import ui from './hr-unified.module.css';

export function buildLiveOrganizationNodes(
  records: readonly HrRecordDto[],
  branches: readonly { id: string; name: string }[],
  employees: readonly {
    id: string;
    name: string;
    unit: string;
    branchId: string;
    position: string;
    organizationBranchId?: string | null;
  }[],
): OrganizationNode[] {
  const units = records.filter(
    (item) =>
      item.section === 'organization' &&
      item.tab === 'units' &&
      !item.deletedAt,
  );
  const companies = records.filter(
    (item) =>
      item.section === 'organization' &&
      item.tab === 'branches' &&
      !item.deletedAt &&
      item.status !== 'غیرفعال',
  );
  const roots = companies.length
    ? companies.map((item) => ({
        id: item.id,
        name: item.values[0] ?? item.code,
        scope: item.branchId,
      }))
    : branches.map((item) => ({ ...item, scope: item.id }));
  const nodes: OrganizationNode[] = roots.map((branch) => ({
    id: branch.id,
    name: branch.name,
    kind: 'MANAGEMENT',
    branch: branch.name,
    parentId: null,
    manager: '',
    positionCapacity: employees.filter(
      (item) => (item.organizationBranchId || item.branchId) === branch.id,
    ).length,
    effectiveFrom: '',
    status: 'فعال',
    catalogSource: 'branch',
  }));
  for (const record of units) {
    const read = (label: string) =>
      record.values[record.columns.indexOf(label)] ?? '';
    const root =
      roots.find((item) => item.id === record.data.organizationBranchId) ??
      roots.find(
        (item) => item.scope === record.branchId && item.name === read('شعبه'),
      ) ??
      roots.find((item) => item.scope === record.branchId);
    nodes.push({
      id: record.id,
      name: read('نام واحد'),
      kind: 'UNIT',
      branch: root?.name ?? '',
      parentId: record.parentId ?? root?.id ?? null,
      manager: read('مدیر'),
      positionCapacity: employees.filter(
        (employee) =>
          employee.branchId === record.branchId &&
          (!employee.organizationBranchId ||
            employee.organizationBranchId === root?.id) &&
          employee.unit === read('نام واحد'),
      ).length,
      effectiveFrom: read('تاریخ اثر'),
      status: record.status === 'غیرفعال' ? 'غیرفعال' : 'فعال',
      catalogSource: 'unit',
    });
  }
  return nodes;
}
export function HrOrganization({
  store,
  initialTab,
  onForm,
  onSelect,
}: {
  store: HrStore;
  initialTab?: string | undefined;
  onForm: (target: HrFormTarget) => void;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const [group, setGroup] = useState(
    initialTab === 'positions' || initialTab === 'grades'
      ? 'jobs'
      : 'structure',
  );
  const [view, setView] = useState(initialTab ?? 'orgchart');
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const nodes = useMemo(
    () =>
      buildLiveOrganizationNodes(
        store.data!.records,
        store.data!.branches,
        store.data!.employees,
      ),
    [store.data],
  );
  const unitSource: HrSource = {
    section: 'organization',
    tab: 'units',
    label: 'واحد سازمانی',
    action: 'افزودن گره سازمانی',
  };
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <div>
          <h1>ساختار سازمانی</h1>
          <p>ساختار شرکت‌ها، ارتباط واحدها و جایگاه‌های شغلی</p>
        </div>
      </header>
      <HrTabs
        label="گروه‌های ساختار سازمانی"
        items={[
          { id: 'structure', label: 'چارت، شرکت‌ها و واحدها' },
          { id: 'jobs', label: 'شغل و رده' },
        ]}
        value={group}
        onChange={(id) => {
          setGroup(id);
          setView(id === 'structure' ? 'orgchart' : 'positions');
        }}
      />
      <HrTabs
        label="نمای ساختار سازمانی"
        items={
          group === 'structure'
            ? [
                { id: 'orgchart', label: 'چارت سازمانی' },
                { id: 'branches', label: 'شعبه‌ها' },
                { id: 'units', label: 'واحدها' },
              ]
            : [
                { id: 'positions', label: 'شغل و سمت' },
                { id: 'grades', label: 'رده شغلی' },
              ]
        }
        value={view}
        onChange={setView}
      />
      {view === 'orgchart' ? (
        <HrPanel
          title="چارت سازمانی"
          actions={
            store.data!.capabilities.write ? (
              <HrButton primary onClick={() => onForm({ source: unitSource })}>
                افزودن گره سازمانی
              </HrButton>
            ) : null
          }
        >
          <OrganizationChart
            nodes={nodes}
            editable={store.data!.capabilities.write}
            confirmDelete={false}
            onEdit={(node) => {
              const record = store.data!.records.find(
                (item) => item.id === node.id,
              );
              if (record && store.data!.capabilities.write)
                onForm({ source: sourceForRecord(record), record });
            }}
            onDelete={(node) => {
              const record = store.data!.records.find(
                (item) => item.id === node.id,
              );
              if (record && store.data!.capabilities.write) setRemoving(record);
            }}
          />
        </HrPanel>
      ) : (
        <HrUnifiedSection
          embedded
          key={view}
          section="organization"
          initialTab={view}
          store={store}
          onForm={onForm}
          onSelect={onSelect}
        />
      )}{' '}
      {removing ? (
        <HrConfirmDelete
          title={removing.values[0] ?? removing.code}
          onClose={() => setRemoving(null)}
          onConfirm={() => store.remove(removing)}
        />
      ) : null}
    </div>
  );
}
