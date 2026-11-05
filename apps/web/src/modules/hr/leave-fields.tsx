'use client';
import { useState } from 'react';
import type { WorkbenchLeaveInputV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Button, Input, Textarea } from '@/components/ui';
import { hrRequest } from './hr-api';

export type LeaveUser = { id: string; displayName: string; username: string };
export function LeaveFields({
  value,
  onChange,
  users,
  branchId,
  disabled,
  onBusy,
}: {
  value: WorkbenchLeaveInputV1;
  onChange: (value: WorkbenchLeaveInputV1) => void;
  users: LeaveUser[];
  branchId: string;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  return (
    <fieldset
      disabled={disabled || uploading}
      className="grid gap-4 rounded-2xl border bg-primary/5 p-4 col-span-full sm:grid-cols-2"
    >
      <legend className="px-2 text-sm font-bold">مرخصی</legend>
      <label className="space-y-2 text-sm">
        نوع مرخصی *
        <NativeSearchSelect
          value={value.leaveType ?? 'استحقاقی'}
          onChange={(e) =>
            onChange({
              ...value,
              leaveType: e.target.value as 'استحقاقی' | 'استعلاجی',
              attachmentIds: [],
            })
          }
        >
          <option>استحقاقی</option>
          <option>استعلاجی</option>
        </NativeSearchSelect>
      </label>
      <label className="space-y-2 text-sm">
        میزان عدم حضور
        <NativeSearchSelect
          value={value.mode}
          onChange={(e) =>
            onChange({
              ...value,
              mode: e.target.value as 'روزانه' | 'ساعتی',
              to: e.target.value === 'ساعتی' ? value.from : value.to,
            })
          }
        >
          <option>روزانه</option>
          <option>ساعتی</option>
        </NativeSearchSelect>
      </label>
      <label className="space-y-2 text-sm">
        از تاریخ *
        <DatePicker
          value={value.from}
          onChange={(from) =>
            onChange({
              ...value,
              from,
              to: value.mode === 'ساعتی' ? from : value.to || from,
            })
          }
        />
      </label>
      <label className="space-y-2 text-sm">
        تا تاریخ *
        <DatePicker
          value={value.to}
          onChange={(to) =>
            onChange({
              ...value,
              to,
              from: value.mode === 'ساعتی' ? to : value.from,
            })
          }
        />
      </label>
      {value.mode === 'ساعتی' ? (
        <>
          <label className="space-y-2 text-sm">
            از ساعت *
            <Input
              required
              type="time"
              value={value.startTime ?? ''}
              onChange={(e) =>
                onChange({ ...value, startTime: e.target.value })
              }
            />
          </label>
          <label className="space-y-2 text-sm">
            تا ساعت *
            <Input
              required
              type="time"
              value={value.endTime ?? ''}
              onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            />
          </label>
        </>
      ) : null}
      <label className="space-y-2 text-sm sm:col-span-2">
        جانشین احتمالی
        <NativeSearchSelect
          value={value.substituteUserId ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              substituteUserId: e.target.value || undefined,
              substitute: users.find((u) => u.id === e.target.value)
                ?.displayName,
            })
          }
        >
          <option value="">بدون جانشین</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} · {u.username}
            </option>
          ))}
        </NativeSearchSelect>
      </label>
      <label className="space-y-2 text-sm sm:col-span-2">
        دلیل مرخصی *
        <Textarea
          required
          minLength={3}
          maxLength={500}
          value={value.reason}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
        />
      </label>
      {value.leaveType === 'استعلاجی' ? (
        <div className="space-y-3 rounded-xl border bg-surface p-3 sm:col-span-2">
          <label className="block space-y-2 text-sm">
            مدارک استعلاجی
            <Input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={
                disabled ||
                uploading ||
                !value.to ||
                !branchId ||
                (value.attachmentIds?.length ?? 0) >= 5
              }
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = '';
                setUploading(true);
                onBusy?.(true);
                setError('');
                try {
                  const form = new FormData();
                  form.append('file', file);
                  form.append('branchId', branchId);
                  form.append('validUntil', value.to);
                  const document = await hrRequest<{
                    id: string;
                    name: string;
                  }>('/leave-evidence', { method: 'POST', body: form });
                  setNames((n) => ({ ...n, [document.id]: document.name }));
                  onChange({
                    ...value,
                    attachmentIds: [
                      ...(value.attachmentIds ?? []),
                      document.id,
                    ],
                  });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'بارگذاری مدرک انجام نشد.',
                  );
                } finally {
                  setUploading(false);
                  onBusy?.(false);
                }
              }}
            />
          </label>
          {uploading ? (
            <p role="status" className="text-sm">
              در حال بارگذاری…
            </p>
          ) : null}
          {value.attachmentIds?.map((id, index) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">
                {names[id] ?? `مدرک ${index + 1}`}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...value,
                    attachmentIds: value.attachmentIds?.filter((v) => v !== id),
                  })
                }
              >
                حذف پیوست
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
