'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { CorrespondenceUser, InternalLetterStatus } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/overlays';
import { internalLetters } from './api';

export const internalStatusLabels: Record<InternalLetterStatus, string> = {
  SENT: 'ارسال‌شده',
  APPROVED: 'تأیید',
  REJECTED: 'رد',
  NEEDS_CORRECTION: 'نیازمند اصلاح',
};
export function LetterIconAction({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
type RecipientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    recipientId: string,
    status: InternalLetterStatus,
  ) => Promise<void>;
  forward?: boolean;
};
export function LetterRecipientDialog(props: RecipientDialogProps) {
  return props.open ? <OpenRecipientDialog {...props} /> : null;
}
function OpenRecipientDialog({
  open,
  onOpenChange,
  onSubmit,
  forward = false,
}: RecipientDialogProps) {
  const [users, setUsers] = useState<CorrespondenceUser[]>([]);
  const [recipient, setRecipient] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InternalLetterStatus>('APPROVED');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void internalLetters
      .users()
      .then((rows) => {
        if (live) setUsers(rows);
      })
      .catch((cause) => {
        if (live)
          setError(
            cause instanceof Error
              ? cause.message
              : 'فهرست کاربران بارگذاری نشد.',
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [open, retry]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent dir="rtl">
        <DialogTitle>
          {forward ? 'بازارسال نامه' : 'ارسال نامه داخلی'}
        </DialogTitle>
        <DialogDescription>کاربر مقصد را انتخاب کنید.</DialogDescription>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            void onSubmit(recipient, status)
              .then(() => onOpenChange(false))
              .catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'ارسال نامه ناموفق بود.',
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {forward && (
            <label className="block text-sm">
              وضعیت
              <select
                className="mt-2 w-full rounded-xl border bg-surface p-3"
                value={status}
                disabled={busy}
                onChange={(event) =>
                  setStatus(event.target.value as InternalLetterStatus)
                }
              >
                {(['APPROVED', 'REJECTED', 'NEEDS_CORRECTION'] as const).map(
                  (key) => (
                    <option key={key} value={key}>
                      {internalStatusLabels[key]}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          <label className="block text-sm">
            جست‌وجوی کاربر
            <input
              className="mt-2 w-full rounded-xl border bg-surface p-3"
              value={search}
              disabled={busy}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            ارسال به
            <select
              required
              className="mt-2 w-full rounded-xl border bg-surface p-3"
              value={recipient}
              disabled={busy || loading}
              onChange={(event) => setRecipient(event.target.value)}
            >
              <option value="">
                {loading ? 'در حال بارگذاری کاربران…' : 'انتخاب کاربر'}
              </option>
              {users
                .filter((user) =>
                  `${user.displayName} ${user.username}`
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ({user.username})
                  </option>
                ))}
            </select>
          </label>
          {!loading && !users.length && !error && (
            <p className="text-sm text-muted-foreground">
              کاربر فعالی برای ارسال وجود ندارد.
            </p>
          )}
          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setRetry((value) => value + 1);
                }}
              >
                بارگذاری مجدد
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={!recipient || busy || loading}>
              {busy ? 'در حال ارسال…' : 'ارسال'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
