'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';
import {
  passwordChangeError,
  passwordChangeAvailable,
  submitPasswordChange,
} from './password-change-api';

export function PasswordChange({
  open,
  onOpenChange,
  userId,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);
  useEffect(() => {
    let current = true;
    if (open)
      void passwordChangeAvailable().then((ready) => {
        if (current) setServiceReady(ready);
      });
    return () => {
      current = false;
    };
  }, [open]);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  function changeOpen(value: boolean) {
    if (submitting.current) return;
    form.current?.reset();
    setError('');
    setSuccess(false);
    setServiceReady(false);
    onOpenChange(value);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !serviceReady) return;
    const values = new FormData(event.currentTarget);
    const current = String(values.get('currentPassword') ?? '');
    const next = String(values.get('newPassword') ?? '');
    const confirmation = String(values.get('confirmation') ?? '');
    const invalid = passwordChangeError(current, next, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await submitPasswordChange(current, next, userId);
      setSuccess(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'تغییر رمز انجام نشد.',
      );
    } finally {
      form.current?.reset();
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Button variant="outline" onClick={() => changeOpen(true)}>
        <KeyRound className="size-4" aria-hidden="true" />
        تغییر رمز عبور
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          dir="rtl"
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogTitle className="pe-10">تغییر رمز عبور</DialogTitle>
          <DialogDescription>
            پس از تغییر موفق رمز، تمام نشست‌های این حساب بسته می‌شوند و باید با
            رمز جدید وارد شوید.
          </DialogDescription>
          {success ? (
            <div className="space-y-4">
              <Alert
                tone="info"
                title="رمز عبور تغییر کرد"
                description="برای ادامه، با رمز جدید وارد حساب شوید."
              />
              <Button asChild>
                <Link href="/login?next=%2Fworkbench%3Ftab%3Daccount">
                  ورود با رمز جدید
                </Link>
              </Button>
            </div>
          ) : (
            <form
              ref={form}
              onSubmit={(event) => void submit(event)}
              className="space-y-4"
              aria-busy={pending}
            >
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                readOnly
                hidden
              />
              <fieldset
                disabled={pending || !serviceReady}
                className="space-y-4"
                aria-label="اطلاعات تغییر رمز عبور"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="workbench-current-password"
                    className="block text-sm font-semibold"
                  >
                    رمز عبور فعلی
                  </label>
                  <Input
                    id="workbench-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    dir="ltr"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="workbench-new-password"
                    className="block text-sm font-semibold"
                  >
                    رمز عبور جدید
                  </label>
                  <Input
                    id="workbench-new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    dir="ltr"
                    required
                    minLength={10}
                    maxLength={200}
                    aria-describedby="workbench-password-policy"
                  />
                  <p
                    id="workbench-password-policy"
                    className="text-xs leading-6 text-muted-foreground"
                  >
                    ۱۰ تا ۲۰۰ نویسه، شامل حرف بزرگ و کوچک لاتین، عدد و نویسهٔ
                    ویژه.
                  </p>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="workbench-confirm-password"
                    className="block text-sm font-semibold"
                  >
                    تکرار رمز عبور جدید
                  </label>
                  <Input
                    id="workbench-confirm-password"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    dir="ltr"
                    required
                    maxLength={200}
                  />
                </div>
              </fieldset>
              {error && <Alert tone="error" title={error} />}
              {!serviceReady && (
                <Alert
                  tone="info"
                  title="سرویس تغییر رمز در دسترس نیست"
                  description="پس از فعال‌شدن سرویس، این فرم را دوباره باز کنید. تا آن زمان ورود و ثبت رمز غیرفعال است."
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending || !serviceReady}>
                  {pending ? 'در حال تغییر رمز…' : 'ثبت رمز جدید'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeOpen(false)}
                >
                  انصراف
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
