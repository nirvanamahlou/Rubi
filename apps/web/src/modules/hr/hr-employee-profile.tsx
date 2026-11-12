'use client';
import {
  employeeLeaveDataset,
  isEmployeeLeave,
} from './employee-leave-dataset';
import { HrPayDocuments } from './hr-pay-documents';
import { HrAttendanceEditor } from './hr-attendance-editor';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { useRouteAccess } from '@/modules/iam/access-context';

import Image from '@/i18n/image';
import { useEffect, useRef, useState } from 'react';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import { employeeGroups, resolveHrGroup, type HrSource } from './hr-navigation';
import { employeeProfileSources } from './employee-profile-data';
import { employeeAttendanceDataset } from './employee-attendance-dataset';
import { recordsDataset } from './hr-live-data';
import type { HrStore } from './hr-store';
import type { HrFormTarget } from './hr-record-form';
import {
  HrButton,
  HrStatus,
  HrConfirmDelete,
  HrPdfButton,
  HrExportButton,
  HrPanel,
  HrRangeBar,
  HrTable,
  HrTabs,
} from './hr-controls';
import { HrAudit } from './hr-audit';
import { HrLeaveGrant } from './hr-leave-grant';
import { HrEmployeeEditor } from './hr-employees';
import { hrRequest } from './hr-api';
import { sourceForRecord } from './hr-record-source';
import ui from './hr-unified.module.css';
import { selectedHrDataset, useHrRowSelection } from './hr-row-selection';
import { needsHrDetail } from './hr-form-model';
import {
  HrEmployeeSummary,
  employeeSummaryFields,
} from './hr-employee-summary';
import { useHrEmployeeRecords } from './hr-employee-records';
import { useHrReferenceData } from './hr-reference-data';
import { useHrFormReferences } from './hr-directory-picker';

interface LeaveBalances {
  employeeId: string;
  year: number;
  monthlyDailyRemaining?: number | null;
  monthlyHourlyRemaining?: number;
  items: { type: string; granted: string; used: string; balance: string }[];
}
export function HrEmployeeProfile({
  employee,
  initialTab,
  store,
  onForm,
  onSelect,
}: {
  employee: HrEmployeeDto;
  initialTab?: string | undefined;
  store: HrStore;
  onForm: (target: HrFormTarget) => void;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const profile = useHrEmployeeRecords(employee.id, store.revision);
  const references = useHrReferenceData(store);
  const external = useHrFormReferences(employee.id);
  const userLabel = external.data?.users.find(
    (u) => u.id === employee.userId,
  )?.label;
  const requestedTab = initialTab === 'contract' ? 'active' : initialTab;
  const allowed = useRouteAccess();
  const groups = employeeGroups
    .map((item) => ({
      ...item,
      sources: item.sources.filter((entry) => {
        const mapped = employeeProfileSources[entry.tab];
        return allowed(
          `/hr?section=${mapped?.[0] ?? entry.section}&tab=${mapped?.[1] ?? entry.tab}`,
        );
      }),
    }))
    .filter((item) => item.sources.length);
  const first = resolveHrGroup(
    groups.length ? groups : employeeGroups,
    requestedTab,
  );
  const [groupId, setGroupId] = useState(first.id);
  const group = groups.find((item) => item.id === groupId) ?? first;
  const [tab, setTab] = useState(requestedTab ?? first.sources[0]!.tab);
  const source =
    group.sources.find((item) => item.tab === tab) ?? group.sources[0]!;
  const [balanceResult, setBalanceResult] = useState<{
    key: string;
    balances: LeaveBalances;
  }>();
  const [photo, setPhoto] = useState('');
  const [editing, setEditing] = useState(false);
  const [attendanceEdit, setAttendanceEdit] = useState<HrRecordDto | null>(
    null,
  );
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const photoUrl = useRef('');
  const timeline = useHrEmployeeRecords(employee.id, store.revision, range);
  const records = timeline.records ?? [];
  const balanceKey = JSON.stringify([employee.id, range.to, store.revision]);
  const balances =
    balanceResult?.key === balanceKey ? balanceResult.balances : null;
  const { remember } = store;
  useEffect(() => {
    if (timeline.records) remember(timeline.records);
  }, [timeline.records, remember]);
  useEffect(() => {
    let active = true;
    void hrRequest<LeaveBalances>(
      `/leave/balances?employeeId=${employee.id}&asOf=${range.to || new Date().toISOString().slice(0, 10)}`,
    )
      .then((result) => {
        if (active) setBalanceResult({ key: balanceKey, balances: result });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [employee.id, range.to, store.revision, balanceKey]);
  useEffect(() => {
    let active = true;
    if (employee.photoDocumentId)
      void import('./hr-file-archive')
        .then((module) =>
          module.previewHrDocument(`document://${employee.photoDocumentId}`),
        )
        .then((url) => {
          if (active) {
            photoUrl.current = url;
            setPhoto(url);
          } else URL.revokeObjectURL(url);
        })
        .catch(() => undefined);
    return () => {
      active = false;
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    };
  }, [employee.photoDocumentId]);
  const mapped = employeeProfileSources[source.tab];
  const realSource: HrSource = mapped
    ? { ...source, section: mapped[0], tab: mapped[1] }
    : source;
  const matchingRecords = records.filter((item) =>
    source.tab === 'leave'
      ? isEmployeeLeave(item)
      : item.section === realSource.section && item.tab === realSource.tab,
  );
  const selected =
    realSource.section === 'employee' && realSource.tab === 'assignment'
      ? [...matchingRecords]
          .sort(
            (a, b) =>
              (b.effectiveAt ?? b.createdAt).localeCompare(
                a.effectiveAt ?? a.createdAt,
              ) ||
              b.createdAt.localeCompare(a.createdAt) ||
              b.id.localeCompare(a.id),
          )
          .slice(0, 1)
      : matchingRecords;
  const data =
    source.tab === 'summary'
      ? {
          columns: ['مشخصات', 'مقدار'],
          rows: employeeSummaryFields(
            employee,
            profile.records ?? [],
            references.data.records,
            store.data!.capabilities.sensitive,
            userLabel,
          ),
          totalLabel: '',
        }
      : source.tab === 'requests'
        ? {
            columns: ['کد', 'درخواست', 'وضعیت'],
            rows: records
              .filter((item) => getHrResource(item.section, item.tab)?.approval)
              .map((item) => [
                item.code,
                sourceForRecord(item).label,
                item.status,
              ]),
            totalLabel: '',
          }
        : source.tab === 'attendance'
          ? employeeAttendanceDataset(records)
          : source.tab === 'leave'
            ? employeeLeaveDataset(selected)
            : recordsDataset(realSource.section, realSource.tab, selected);
  const pending = records.filter(
    (item) =>
      item.employeeId === employee.id &&
      !item.deletedAt &&
      (item.section === 'requests' || isEmployeeLeave(item)) &&
      /انتظار|بررسی/.test(item.status),
  );
  const rowSelection = useHrRowSelection(
    JSON.stringify([employee.id, source.tab, range]),
  );
  const exportData = selectedHrDataset(data, rowSelection.selectedIds);
  const branch =
    employee.companyName ||
    store.data!.branches.find((item) => item.id === employee.branchId)?.name ||
    '';
  const canWrite = store.data!.capabilities.write;
  const resource = getHrResource(realSource.section, realSource.tab);
  const canManage = canWrite && Boolean(resource && !resource.readOnly);
  if (!groups.length)
    return <p role="alert">دسترسی به زیربخش‌های این صفحه فعال نیست.</p>;
  return (
    <div className={ui.spaced}>
      {attendanceEdit && store.data!.capabilities.manualAttendance ? (
        <HrAttendanceEditor
          record={attendanceEdit}
          onClose={() => setAttendanceEdit(null)}
          onSaved={async () => {
            await store.mutated();
            timeline.retry();
          }}
        />
      ) : null}
      <HrPanel title="پرونده شخصی کارمند">
        <div className={ui.profileHead}>
          {photo ? (
            <Image
              unoptimized
              width={84}
              height={84}
              className={ui.avatar}
              src={photo}
              alt={`عکس ${employee.name}`}
            />
          ) : (
            <span className={ui.avatar}>{employee.name.slice(0, 1)}</span>
          )}
          <div>
            <h1>{employee.name}</h1>
            <p>
              {employee.personnelCode} · {employee.position} · {branch} /{' '}
              {employee.unit}
            </p>
            <HrStatus>{employee.status}</HrStatus>
          </div>
          {canWrite ? (
            <div className={ui.actions}>
              <HrButton onClick={() => setEditing(true)}>
                ویرایش مشخصات
              </HrButton>
            </div>
          ) : null}
        </div>
      </HrPanel>
      <HrTabs
        items={groups}
        value={group.id}
        onChange={(id) => {
          setGroupId(id);
          setTab(groups.find((item) => item.id === id)!.sources[0]!.tab);
        }}
        label="بخش‌های پرونده کارمند"
      />
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton
              data={source.tab === 'summary' ? data : exportData}
              name={`employee-${employee.personnelCode}-${source.tab}`}
            />
            <HrPdfButton
              data={source.tab === 'summary' ? data : exportData}
              title={`${employee.name} · ${source.label}`}
            />
            {canManage ? (
              <HrButton
                primary
                onClick={() =>
                  onForm({ source: realSource, employeeId: employee.id })
                }
              >
                {source.action || `افزودن ${source.label}`}
              </HrButton>
            ) : null}
          </>
        }
      />
      <HrPanel title={group.label}>
        <div className={ui.filters}>
          <label>
            نمایش
            <NativeSearchSelect
              value={source.tab}
              onChange={(event) => setTab(event.target.value)}
            >
              {group.sources.map((item) => (
                <option key={item.tab} value={item.tab}>
                  {item.label}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
        </div>
        {source.tab === 'summary' ? (
          profile.loading ? (
            <p role="status">در حال دریافت اطلاعات…</p>
          ) : profile.error ? (
            <div role="alert">
              {profile.error}
              <HrButton onClick={profile.retry}>تلاش دوباره</HrButton>
            </div>
          ) : (
            <HrEmployeeSummary
              employee={employee}
              records={profile.records ?? []}
              references={references.data.records}
              sensitive={store.data!.capabilities.sensitive}
              userLabel={userLabel}
            />
          )
        ) : source.tab === 'audit' ? (
          store.data!.capabilities.audit ? (
            <HrAudit store={store} employeeId={employee.id} />
          ) : (
            <p>دسترسی مشاهده تاریخچه برای شما فعال نیست.</p>
          )
        ) : timeline.loading ? (
          <p role="status">در حال دریافت اطلاعات…</p>
        ) : timeline.error ? (
          <div role="alert">
            {timeline.error}
            <HrButton onClick={timeline.retry}>تلاش دوباره</HrButton>
          </div>
        ) : source.tab === 'requests' ? (
          <HrTable
            {...rowSelection}
            data={{
              columns: ['کد', 'درخواست', 'وضعیت'],
              rows: records
                .filter(
                  (item) => getHrResource(item.section, item.tab)?.approval,
                )
                .map((item) => [
                  item.code,
                  sourceForRecord(item).label,
                  item.status,
                ]),
              totalLabel: '',
            }}
            onOpen={(index) => {
              const item = records.filter(
                (item) => getHrResource(item.section, item.tab)?.approval,
              )[index]!;
              onSelect(item, sourceForRecord(item));
            }}
          />
        ) : (
          <HrTable
            data={data}
            showSelection={source.tab !== 'attendance'}
            {...(source.tab === 'attendance' &&
            store.data!.capabilities.manualAttendance
              ? {
                  onEdit: (index: number) => {
                    const rows = records
                      .filter(
                        (r) =>
                          r.section === 'time' &&
                          r.tab === 'attendance' &&
                          !r.deletedAt,
                      )
                      .sort(
                        (a, b) =>
                          (b.values[1] ?? '').localeCompare(
                            a.values[1] ?? '',
                          ) || a.id.localeCompare(b.id),
                      );
                    setAttendanceEdit(rows[index] ?? null);
                  },
                }
              : {})}
            {...rowSelection}
            {...(needsHrDetail(
              realSource.section,
              realSource.tab,
              Boolean(
                getHrResource(realSource.section, realSource.tab)?.approval,
              ),
            )
              ? {
                  onOpen: (index: number) =>
                    onSelect(
                      selected[index]!,
                      sourceForRecord(selected[index]!),
                    ),
                }
              : {})}
            {...(canManage && source.tab !== 'attendance'
              ? {
                  onDelete: (index: number) => setRemoving(selected[index]!),
                  onEdit: (index: number) =>
                    onForm({
                      source: sourceForRecord(selected[index]!),
                      record: selected[index]!,
                      employeeId: employee.id,
                    }),
                }
              : {})}
          />
        )}
        {group.id === 'pay' && !timeline.loading && !timeline.error ? (
          <HrPayDocuments
            key={`${employee.id}:${source.tab}`}
            employee={employee}
            section={source.label}
            records={records}
            store={store}
            onSaved={timeline.retry}
          />
        ) : null}
      </HrPanel>
      <div className={ui.grid}>
        {source.tab === 'leave' ? (
          <div className={ui.card}>
            <span>مرخصی تأییدشده</span>
            <strong className={ui.metric}>
              {records
                .filter(
                  (record) =>
                    isEmployeeLeave(record) &&
                    ['تأییدشده', 'تاییدشده', 'فعال'].includes(record.status),
                )
                .length.toLocaleString('fa-IR')}
            </strong>
          </div>
        ) : null}
        <div className={ui.card}>
          <span>مرخصی روزانه باقی‌مانده</span>
          <strong className={ui.metric}>
            {balances?.monthlyDailyRemaining?.toLocaleString('fa-IR') ?? '—'}{' '}
            روز
          </strong>
        </div>
        <div className={ui.card}>
          <span>مرخصی ساعتی باقی‌مانده</span>
          <strong className={ui.metric}>
            {balances?.monthlyHourlyRemaining?.toLocaleString('fa-IR') ?? '—'}{' '}
            نوبت
          </strong>
        </div>
        <div className={ui.card}>
          <span>درخواست در انتظار</span>
          <strong className={ui.metric}>
            {pending.length.toLocaleString('fa-IR')}
          </strong>
        </div>
        <div className={ui.card}>
          <span>قرارداد ثبت‌شده</span>
          <strong className={ui.metric}>
            {records
              .filter(
                (item) => item.section === 'contracts' && item.tab === 'active',
              )
              .length.toLocaleString('fa-IR')}
          </strong>
        </div>
        <div className={ui.card}>
          <span>تجهیزات تحویلی</span>
          <strong className={ui.metric}>
            {records
              .filter(
                (item) => item.section === 'assets' && item.tab === 'list',
              )
              .length.toLocaleString('fa-IR')}
          </strong>
        </div>
      </div>
      {source.tab === 'leave' && balances ? (
        <HrPanel title="گردش مانده مرخصی">
          <HrLeaveGrant employeeId={employee.id} store={store} />
          <HrTable
            data={{
              columns: ['نوع مرخصی', 'سهمیه ثبت‌شده', 'مصرف‌شده', 'مانده'],
              rows: balances.items.map((item) => [
                item.type,
                item.granted,
                item.used,
                item.balance,
              ]),
              totalLabel: '',
            }}
          />
        </HrPanel>
      ) : null}
      {removing ? (
        <HrConfirmDelete
          title={removing.code}
          onClose={() => setRemoving(null)}
          onConfirm={() => store.remove(removing)}
        />
      ) : null}
      {editing ? (
        <HrEmployeeEditor
          employee={employee}
          store={store}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
