'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useEffect, useState } from 'react';
import { getHrResource, type HrRecordDto } from '@nora/contracts';
import { allHrRecords, type HrStore } from './hr-store';
import {
  HrExportButton,
  HrPdfButton,
  HrPanel,
  HrRangeBar,
  HrTable,
} from './hr-controls';
import { sourceForRecord } from './hr-record-source';
import type { HrSource } from './hr-navigation';
import ui from './hr-unified.module.css';
import { selectedHrDataset, useHrRowSelection } from './hr-row-selection';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';

type WorkbenchHrRequest = Awaited<
  ReturnType<typeof customerAffairsApi.hrWorkbenchRequests>
>['data'][number];

export function HrInbox({
  store,
  onSelect,
}: {
  store: HrStore;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const [items, setItems] = useState<HrRecordDto[]>([]);
  const [status, setStatus] = useState('در انتظار تأیید');
  const [requestType, setRequestType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  const [workbenchItems, setWorkbenchItems] = useState<WorkbenchHrRequest[]>(
    [],
  );
  const selection = useHrRowSelection(
    JSON.stringify([status, range, requestType, employeeId]),
  );
  useEffect(() => {
    let active = true;
    void allHrRecords({
      dateField: 'createdAt',
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((result) => {
        if (active)
          setItems(
            result.filter(
              (item) =>
                getHrResource(item.section, item.tab)?.approval &&
                (!requestType || `${item.section}.${item.tab}` === requestType),
            ),
          );
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'دریافت درخواست‌ها انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [status, range, store.revision, requestType, employeeId]);
  useEffect(() => {
    let active = true;
    void customerAffairsApi
      .hrWorkbenchRequests()
      .then((response) => {
        if (active) setWorkbenchItems(response.data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'درخواست‌های میزکار دریافت نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [store.revision]);
  const data = {
    columns: ['کد', 'نوع درخواست', 'کارمند', 'شرکت', 'آخرین تغییر', 'وضعیت'],
    rows: items.map((item) => [
      item.code,
      sourceForRecord(item).label,
      store.data!.employees.find((employee) => employee.id === item.employeeId)
        ?.name ?? '—',
      store.data!.records.find(
        (company) => company.id === item.data.organizationBranchId,
      )?.values[0] ||
        store.data!.employees.find(
          (employee) => employee.id === item.employeeId,
        )?.companyName ||
        store.data!.branches.find((branch) => branch.id === item.branchId)
          ?.name ||
        '',
      new Date(item.updatedAt).toLocaleDateString('fa-IR'),
      item.status,
    ]),
    recordIds: items.map((item) => item.id),
    totalLabel: '',
  };
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <div>
          <h1>کارتابل و درخواست‌های من</h1>
          <p>درخواست‌های بخش‌های مختلف و رسیدگی به همان پرونده اصلی</p>
        </div>
      </header>
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton
              data={selectedHrDataset(data, selection.selectedIds)}
              name="hr-inbox"
            />
            <HrPdfButton
              data={selectedHrDataset(data, selection.selectedIds)}
              title="کارتابل منابع انسانی"
            />
          </>
        }
      />
      <HrPanel title="درخواست‌ها">
        <div className={ui.filters}>
          <label>
            نوع درخواست
            <NativeSearchSelect
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="">همه درخواست‌ها</option>
              <option value="time.leave">مرخصی</option>
              <option value="requests.leave">مرخصی میزکار</option>
              <option value="time.corrections">اصلاح تردد</option>
              <option value="requests.attendance">اصلاح تردد میزکار</option>
              <option value="time.mission">مأموریت</option>
              <option value="expenses.mission">مأموریت و سفر</option>
              <option value="time.overtime">اضافه‌کاری</option>
              <option value="time.remote">دورکاری</option>
            </NativeSearchSelect>
          </label>
          <label>
            درخواست برای
            <NativeSearchSelect
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">همه کارکنان مجاز</option>
              {store.data!.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          <label>
            وضعیت رسیدگی
            <NativeSearchSelect
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              {[
                'پیش‌نویس',
                'در انتظار تأیید',
                'تأییدشده',
                'ردشده',
                'لغوشده',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </NativeSearchSelect>
          </label>
        </div>
        {error ? (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        ) : null}
        <HrTable
          data={data}
          {...selection}
          onOpen={(index) =>
            onSelect(items[index]!, sourceForRecord(items[index]!))
          }
        />
      </HrPanel>
      <HrPanel title="درخواست‌های میزکار به منابع انسانی">
        {workbenchItems.length ? (
          <ul className="space-y-3">
            {workbenchItems.map((item) => (
              <li key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2 font-semibold">
                  <span>{item.subject}</span>
                  <span>{item.status}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {item.description}
                </p>
                <span className="text-xs text-muted-foreground">
                  {item.trackingNumber} ·{' '}
                  {new Date(item.updatedAt).toLocaleDateString('fa-IR')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>درخواستی از میزکار ثبت نشده است.</p>
        )}
      </HrPanel>
    </div>
  );
}
