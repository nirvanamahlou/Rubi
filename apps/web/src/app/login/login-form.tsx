'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';

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
        setError('نام کاربری یا رمز عبور صحیح نیست.');
        return;
      }
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
