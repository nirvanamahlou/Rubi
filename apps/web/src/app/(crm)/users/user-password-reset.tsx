'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { userPasswordError } from './user-password-policy';

export function UserPasswordReset({
  name,
  disabled,
  onReset,
}: {
  name: string;
  disabled: boolean;
  onReset: (newPassword: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || disabled) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('newPassword') ?? '');
    const error = userPasswordError(password);
    if (error) {
      setMessage(error);
      return;
    }
    if (password !== fields.get('confirmPassword')) {
      setMessage('تکرار رمز با رمز جدید یکسان نیست.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      await onReset(password);
      form.reset();
      setMessage('رمز جدید ثبت شد؛ کاربر باید دوباره وارد سامانه شود.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تغییر رمز انجام نشد.',
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-label={'تغییر رمز ' + name}
      className="mt-6 grid gap-3 rounded-xl border p-4"
    >
      <h3 className="font-bold">تغییر رمز {name}</h3>
      <p className="text-sm text-muted-foreground">
        با ثبت رمز جدید، نشست‌های قبلی این کاربر بسته می‌شوند.
      </p>
      <fieldset
        disabled={disabled || busy}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label>
          رمز جدید
          <Input
            name="newPassword"
            type="password"
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            dir="ltr"
          />
        </label>
        <label>
          تکرار رمز جدید
          <Input
            name="confirmPassword"
            type="password"
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            dir="ltr"
          />
        </label>
        <small className="sm:col-span-2">
          ۱۰ تا ۲۰۰ نویسه، حرف بزرگ و کوچک لاتین، عدد و علامت
        </small>
        <Button type="submit">
          {busy ? 'در حال تغییر رمز…' : 'ثبت رمز جدید'}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
