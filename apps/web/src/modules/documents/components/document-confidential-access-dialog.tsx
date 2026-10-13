'use client';

import { KeyRound, LockKeyhole } from 'lucide-react';
import { useState } from 'react';

import { documentsApi } from '../api/client';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';

export function DocumentConfidentialAccessDialog({
  documentId,
  onOpenChange,
  onUnlocked,
  open,
}: {
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (token: string) => Promise<void>;
  open: boolean;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentId || !/^\d{6}$/u.test(code)) {
      setError('کد شش‌رقمی را کامل وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await documentsApi.createAccessGrant(documentId, {
        code,
        purpose: 'CONFIDENTIAL_VIEW',
      });
      await onUnlocked(response.data.token);
      setCode('');
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'بررسی کد محرمانگی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && !busy) {
          setCode('');
          setError('');
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-w-md p-6" dir="rtl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </span>
          <div>
            <DialogTitle>سند محرمانه</DialogTitle>
            <DialogDescription className="mt-1">
              برای نمایش اطلاعات و بازکردن یا دانلود فایل، کد محرمانگی را وارد
              کنید.
            </DialogDescription>
          </div>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          <Input
            aria-label="کد محرمانگی سند"
            autoComplete="one-time-code"
            autoFocus
            inputMode="numeric"
            maxLength={6}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/gu, '').slice(0, 6))
            }
            pattern="[0-9]{6}"
            placeholder="کد شش‌رقمی"
            type="password"
            value={code}
          />
          {error ? (
            <Alert
              description={error}
              title="بررسی کد ناموفق بود"
              tone="error"
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={busy}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              انصراف
            </Button>
            <Button disabled={busy || code.length !== 6} type="submit">
              <KeyRound aria-hidden="true" className="size-4" />
              نمایش سند
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
