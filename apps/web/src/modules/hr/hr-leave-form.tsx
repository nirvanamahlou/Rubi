'use client';
import { useEffect, useRef, useState } from 'react';
import type { HrRecordDto, WorkbenchLeaveInputV1 } from '@nora/contracts';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { LeaveEvidenceList } from './leave-evidence-list';
import { LeaveFields, type LeaveUser } from './leave-fields';
import { hrRequest } from './hr-api';
import { persianDateToIso } from './hr-dates';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';
export function HrLeaveForm({
  target,
  store,
  onClose,
  onSaved,
}: {
  target: HrFormTarget;
  store: HrStore;
  onClose: () => void;
  onSaved: (record: HrRecordDto) => void;
}) {
  const record = target.record,
    values = record?.values ?? [],
    data = record?.data ?? {};
  const [employeeId, setEmployeeId] = useState(
    record?.employeeId ?? target.employeeId ?? '',
  );
  const employee = store.data!.employees.find((e) => e.id === employeeId);
  const branchId = employee?.branchId ?? record?.branchId ?? '';
  const [leave, setLeave] = useState<WorkbenchLeaveInputV1>({
    from: values[2] ? persianDateToIso(values[2]) : '',
    to: values[3] ? persianDateToIso(values[3]) : '',
    mode: values.length === 8 ? (values[4] as 'روزانه' | 'ساعتی') : 'روزانه',
    startTime: values.length === 8 ? values[5] : '',
    endTime: values.length === 8 ? values[6] : '',
    leaveType: values[1] === 'استعلاجی' ? 'استعلاجی' : 'استحقاقی',
    reason: data.reason ?? '',
    substituteUserId: data.substituteUserId ?? undefined,
    attachmentIds: data.leaveAttachmentIds,
  });
  const [users, setUsers] = useState<LeaveUser[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(record?.status ?? 'در انتظار تأیید');
  const retry = useRef({ body: '', key: '' });
  const final = Boolean(
    record &&
    ['تأییدشده', 'تاییدشده', 'ردشده', 'لغوشده'].includes(record.status),
  );
  useEffect(() => {
    if (!branchId) return;
    let active = true;
    void hrRequest<{ users: LeaveUser[] }>(
      `/leave-options?branchId=${encodeURIComponent(branchId)}`,
    )
      .then((r) => {
        if (active) setUsers(r.users);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [branchId]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !uploading) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90dvh] max-w-3xl overflow-y-auto"
      >
        <DialogTitle>{record ? 'مرخصی کارمند' : 'ثبت مرخصی'}</DialogTitle>
        <DialogDescription>
          {employee?.name ?? 'انتخاب کارمند'}
        </DialogDescription>
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || uploading || !employee || final) return;
            setBusy(true);
            setError('');
            try {
              const input = {
                branchId,
                section: 'requests',
                tab: 'radanLeave',
                employeeId,
                status,
                values: [
                  employee.name,
                  leave.leaveType ?? 'استحقاقی',
                  leave.from,
                  leave.to,
                  leave.mode,
                  leave.mode === 'ساعتی' ? (leave.startTime ?? '') : '',
                  leave.mode === 'ساعتی' ? (leave.endTime ?? '') : '',
                  'خیر',
                ],
                data: {
                  reason: leave.reason,
                  substituteUserId: leave.substituteUserId ?? null,
                  leaveAttachmentIds: leave.attachmentIds ?? [],
                },
              };
              let saved: HrRecordDto;
              if (record)
                saved = await store.update(record, {
                  values: input.values,
                  data: input.data,
                });
              else {
                const body = JSON.stringify(input);
                if (body !== retry.current.body)
                  retry.current = { body, key: crypto.randomUUID() };
                saved = await store.create(input, retry.current.key);
              }
              onSaved(saved);
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'ثبت مرخصی انجام نشد.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="space-y-2 text-sm">
            کارمند *
            <NativeSearchSelect
              required
              disabled={Boolean(target.employeeId || record) || busy}
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setLeave((v) => ({
                  ...v,
                  substituteUserId: undefined,
                  attachmentIds: [],
                }));
              }}
            >
              <option value="">انتخاب کارمند</option>
              {store.data!.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.personnelCode}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          <LeaveFields
            value={leave}
            onChange={(next) => {
              setLeave(next);
              if (next.substituteUserId && status === 'تأییدشده')
                setStatus('در انتظار تأیید');
            }}
            users={users.filter((u) => u.id !== employee?.userId)}
            branchId={branchId}
            disabled={busy || final}
            onBusy={setUploading}
          />
          {record ? (
            <LeaveEvidenceList
              ids={data.leaveAttachmentIds ?? []}
              path={`/hr/records/${record.id}/leave-evidence`}
            />
          ) : null}
          {!record ? (
            <label className="space-y-2 text-sm">
              وضعیت
              <NativeSearchSelect
                value={status}
                disabled={busy}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>در انتظار تأیید</option>
                <option>پیش‌نویس</option>
                {store.data!.capabilities.approve && !leave.substituteUserId ? (
                  <option>تأییدشده</option>
                ) : null}
              </NativeSearchSelect>
            </label>
          ) : null}
          {error ? <Alert tone="error" title={error} /> : null}
          <div className="flex gap-2 border-t pt-4">
            {!final ? (
              <Button type="submit" disabled={busy || uploading || !employee}>
                {busy ? 'در حال ثبت…' : 'ثبت مرخصی'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              بستن
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
