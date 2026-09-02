'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { loginErrorMessage, loginInputError } from './login-error';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const values = new FormData(event.currentTarget);
    const inputError = loginInputError(
      values.get('username'),
      values.get('password'),
    );
    if (inputError) {
      setError(inputError);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: String(values.get('username')).trim(),
          password: values.get('password'),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        setError(loginErrorMessage(response.status));
        return;
      }
      const target = search.get('next');
      router.replace(
        target?.startsWith('/') && !target.startsWith('//')
          ? target
          : '/dashboard',
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof DOMException && requestError.name === 'AbortError'
          ? 'پاسخ سرور طول کشید. دوباره تلاش کنید.'
          : 'ارتباط با سرور برقرار نشد.',
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }
  return (
    <form className="mt-8 grid gap-5" noValidate onSubmit={submit}>
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
        <Input
          autoComplete="current-password"
          dir="ltr"
          id="password"
          name="password"
          required
          type="password"
        />
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
