'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getHrResource, type HrRecordDto } from '@rubi/contracts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { HrContractState } from './hr-contract-state';
import { hrApi, hrRequest } from './hr-api';
import type { HrStore } from './hr-store';
import { hrGroups, type HrSource } from './hr-navigation';
import { recordsDataset } from './hr-live-data';
import { HrButton, HrPanel, HrTable, HrStatus } from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import { reportCellText } from './hr-report-text';
import { isMissionExpense } from './hr-mission-reference';
import { sourceForRecord } from './hr-record-source';
import ui from './hr-unified.module.css';

export function HrRecordDetail({
  record: initialRecord,
  source,
  store,
  onClose,
  onForm,
  onSelect,
}: {
  record: HrRecordDto;
  source: HrSource;
  store: HrStore;
  onClose: () => void;
  onForm: (target: HrFormTarget) => void;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const record =
    store.data!.records.find((item) => item.id === initialRecord.id) ??
    initialRecord;
  const definition = getHrResource(record.section, record.tab)!;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [children, setChildren] = useState<HrRecordDto[]>([]);
  const childSources = Array.from(
    new Map(
      Object.values(hrGroups)
        .flatMap((groups) => groups.flatMap((group) => group.sources))
        .filter((item) =>
          getHrResource(item.section, item.tab)?.parentResources.includes(
            `${record.section}.${record.tab}`,
          ),
        )
        .map((item) => [`${item.section}.${item.tab}`, item]),
    ).values(),
  );
  useEffect(() => {
    let active = true;
    void hrApi.records
      .list({ parentId: record.id, pageSize: 200 })
      .then((result) => {
        if (active) setChildren(result.items);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'دریافت سوابق انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [record.id, store.revision]);
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );
  const transition = async (status: string) => {
    if ((status === 'ردشده' || status === 'لغوشده') && !reason.trim()) {
      setError('دلیل رد یا لغو را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.update(record, { status, data: { reason } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تغییر وضعیت انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const openMission = async () => {
    if (!record.parentId) return;
    setBusy(true);
    setError('');
    try {
      const mission = await hrRequest<HrRecordDto>(
        `/records/${encodeURIComponent(record.parentId)}`,
      );
      onSelect(mission, sourceForRecord(mission));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت مأموریت انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const pending = /انتظار|بررسی/.test(record.status);
  const approved = /تأییدشده|فعال|امضا/.test(record.status);
  const canEdit =
    store.data!.capabilities.write &&
    !definition.readOnly &&
    (!definition.approval || !approved);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={ui.detail} dir="rtl">
        <DialogTitle>
          {source.label} · {record.code}
        </DialogTitle>
        <DialogDescription>
          جزئیات پرونده، موارد مرتبط و وضعیت رسیدگی
        </DialogDescription>
        <div className={ui.actions}>
          <HrStatus>{record.status}</HrStatus>
          {record.section !== 'contracts' ? (
            <span className={ui.muted}>
              نسخه {record.version.toLocaleString('fa-IR')}
            </span>
          ) : null}
          {record.employeeId && record.section !== 'contracts' ? (
            <Link href={`/hr?section=employee&employee=${record.employeeId}`}>
              پرونده کارمند
            </Link>
          ) : null}
          {record.parentId && isMissionExpense(record.section, record.tab) ? (
            <HrButton disabled={busy} onClick={() => void openMission()}>
              پرونده مأموریت
            </HrButton>
          ) : null}
          {canEdit && record.section !== 'contracts' ? (
            <HrButton onClick={() => onForm({ source, record })}>
              ویرایش اطلاعات
            </HrButton>
          ) : null}
          {record.section === 'contracts' && record.tab === 'active' ? (
            <HrButton
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const { contractRecordFromRow, downloadContractPdf } =
                    await import('./hr-contract-pdf');
                  const dataset = recordsDataset(record.section, record.tab, [
                    record,
                  ]);
                  await downloadContractPdf({
                    ...contractRecordFromRow(dataset.columns, dataset.rows[0]!),
                    version: String(record.version),
                  });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'ساخت PDF انجام نشد.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              PDF قرارداد
            </HrButton>
          ) : null}
        </div>
        {record.section === 'contracts' && record.tab === 'active' ? (
          <HrContractState record={record} store={store} />
        ) : null}
        {definition.approval ? (
          <div className={ui.spaced}>
            <div className={ui.workflow}>
              {['پیش‌نویس', 'در انتظار تأیید', 'تأییدشده'].map((step) => (
                <span
                  className={`${ui.step} ${record.status === step ? ui.stepActive : ''}`}
                  key={step}
                >
                  {step}
                </span>
              ))}
            </div>
            <div className={ui.actions}>
              {canEdit && !pending ? (
                <HrButton
                  disabled={busy}
                  primary
                  onClick={() => void transition('در انتظار تأیید')}
                >
                  ارسال برای تأیید
                </HrButton>
              ) : null}
              {pending && store.data!.capabilities.approve ? (
                <>
                  <HrButton
                    disabled={busy}
                    primary
                    onClick={() => void transition('تأییدشده')}
                  >
                    تأیید درخواست
                  </HrButton>
                  <HrButton
                    disabled={busy}
                    onClick={() => void transition('ردشده')}
                  >
                    رد درخواست
                  </HrButton>
                </>
              ) : null}
              {(pending || approved) && store.data!.capabilities.write ? (
                <HrButton
                  disabled={busy}
                  onClick={() => void transition('لغوشده')}
                >
                  لغو با ثبت دلیل
                </HrButton>
              ) : null}
            </div>
            <label className={ui.field}>
              یادداشت رسیدگی / دلیل رد یا لغو
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
              />
            </label>
          </div>
        ) : null}
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}
        <dl className={ui.properties}>
          {record.columns.map((label, index) => (
            <div key={`${label}-${index}`}>
              <dt>{label}</dt>
              <dd>
                {record.values[index]?.startsWith('document://') ? (
                  <HrButton
                    onClick={async () => {
                      try {
                        const { previewHrDocument } =
                          await import('./hr-file-archive');
                        setFileUrl(
                          await previewHrDocument(record.values[index]!),
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'نمایش فایل مجاز نیست.',
                        );
                      }
                    }}
                  >
                    نمایش فایل پیوست
                  </HrButton>
                ) : (
                  reportCellText(record.values[index] ?? '') || '—'
                )}
              </dd>
            </div>
          ))}
        </dl>
        {fileUrl ? (
          <iframe
            title="نمایش مدرک"
            sandbox="allow-same-origin"
            src={fileUrl}
            style={{ width: '100%', height: 450, border: 0 }}
          />
        ) : null}
        {record.section === 'lifecycle' && record.tab === 'settlement' ? (
          <p className={ui.notice}>
            تسویه پس از تأیید سرویس مالی نهایی می‌شود. وضعیت مالی این پرونده:{' '}
            {store.data!.integrations.finance === 'UNAVAILABLE'
              ? 'در انتظار اتصال مالی'
              : 'در حال پیگیری'}
          </p>
        ) : null}
        <div className={ui.spaced}>
          {childSources.map((child) => {
            const childDefinition = getHrResource(child.section, child.tab)!;
            const items = children.filter(
              (item) =>
                item.section === child.section && item.tab === child.tab,
            );
            return (
              <HrPanel
                key={`${child.section}.${child.tab}`}
                title={child.label}
                actions={
                  !childDefinition.readOnly &&
                  store.data!.capabilities.write ? (
                    <HrButton
                      onClick={() =>
                        onForm({
                          source: child,
                          parent: record,
                          ...(record.employeeId
                            ? { employeeId: record.employeeId }
                            : {}),
                        })
                      }
                    >
                      {child.action}
                    </HrButton>
                  ) : null
                }
              >
                <HrTable
                  data={recordsDataset(child.section, child.tab, items)}
                  onOpen={(index) => {
                    const item = items[index];
                    if (item) onSelect(item, child);
                  }}
                />
              </HrPanel>
            );
          })}
        </div>
        <div className={ui.muted}>
          {store.data!.capabilities.write &&
          store.data!.capabilities.approve &&
          store.data!.capabilities.sensitive ? (
            <Link
              className="block mb-3 underline"
              href={`/hr?hrConnections=1&sourceRecord=${encodeURIComponent(record.id)}`}
              onClick={onClose}
            >
              ارجاع این پرونده به بخش دیگر
            </Link>
          ) : null}
          ثبت: {new Date(record.createdAt).toLocaleString('fa-IR')} · آخرین
          تغییر: {new Date(record.updatedAt).toLocaleString('fa-IR')}
        </div>
      </DialogContent>
    </Dialog>
  );
}
