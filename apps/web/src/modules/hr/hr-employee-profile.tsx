'use client';
import Image from 'next/image';
import { DatePicker } from '@/components/ui/date-picker';
import { useEffect, useRef, useState } from 'react';
import type { HrEmployeeDto, HrRecordDto } from '@rubi/contracts';
import { getHrResource } from '@rubi/contracts';
import { employeeGroups, resolveHrGroup, type HrSource } from './hr-navigation';
import { employeeProfileSources } from './employee-profile-data';
import { recordsDataset } from './hr-live-data';
import type { HrStore } from './hr-store';
import { allHrRecords } from './hr-store';
import type { HrFormTarget } from './hr-record-form';
import {
  HrButton,
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
import { hrApi, hrRequest } from './hr-api';
import { sourceForRecord } from './hr-unified-section';
import ui from './hr-unified.module.css';

interface LeaveBalances {
  employeeId: string;
  year: number;
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
  const first = resolveHrGroup(employeeGroups, initialTab);
  const [groupId, setGroupId] = useState(first.id);
  const group = employeeGroups.find((item) => item.id === groupId) ?? first;
  const [tab, setTab] = useState(initialTab ?? first.sources[0]!.tab);
  const source =
    group.sources.find((item) => item.tab === tab) ?? group.sources[0]!;
  const [records, setRecords] = useState<HrRecordDto[]>([]);
  const [balances, setBalances] = useState<LeaveBalances | null>(null);
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [uploading, setUploading] = useState(false);
  const [photoExpiry, setPhotoExpiry] = useState('');
  const photoUrl = useRef('');
  const { remember } = store;
  useEffect(() => {
    let active = true;
    void allHrRecords({
      employeeId: employee.id,
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((items) => {
        if (active) {
          setRecords(items);
          remember(items);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'دریافت پرونده انجام نشد.');
      });
    void hrRequest<LeaveBalances>(
      `/leave/balances?employeeId=${employee.id}&asOf=${range.to || new Date().toISOString().slice(0, 10)}`,
    )
      .then((result) => {
        if (active) setBalances(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [employee.id, range, store.revision, remember]);
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
  const selected = records.filter(
    (item) =>
      item.section === realSource.section && item.tab === realSource.tab,
  );
  const data =
    source.tab === 'summary'
      ? {
          columns: [
            'کد پرسنلی',
            'نام و نام خانوادگی',
            'شرکت',
            'واحد',
            'سمت',
            'رده',
            'وضعیت',
          ],
          rows: [
            [
              employee.personnelCode,
              employee.name,
              employee.companyName,
              employee.unit,
              employee.position,
              employee.grade,
              employee.status,
            ],
          ],
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
        : recordsDataset(realSource.section, realSource.tab, selected);
  const pending = records.filter((item) => /انتظار|بررسی/.test(item.status));
  const branch =
    employee.companyName ||
    store.data!.branches.find((item) => item.id === employee.branchId)?.name ||
    '';
  const canWrite = store.data!.capabilities.write;
  return (
    <div className={ui.spaced}>
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
            <span className={ui.status}>{employee.status}</span>
          </div>
          {canWrite ? (
            <div className={ui.actions}>
              <HrButton onClick={() => setEditing(true)}>
                ویرایش مشخصات
              </HrButton>
              <label className={ui.field}>
                اعتبار عکس در بایگانی
                <DatePicker
                  value={photoExpiry}
                  onChange={setPhotoExpiry}
                  aria-label="اعتبار عکس در بایگانی"
                />
              </label>
              <label className={ui.field}>
                عکس پروفایل
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError('اندازه عکس باید کمتر از ۵ مگابایت باشد.');
                      return;
                    }
                    setUploading(true);
                    try {
                      const { archiveHrFile } =
                        await import('./hr-file-archive');
                      const document = await archiveHrFile({
                        file,
                        branchId: employee.branchId,
                        employeeId: employee.id,
                        entityId: employee.id,
                        title: `عکس پروفایل ${employee.name}`,
                        validUntil: photoExpiry || undefined,
                      });
                      await hrApi.employees.update(employee.id, {
                        version: employee.version,
                        photoDocumentId: document.id,
                      });
                      await store.mutated();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : 'بارگذاری عکس انجام نشد.',
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      </HrPanel>
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
      <div className={ui.grid}>
        <div className={ui.card}>
          <span>مرخصی باقی‌مانده</span>
          <strong className={ui.metric}>
            {balances
              ? balances.items
                  .reduce((sum, item) => sum + Number(item.balance), 0)
                  .toLocaleString('fa-IR')
              : '—'}{' '}
            روز
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
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton
              data={data}
              name={`employee-${employee.personnelCode}-${source.tab}`}
            />
            <HrPdfButton
              data={data}
              title={`${employee.name} · ${source.label}`}
            />
            {canWrite &&
            !getHrResource(realSource.section, realSource.tab)?.readOnly &&
            source.tab !== 'summary' ? (
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
      <HrTabs
        items={employeeGroups}
        value={group.id}
        onChange={(id) => {
          setGroupId(id);
          setTab(
            employeeGroups.find((item) => item.id === id)!.sources[0]!.tab,
          );
        }}
        label="بخش‌های پرونده کارمند"
      />
      <HrPanel title={group.label}>
        <div className={ui.filters}>
          <label>
            نمایش
            <select
              value={source.tab}
              onChange={(event) => setTab(event.target.value)}
            >
              {group.sources.map((item) => (
                <option key={item.tab} value={item.tab}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {source.tab === 'summary' ? (
          <dl className={ui.properties}>
            {[
              ['نام و نام خانوادگی', employee.name],
              ['کد پرسنلی', employee.personnelCode],
              ['شرکت', branch],
              ['واحد', employee.unit],
              ['نوع همکاری', employee.kind],
              ['سمت', employee.position],
              ['رده', employee.grade],
              ['مدیر مستقیم', employee.manager],
              [
                'تاریخ شروع',
                new Date(employee.startedAtValue).toLocaleDateString('fa-IR'),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : source.tab === 'audit' ? (
          store.data!.capabilities.audit ? (
            <HrAudit store={store} employeeId={employee.id} />
          ) : (
            <p>دسترسی مشاهده تاریخچه برای شما فعال نیست.</p>
          )
        ) : source.tab === 'requests' ? (
          <HrTable
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
            onOpen={(index) => onSelect(selected[index]!, realSource)}
            {...(canWrite &&
            !getHrResource(realSource.section, realSource.tab)?.readOnly
              ? {
                  onDelete: (index: number) => setRemoving(selected[index]!),
                  onEdit: (index: number) =>
                    onForm({ source: realSource, record: selected[index]! }),
                }
              : {})}
          />
        )}
      </HrPanel>
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
