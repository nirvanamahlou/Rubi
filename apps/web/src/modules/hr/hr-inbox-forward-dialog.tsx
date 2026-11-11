'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';

export interface HrInboxForwardRow {
  id: string;
  source: 'hr' | 'workbench';
  title: string;
}

export function HrInboxForwardDialog({
  row,
  onClose,
  onSent,
}: {
  row: HrInboxForwardRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const [target, setTarget] = useState<'tasks' | 'finance'>('tasks');
  const [recipientId, setRecipientId] = useState('');
  const [users, setUsers] = useState<
    { id: string; displayName: string; username: string }[] | null
  >(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [directoryError, setDirectoryError] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    void customerAffairsApi
      .hrInboxForwardRecipients(row.id, row.source)
      .then(({ data }) => {
        if (active) setUsers(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setDirectoryError(
            cause instanceof Error
              ? cause.message
              : 'فهرست کاربران دریافت نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [row.id, row.source]);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError('');
    const input = {
      source: row.source,
      target,
      ...(target === 'tasks' ? { recipientId } : {}),
      message: message.trim(),
    };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    try {
      await customerAffairsApi.forwardHrInboxRequest(
        row.id,
        input,
        attempt.current.key,
      );
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'بازارسال انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>بازارسال درخواست</DialogTitle>
        <DialogDescription>{row.title}</DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="grid gap-2 text-sm">
            مقصد
            <NativeSearchSelect
              value={target}
              disabled={busy}
              onChange={(event) =>
                setTarget(
                  event.target.value === 'finance' ? 'finance' : 'tasks',
                )
              }
            >
              <option value="tasks">کارتابل کاربر</option>
              <option value="finance">کارتابل درخواست‌های مالی</option>
            </NativeSearchSelect>
          </label>
          {target === 'tasks' ? (
            <label className="grid gap-2 text-sm">
              کاربر گیرنده
              <NativeSearchSelect
                value={recipientId}
                disabled={busy || !users?.length}
                onChange={(event) => setRecipientId(event.target.value)}
              >
                <option value="">
                  {users
                    ? users.length
                      ? 'انتخاب کاربر'
                      : 'کاربر فعالی یافت نشد'
                    : 'در حال دریافت کاربران'}
                </option>
                {users?.map(({ id, displayName, username }) => (
                  <option key={id} value={id}>
                    {displayName} · {username}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
          ) : null}
          <label className="grid gap-2 text-sm">
            متن قابل اشتراک
            <textarea
              className="min-h-24 rounded-xl border bg-background p-3"
              value={message}
              required
              maxLength={2000}
              disabled={busy}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {target === 'tasks' && directoryError ? (
            <p role="alert" className="text-sm text-destructive">
              {directoryError}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                busy || !message.trim() || (target === 'tasks' && !recipientId)
              }
            >
              بازارسال
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              انصراف
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
