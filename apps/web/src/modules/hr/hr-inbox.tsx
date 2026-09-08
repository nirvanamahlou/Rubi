'use client';
import { useEffect, useState } from 'react';
import { getHrResource, type HrRecordDto } from '@rubi/contracts';
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

export function HrInbox({
  store,
  onSelect,
}: {
  store: HrStore;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const [items, setItems] = useState<HrRecordDto[]>([]);
  const [status, setStatus] = useState('در انتظار تأیید');
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void allHrRecords({
      ...(status ? { status } : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((result) => {
        if (active)
          setItems(
            result.filter(
              (item) => getHrResource(item.section, item.tab)?.approval,
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
  }, [status, range, store.revision]);
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
            <HrExportButton data={data} name="hr-inbox" />
            <HrPdfButton data={data} title="کارتابل منابع انسانی" />
          </>
        }
      />
      <HrPanel title="درخواست‌ها">
        <div className={ui.filters}>
          <label>
            وضعیت رسیدگی
            <select
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
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        ) : null}
        <HrTable
          data={data}
          onOpen={(index) =>
            onSelect(items[index]!, sourceForRecord(items[index]!))
          }
        />
      </HrPanel>
    </div>
  );
}
