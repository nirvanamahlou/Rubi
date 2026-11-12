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
    recipientIds: string[],
    status: InternalLetterStatus,
    description: string,
  ) => Promise<void>;
  forward?: boolean;
  initialRecipientId?: string;
};
export function LetterRecipientDialog(props: RecipientDialogProps) {
  return props.open ? <OpenRecipientDialog {...props} /> : null;
}
function OpenRecipientDialog({
  open,
  onOpenChange,
  onSubmit,
  forward = false,
  initialRecipientId,
}: RecipientDialogProps) {
  const [users, setUsers] = useState<CorrespondenceUser[]>([]);
  const [recipients, setRecipients] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : [],
  );
  const [description, setDescription] = useState('');
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
  const grouped = new Map<string, CorrespondenceUser[]>();
  for (const user of users) {
    const unit = user.unit || 'بدون واحد';
    const group = grouped.get(unit) ?? [];
    group.push(user);
    grouped.set(unit, group);
  }
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
        <DialogDescription>کاربران مقصد را انتخاب کنید.</DialogDescription>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || loading || !recipients.length) return;
            setBusy(true);
            setError('');
            void onSubmit(recipients, status, description)
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
          <fieldset
            disabled={busy || loading}
            className="rounded-xl border bg-surface p-4"
          >
            <legend className="px-2 text-sm font-semibold">ارسال به</legend>
            {loading && (
              <p role="status" className="text-sm">
                در حال بارگذاری کاربران…
              </p>
            )}
            <div className="max-h-60 space-y-3 overflow-y-auto">
              {[...grouped]
                .sort(([a], [b]) => a.localeCompare(b, 'fa'))
                .map(([unit, members]) => (
                  <section
                    key={unit}
                    className="space-y-2 border-b pb-3 last:border-0"
                  >
                    <h3 className="text-sm font-semibold">{unit}</h3>
                    {members.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={recipients.includes(user.id)}
                          disabled={
                            user.id === initialRecipientId ||
                            (!recipients.includes(user.id) &&
                              recipients.length >= 100)
                          }
                          onChange={(event) =>
                            setRecipients((current) =>
                              event.target.checked
                                ? [...current, user.id]
                                : current.filter((id) => id !== user.id),
                            )
                          }
                        />
                        <span>
                          {user.displayName} ({user.username})
                        </span>
                      </label>
                    ))}
                  </section>
                ))}
            </div>
          </fieldset>
          {forward && (
            <label className="block text-sm">
              توضیحات
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-surface p-3"
                value={description}
                maxLength={2000}
                disabled={busy}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          )}
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
            <Button
              type="submit"
              disabled={!recipients.length || busy || loading}
            >
              {busy ? 'در حال ارسال…' : 'ارسال'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
