'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { rememberHeaderSession } from '@/lib/header-session';
import type { LoginResponse } from '@rubi/contracts';
import { loginErrorMessage } from './login-error';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const values = new FormData(event.currentTarget);
    const api = getPublicApiBaseUrl();
    if (!api) {
      setError('آدرس API تنظیم نشده است.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${api}/iam/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: values.get('username'),
          password: values.get('password'),
        }),
      });
      if (!response.ok) {
        setError(loginErrorMessage(response.status));
        return;
      }
      const session = (await response.json()) as LoginResponse;
      rememberHeaderSession(session.user);
      const target = search.get('next');
      router.replace(
        target?.startsWith('/') && !target.startsWith('//')
          ? target
          : '/dashboard',
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <FormField id="username" label="نام کاربری" required>
        <Input
          autoComplete="username"
          dir="ltr"
          id="username"
          minLength={3}
          name="username"
          pattern="[a-zA-Z0-9._-]+"
          required
        />
      </FormField>
      <FormField id="password" label="رمز عبور" required>
        <div className="relative">
          <Input
            autoComplete="current-password"
            className="pe-11"
            dir="ltr"
            id="password"
            name="password"
            required
            type={showPassword ? 'text' : 'password'}
          />
          <button
            aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </FormField>
      {error ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button className="w-full" loading={loading} size="lg" type="submit">
        ورود امن
      </Button>
    </form>
  );
}
