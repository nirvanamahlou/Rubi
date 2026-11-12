'use client';
import { useMemo, useRef, useState } from 'react';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { HrCompanyCreate } from './hr-company-create';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { OrganizationChart, type OrganizationNode } from './organization-chart';
import { HrButton, HrConfirmDelete, HrPanel, HrTabs } from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';
import { HrJobTitles } from './hr-job-titles';
import { HrUnifiedSection } from './hr-unified-section';
import { sourceForRecord } from './hr-record-source';
import type { HrSource } from './hr-navigation';
import ui from './hr-unified.module.css';
import styles from './hr-forms.module.css';
import { useHrReferenceData } from './hr-reference-data';
import { normalizeHrText } from './hr-data-utils';
import { HrLoading } from './hr-controls';

const headquarters = 'دفتر مرکزی';
const ignoreReadOnlyChartAction = () => {};

export function buildHeadquartersChart(
  employees: readonly HrEmployeeDto[],
): OrganizationNode[] {
  const normalize = (value: string) =>
    normalizeHrText(value).replace(/[\s‌]+/g, '');
  const active = employees.filter((employee) => employee.status === 'فعال');
  const findEmployee = (name: string) => {
    const matches = active.filter((employee) =>
      normalize(employee.name).startsWith(normalize(name)),
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const ceo = findEmployee('دانیال الطافی');
  const salesLead = findEmployee('مهسا اعلایی');
  const node = (
    id: string,
    name: string,
    kind: OrganizationNode['kind'],
    parentId: string | null,
    manager = '',
  ): OrganizationNode => ({
    id,
    name,
    kind,
    parentId,
    manager,
    branch: headquarters,
    positionCapacity: 0,
    effectiveFrom: '',
    status: 'فعال',
    mutable: false,
  });
  const employeeNode = (
    employee: HrEmployeeDto,
    parentId: string,
    position = employee.position,
  ) => node(employee.id, employee.name, 'EMPLOYEE', parentId, position);
  const nodes = [
    node('headquarters', headquarters, 'MANAGEMENT', null),
    node('headquarters-management', 'مدیریت', 'UNIT', 'headquarters'),
  ];
  if (ceo) nodes.push(employeeNode(ceo, 'headquarters-management', 'مدیرعامل'));

  const branches = [
    {
      unit: 'حسابداری',
      chain: [
        ['سحر سامانیان', 'مدیر مالی'],
        ['عسل شهبازی', 'حسابدار ارشد'],
        ['مهشید قربانی', 'صندوقدار'],
      ],
    },
    {
      unit: 'هوش مصنوعی',
      peers: [
        ['نیروانا محلو', 'کارشناس هوش مصنوعی'],
        ['احسان دارستانی', 'کارشناس هوش مصنوعی'],
        ['رامتین قشقایی', 'کارشناس هوش مصنوعی'],
        ['محمد امین ربیعی', 'کارشناس هوش مصنوعی'],
      ],
    },
    {
      unit: 'رزرواسیون',
      chain: [
        ['رویا بهزادنیا', 'مدیر رزرواسیون'],
        ['الناز برزگر محمدی', 'رزرواسیون هتل'],
      ],
    },
    {
      unit: 'منابع انسانی',
      chain: [
        ['نیما نادری', 'مدیر منابع انسانی'],
        ['هدایت اسماعیلی', 'نیروی خدماتی'],
      ],
    },
    {
      unit: 'مهاجرت',
      peers: [
        ['دانیال آشوری', 'کارشناس مهاجرت'],
        ['پویا شفقتیان', 'کارشناس مهاجرت و تولید محتوا'],
      ],
    },
    { unit: 'فروش', chain: [['مهسا اعلایی', 'مدیر فروش']] },
  ] as const;
  const assigned = new Set<string>(ceo ? [ceo.id] : []);
  for (const branch of branches) {
    const unitId = `headquarters-${branch.unit}`;
    nodes.push(
      node(unitId, branch.unit, 'UNIT', ceo?.id ?? 'headquarters-management'),
    );
    let parentId = unitId;
    const people = 'chain' in branch ? branch.chain : branch.peers;
    for (const [name, role] of people) {
      const employee = branch.unit === 'فروش' ? salesLead : findEmployee(name);
      if (!employee || assigned.has(employee.id)) continue;
      nodes.push(employeeNode(employee, parentId, role));
      assigned.add(employee.id);
      if ('chain' in branch) parentId = employee.id;
    }
  }
  for (const employee of active) {
    if (
      assigned.has(employee.id) ||
      normalize(employee.unit) !== normalize('فروش')
    )
      continue;
    nodes.push(employeeNode(employee, salesLead?.id ?? 'headquarters-فروش'));
  }
  return nodes;
}

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
    companyScope?: 'ALL' | 'COMPANY';
    companyId?: string | null;
    personnelCode?: string;
  }[],
): OrganizationNode[] {
  const allUnits = records.filter(
    (item) =>
      item.section === 'organization' &&
      item.tab === 'units' &&
      !item.deletedAt,
  );
  const sharedRoot = 'hr-headquarters';
  const hasSharedScope =
    allUnits.some((r) => r.data.allBranches) ||
    employees.some((e) => e.companyScope === 'ALL');
  const canonicalUnits = new Map<string, HrRecordDto>();
  for (const unit of allUnits) {
    const key = unit.data.allBranches
      ? (unit.sharedSourceId ?? unit.id)
      : unit.id;
    if (!canonicalUnits.has(key) || unit.id === key)
      canonicalUnits.set(key, unit);
  }
  const units = [...canonicalUnits.values()];
  const unitIds = new Map(
    allUnits.map((unit) => [
      unit.id,
      canonicalUnits.get(
        unit.data.allBranches ? (unit.sharedSourceId ?? unit.id) : unit.id,
      )!.id,
    ]),
  );
  const companies = records.filter(
    (item) =>
      item.section === 'organization' &&
      item.tab === 'branches' &&
      !item.deletedAt,
  );
  const roots = [
    ...(hasSharedScope
      ? [
          {
            id: sharedRoot,
            name: 'همه شرکت‌ها',
            scope: sharedRoot,
            parentId: null as string | null,
          },
        ]
      : []),
    ...branches.map((item) => ({
      ...item,
      scope: item.id,
      parentId: hasSharedScope ? sharedRoot : (null as string | null),
    })),
    ...companies.map((item) => ({
      id: item.id,
      name: item.values[0] ?? item.code,
      scope: item.branchId,
      parentId: item.branchId,
    })),
  ];
  const nodes: OrganizationNode[] = roots.map((branch) => ({
    id: branch.id,
    name: branch.name,
    kind: 'MANAGEMENT',
    branch: branch.name,
    parentId: branch.parentId,
    manager: '',
    positionCapacity: employees.filter(
      (item) => (item.organizationBranchId || item.branchId) === branch.id,
    ).length,
    effectiveFrom: '',
    status:
      records.find((r) => r.id === branch.id)?.status === 'غیرفعال'
        ? 'غیرفعال'
        : 'فعال',
    offsetX: records.find((r) => r.id === branch.id)?.data.chartX ?? 0,
    offsetY: records.find((r) => r.id === branch.id)?.data.chartY ?? 0,
    mutable: records.some((r) => r.id === branch.id),
    catalogSource: 'branch',
  }));
  for (const record of units) {
    const read = (label: string) =>
      record.values[record.columns.indexOf(label)] ?? '';
    const root =
      (record.data.allBranches
        ? roots.find((item) => item.id === sharedRoot)
        : undefined) ??
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
      parentId:
        (record.parentId ? unitIds.get(record.parentId) : undefined) ??
        root?.id ??
        null,
      manager: read('مدیر'),
      positionCapacity: employees.filter(
        (employee) =>
          (record.data.allBranches || employee.branchId === record.branchId) &&
          (!employee.organizationBranchId ||
            employee.organizationBranchId === root?.id) &&
          employee.unit === read('نام واحد'),
      ).length,
      effectiveFrom: read('تاریخ اثر'),
      status: record.status === 'غیرفعال' ? 'غیرفعال' : 'فعال',
      catalogSource: 'unit',
      offsetX: record.data.chartX ?? 0,
      offsetY: record.data.chartY ?? 0,
    });
  }
  for (const record of records.filter(
    (r) =>
      r.section === 'organization' &&
      r.tab === 'chartEmployees' &&
      !r.deletedAt,
  )) {
    const employee = employees.find((e) => e.id === record.employeeId);
    if (
      !employee ||
      employee.branchId !== record.branchId ||
      (employee.organizationBranchId &&
        record.data.organizationBranchId &&
        employee.organizationBranchId !== record.data.organizationBranchId)
    )
      continue;
    const root =
      (employee.companyScope === 'ALL'
        ? roots.find((r) => r.id === sharedRoot)
        : roots.find((r) => r.id === employee.companyId)) ??
      roots.find(
        (r) =>
          r.id === record.data.organizationBranchId ||
          r.id === employee.organizationBranchId,
      ) ??
      roots.find((r) => r.scope === employee.branchId);
    nodes.push({
      id: record.id,
      name: record.values[1] || employee.name,
      kind: 'EMPLOYEE',
      branch: root?.name ?? '',
      parentId:
        (record.parentId ? unitIds.get(record.parentId) : undefined) ??
        root?.id ??
        null,
      manager: [employee.position, employee.personnelCode]
        .filter(Boolean)
        .join(' · '),
      positionCapacity: 0,
      effectiveFrom: '',
      status: record.status === 'غیرفعال' ? 'غیرفعال' : 'فعال',
      catalogSource: 'employee',
      offsetX: record.data.chartX ?? 0,
      offsetY: record.data.chartY ?? 0,
    });
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  return nodes.map((node) =>
    node.parentId && !nodeIds.has(node.parentId)
      ? {
          ...node,
          parentId: roots.find((root) => root.name === node.branch)?.id ?? null,
        }
      : node,
  );
}
export function manuallyPlacedOrganizationNodes(
  nodes: readonly OrganizationNode[],
  records: readonly HrRecordDto[],
): OrganizationNode[] {
  const visibleIds = new Set(
    records
      .filter((record) => record.data.chartVisible === true)
      .map((record) => record.id),
  );
  return nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => ({
      ...node,
      parentId:
        node.parentId && visibleIds.has(node.parentId) ? node.parentId : null,
    }));
}
export function chartNodeFormTarget(
  kind: 'UNIT' | 'EMPLOYEE',
  node: OrganizationNode | undefined,
  records: readonly HrRecordDto[],
  nodes: readonly OrganizationNode[],
): HrFormTarget {
  const record = node ? records.find((r) => r.id === node.id) : undefined;
  const companyId =
    record?.tab === 'branches'
      ? record.id
      : record?.data.organizationBranchId ||
        (node
          ? nodes.find(
              (n) => n.kind === 'MANAGEMENT' && n.branch === node.branch,
            )?.id
          : undefined);
  const source: HrSource =
    kind === 'UNIT'
      ? {
          section: 'organization',
          tab: 'units',
          label: 'دپارتمان',
          action: 'افزودن دپارتمان',
        }
      : {
          section: 'organization',
          tab: 'chartEmployees',
          label: 'کارکن چارت',
          action: 'افزودن کارکن به چارت',
        };
  return {
    source,
    chartPlacement: true,
    ...(record && node?.kind !== 'MANAGEMENT' ? { parent: record } : {}),
    ...(companyId ? { preferredCompanyId: companyId } : {}),
  };
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
  const { context } = useLegalEntityContext();
  const [group, setGroup] = useState(
    initialTab === 'positions' ? 'jobs' : 'structure',
  );
  const [view, setView] = useState(initialTab ?? 'headquarters');
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const references = useHrReferenceData(store);
  const data = references.data;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveLock = useRef(false);
  const catalogNodes = useMemo(
    () =>
      buildLiveOrganizationNodes(data.records, data.branches, data.employees),
    [data],
  );
  const nodes = useMemo(
    () => manuallyPlacedOrganizationNodes(catalogNodes, data.records),
    [catalogNodes, data.records],
  );
  const addNode = (kind: 'UNIT' | 'EMPLOYEE', node?: OrganizationNode) =>
    onForm(chartNodeFormTarget(kind, node, data.records, catalogNodes));
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <div>
          <h1>ساختار سازمانی</h1>
          <p>ساختار شرکت‌ها، ارتباط واحدها و جایگاه‌های شغلی</p>
        </div>
      </header>
      <HrCompanyCreate store={store} />
      <HrTabs
        label="گروه‌های ساختار سازمانی"
        items={[
          { id: 'structure', label: 'چارت، شرکت‌ها و واحدها' },
          { id: 'jobs', label: 'عنوان‌های شغلی' },
        ]}
        value={group}
        onChange={(id) => {
          setGroup(id);
          setView(id === 'structure' ? 'headquarters' : 'positions');
        }}
      />
      <HrTabs
        label="نمای ساختار سازمانی"
        items={
          group === 'structure'
            ? [
                { id: 'headquarters', label: 'چارت دفتر مرکزی' },
                { id: 'orgchart', label: 'چارت دستی' },
                {
                  id: 'branches',
                  label: context?.selection === 'ALL' ? 'شرکت‌ها' : 'شعبه‌ها',
                },
                { id: 'units', label: 'واحدها' },
                { id: 'groups', label: 'گروه‌های کارکنان' },
                { id: 'groupMembers', label: 'اعضای گروه' },
              ]
            : [{ id: 'positions', label: 'عنوان‌های شغلی' }]
        }
        value={view}
        onChange={setView}
      />
      {view === 'headquarters' ? (
        <HrPanel title="چارت سازمانی دفتر مرکزی">
          {references.loading ? (
            <HrLoading label="در حال دریافت چارت…" />
          ) : references.error ? (
            <p role="alert" className={ui.error}>
              {references.error}
            </p>
          ) : (
            <div className={`${styles.orgViewport} ${styles.radanChart}`}>
              <OrganizationChart
                nodes={buildHeadquartersChart(data.employees)}
                editable={false}
                onEdit={ignoreReadOnlyChartAction}
                onDelete={ignoreReadOnlyChartAction}
              />
            </div>
          )}
        </HrPanel>
      ) : view === 'orgchart' ? (
        <HrPanel
          title="چارت سازمانی"
          actions={
            store.data!.capabilities.write ? (
              <div className={ui.actions}>
                <HrButton
                  primary
                  disabled={
                    references.loading || Boolean(references.error) || saving
                  }
                  onClick={() => addNode('UNIT')}
                >
                  افزودن دپارتمان
                </HrButton>
                <HrButton
                  disabled={
                    references.loading || Boolean(references.error) || saving
                  }
                  onClick={() => addNode('EMPLOYEE')}
                >
                  افزودن کارکن به چارت
                </HrButton>
              </div>
            ) : null
          }
        >
          {error || references.error ? (
            <p role="alert" className={ui.error}>
              {error || references.error}
            </p>
          ) : null}
          {references.loading ? (
            <HrLoading label="در حال دریافت چارت…" />
          ) : references.error ? null : (
            <div className={styles.orgViewport}>
              <OrganizationChart
                nodes={nodes}
                editable={store.data!.capabilities.write}
                confirmDelete={false}
                busy={saving}
                onAddDepartment={(node) => addNode('UNIT', node)}
                onAddEmployee={(node) => addNode('EMPLOYEE', node)}
                onPositionChange={async (node, position) => {
                  if (saveLock.current)
                    throw new Error('ذخیره در حال انجام است.');
                  const record = data.records.find((r) => r.id === node.id);
                  if (!record || !data.capabilities.write) return;
                  saveLock.current = true;
                  setSaving(true);
                  setError('');
                  try {
                    await store.update(record, {
                      data: { chartX: position.x, chartY: position.y },
                    });
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : 'ذخیره جایگاه گره انجام نشد.',
                    );
                    await store.refresh().catch(() => undefined);
                    throw e;
                  } finally {
                    saveLock.current = false;
                    setSaving(false);
                  }
                }}
                onEdit={(node) => {
                  const record = data.records.find(
                    (item) => item.id === node.id,
                  );
                  if (record && store.data!.capabilities.write)
                    onForm({
                      source: sourceForRecord(record),
                      record,
                    });
                }}
                onDelete={(node) => {
                  const record = data.records.find(
                    (item) => item.id === node.id,
                  );
                  if (record && store.data!.capabilities.write)
                    setRemoving(record);
                }}
              />
            </div>
          )}
        </HrPanel>
      ) : view === 'positions' ? (
        <HrJobTitles store={store} onForm={onForm} />
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
          chartOnly
          onConfirm={async () => {
            await store.update(removing, { data: { chartVisible: false } });
          }}
        />
      ) : null}
    </div>
  );
}
