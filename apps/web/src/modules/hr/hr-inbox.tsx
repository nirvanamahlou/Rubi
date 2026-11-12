'use client';
import { matchesHrRequestType } from './hr-request-type';
import { leaveDescription } from '@/modules/workbench/leave-description';
import { LeaveEvidenceList } from './leave-evidence-list';
import { Dialog, DialogContent, DialogTitle, Button } from '@/components/ui';
import { workbenchRequestStatusLabel } from '@/modules/workbench/workbench-request-status';
import { DatePicker } from '@/components/ui/date-picker';
import { HrButton } from './hr-controls';
import { ClipboardCheck, Forward } from 'lucide-react';
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
import {
  HrInboxForwardDialog,
  type HrInboxForwardRow,
} from './hr-inbox-forward-dialog';
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
  const [forward, setForward] = useState<HrInboxForwardRow | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [forwarded, setForwarded] = useState(false);
  useEffect(() => {
    let active = true;
    void customerAffairsApi
      .hrInboxSeen()
      .then(({ data }) => {
        if (active)
          setSeen((current) => new Set([...data, ...(current ?? [])]));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت وضعیت مشاهده انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const [items, setItems] = useState<HrRecordDto[]>([]);
  const [status, setStatus] = useState('در انتظار تأیید');
  const [requestType, setRequestType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  const [review, setReview] = useState<WorkbenchHrRequest | null>(null);
  const [decision, setDecision] = useState('APPROVED');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);
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
                matchesHrRequestType(item, requestType),
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
  }, [store.revision, revision]);
  const filteredWorkbench = workbenchItems.filter(
    (item) =>
      (!status || workbenchRequestStatusLabel(item.status) === status) &&
      (!employeeId ||
        store.data!.employees.find((e) => e.id === employeeId)?.userId ===
          item.senderId) &&
      (!range.from || item.createdAt.slice(0, 10) >= range.from) &&
      (!range.to || item.createdAt.slice(0, 10) <= range.to) &&
      (!requestType || (item.leave && requestType === 'leave')),
  );
  const visibleItems = items.filter((item) => !item.code.startsWith('WB-'));
  const onReview = async () => {
    if (!review) return;
    setBusy(true);
    setError('');
    try {
      await customerAffairsApi.reviewHrWorkbenchRequest(
        review.id,
        review.version,
        decision,
      );
      setReview(null);
      setRevision((n) => n + 1);
      await store.mutated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت نتیجه انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const inboxRow = (index: number): HrInboxForwardRow => {
    const native = visibleItems[index];
    if (native)
      return {
        id: native.id,
        source: 'hr',
        title:
          native.values[native.columns.indexOf('عنوان درخواست')]?.trim() ||
          (native.data.requestSubtype ?? sourceForRecord(native).label),
      };
    const item = filteredWorkbench[index - visibleItems.length]!;
    return { id: item.id, source: 'workbench', title: item.subject };
  };
  const openRow = (index: number) => {
    const { id, source } = inboxRow(index);
    if (!seen?.has(id))
      void customerAffairsApi
        .markHrInboxSeen(id, source)
        .then(() => {
          setSeen((current) => new Set([...(current ?? []), id]));
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error ? cause.message : 'ثبت مشاهده انجام نشد.',
          );
        });
    if (index < visibleItems.length)
      onSelect(visibleItems[index]!, sourceForRecord(visibleItems[index]!));
    else {
      setDecision('APPROVED');
      setReview(filteredWorkbench[index - visibleItems.length]!);
    }
  };
  const deleteRow = async () => {
    if (deleting === null) return;
    setBusy(true);
    setError('');
    try {
      if (deleting < visibleItems.length)
        await store.remove(visibleItems[deleting]!);
      else
        await customerAffairsApi.removeHrWorkbenchRequest(
          filteredWorkbench[deleting - visibleItems.length]!.id,
        );
      setDeleting(null);
      setRevision((n) => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حذف انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const data = {
    columns: ['کد', 'عنوان درخواست', 'کارمند', 'شرکت', 'تاریخ ایجاد', 'وضعیت'],
    rows: [
      ...visibleItems.map((item) => [
        item.code,
        item.values[item.columns.indexOf('عنوان درخواست')]?.trim() ||
          (item.data.requestSubtype ?? sourceForRecord(item).label),
        store.data!.employees.find(
          (employee) => employee.id === item.employeeId,
        )?.name ??
          item.values[item.columns.indexOf('کارمند')] ??
          '—',
        store.data!.records.find(
          (company) => company.id === item.data.organizationBranchId,
        )?.values[0] ||
          store.data!.employees.find(
            (employee) => employee.id === item.employeeId,
          )?.companyName ||
          store.data!.branches.find((branch) => branch.id === item.branchId)
            ?.name ||
          '',
        new Date(item.createdAt).toLocaleDateString('fa-IR'),
        item.status,
      ]),
      ...filteredWorkbench.map((item) => [
        item.trackingNumber,
        item.subject,
        item.senderName,
        store.data!.branches.find((branch) => branch.id === item.branchId)
          ?.name ?? '',
        new Date(item.createdAt).toLocaleDateString('fa-IR'),
        workbenchRequestStatusLabel(item.status),
      ]),
    ],
    recordIds: [
      ...visibleItems.map((item) => item.id),
      ...filteredWorkbench.map((item) => item.id),
    ],
    totalLabel: '',
  };
  const unreadIds = new Set(
    seen ? data.recordIds.filter((id) => !seen.has(id)) : [],
  );
  const { write, approve, sensitive } = store.data!.capabilities;
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
      <HrPanel
        title="درخواست‌ها"
        actions={
          seen ? (
            <span
              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100"
              aria-live="polite"
            >
              {unreadIds.size.toLocaleString('fa-IR')} درخواست دیده‌نشده
            </span>
          ) : null
        }
      >
        {forwarded ? (
          <p role="status" className="mb-3 text-sm text-primary">
            درخواست بازارسال شد.
          </p>
        ) : null}
        <div className={ui.filters}>
          <label>
            نوع درخواست
            <NativeSearchSelect
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="">همه درخواست‌ها</option>
              <option value="leave">مرخصی</option>
              <option value="attendance">اصلاح تردد</option>
              <option value="advance">مساعده</option>
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
            از تاریخ ایجاد
            <DatePicker
              value={range.from}
              onChange={(from) => setRange({ ...range, from })}
            />
          </label>
          <label>
            تا تاریخ ایجاد
            <DatePicker
              value={range.to}
              onChange={(to) => setRange({ ...range, to })}
            />
          </label>
          <HrButton
            onClick={() => {
              setRange({ from: '', to: '' });
              setStatus('');
              setRequestType('');
              setEmployeeId('');
            }}
          >
            بازنشانی
          </HrButton>
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
                'نیازمند اصلاح',
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
          onOpen={openRow}
          {...(store.data!.capabilities.write ? { onDelete: setDeleting } : {})}
          unreadIds={unreadIds}
          rowActions={(index) => (
            <>
              {write && approve && sensitive ? (
                <HrButton
                  onClick={() => {
                    setForwarded(false);
                    setForward(inboxRow(index));
                  }}
                  aria-label="بازارسال"
                  title="بازارسال"
                >
                  <Forward className="size-4" aria-hidden="true" />
                </HrButton>
              ) : null}
              <HrButton
                onClick={() => openRow(index)}
                aria-label="رسیدگی"
                title="رسیدگی"
              >
                <ClipboardCheck className="size-4" aria-hidden="true" />
              </HrButton>
            </>
          )}
        />
      </HrPanel>
      {forward ? (
        <HrInboxForwardDialog
          row={forward}
          onClose={() => setForward(null)}
          onSent={() => {
            setForward(null);
            setForwarded(true);
          }}
        />
      ) : null}
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] max-w-3xl overflow-y-auto p-0"
          dir="rtl"
        >
          <header className="flex items-center gap-3 border-b bg-primary/5 p-5 pl-12">
            <span className="rounded-xl bg-primary p-3 text-primary-foreground">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>رسیدگی به درخواست</DialogTitle>
          </header>
          {review ? (
            <div className="space-y-5 bg-muted/10 p-5 sm:p-6">
              <p className="text-xl font-black">{review.subject}</p>
              <p className="rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                {review.senderName} · {review.trackingNumber}
              </p>
              <p className="whitespace-pre-wrap rounded-xl bg-muted/30 p-4 text-sm leading-7">
                {leaveDescription(review.description, review.leave, false)}
              </p>
              {review.leave ? (
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-5 rounded-2xl border border-primary/15 bg-background p-5 text-sm shadow-sm [&_dd]:break-words [&_dd]:font-semibold [&_dt]:text-muted-foreground">
                  <dt>تاریخ</dt>
                  <dd>
                    {new Date(review.leave.from).toLocaleDateString('fa-IR')} —{' '}
                    {new Date(review.leave.to).toLocaleDateString('fa-IR')}
                  </dd>
                  <dt>میزان عدم حضور</dt>
                  <dd>
                    {review.leave.mode} {review.leave.startTime}{' '}
                    {review.leave.endTime ? `تا ${review.leave.endTime}` : ''}
                  </dd>
                  <dt>نوع مرخصی</dt>
                  <dd>{review.leave.leaveType ?? 'استحقاقی'}</dd>
                  <dt>دلیل</dt>
                  <dd>{review.leave.reason}</dd>
                  <dt>جانشین احتمالی</dt>
                  <dd>
                    {review.leave.substitute || '—'}
                    {review.substituteStatus
                      ? ` · ${review.substituteStatus === 'APPROVED' ? 'تأییدشده' : review.substituteStatus === 'REJECTED' ? 'ردشده' : 'در انتظار پاسخ'}`
                      : ''}
                  </dd>
                </dl>
              ) : null}
              <LeaveEvidenceList
                ids={review.leave?.attachmentIds ?? []}
                path={`/customer-affairs/workbench/hr-requests/${review.id}/evidence`}
              />
              <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {workbenchRequestStatusLabel(review.status)}
              </p>
              {!['APPROVED', 'REJECTED'].includes(review.status) &&
              store.data!.capabilities.approve &&
              store.data!.capabilities.write ? (
                <>
                  <label className="block space-y-2">
                    وضعیت
                    <NativeSearchSelect
                      disabled={busy}
                      value={decision}
                      onChange={(event) => setDecision(event.target.value)}
                    >
                      <option value="APPROVED">تأیید</option>
                      <option value="REJECTED">رد</option>
                      <option value="NEEDS_REVISION">نیازمند اصلاح</option>
                    </NativeSearchSelect>
                  </label>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={busy}
                    onClick={() => void onReview()}
                  >
                    ثبت نتیجه
                  </Button>
                </>
              ) : null}
              {error ? <p role="alert">{error}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>حذف درخواست از کارتابل؟</DialogTitle>
          <Button disabled={busy} onClick={() => void deleteRow()}>
            حذف
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            انصراف
          </Button>
          {error ? <p role="alert">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
